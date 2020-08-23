import events = require('events');
import cq = require('concurrent-queue');

import { RinnaiTouchPlatform } from '../platform';
import { SettingsService } from './SettingsService';
import { TcpService, IModuleAddress } from './TcpService';
import { Message } from '../models/Message';
import { Status } from '../models/Status';
import { Command } from '../models/Command';

export enum ConnectionStates {
  Open,
  Closing,
  Closed,
  Error,
}

export enum RequestTypes {
  Get,
  Set,
  Command,
  Close
}

export interface IRequest {
  type: RequestTypes;
  path?: string;
  state?: string;
  command?: string;
}

export class QueueService extends events.EventEmitter {
  private _connectionState: ConnectionStates = ConnectionStates.Closed;
  private address?: IModuleAddress;
  private readonly tcp: TcpService;
  private readonly queue: cq;
  private timestamp: number;
  private timer?: NodeJS.Timeout;
  private status?: Status;
  private sequenceNumber: number;

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly settings: SettingsService,
  ) {
    super();
    if (settings.address) {
      this.address = {
        address: settings.address,
        port: settings.port ?? 27847,
      };
    }

    this.tcp = new TcpService(this.platform, this.address);
    this.tcp.on('message', this.messageHandler.bind(this));
    this.timestamp = 0;
    this.sequenceNumber = 0;

    this.queue = cq()
      .limit({ concurrency: 1 })
      .process(this.process.bind(this));

    this.queue.drained(this.drained.bind(this));
  }

  get connectionState(): ConnectionStates {
    return this._connectionState;
  }

  set connectionState(value: ConnectionStates) {
    this._connectionState = value;
    this.emit('connection', value);
  }

  async execute(request: IRequest): Promise<cq> {
    this.platform.log.debug(this.constructor.name, 'execute', request);

    try {
      return await this.queue(request);
    } catch (error) {
      this.platform.log.error(error);
      throw error;
    }
  }

  async process(request: IRequest): Promise<Status | undefined> {
    this.platform.log.debug(this.constructor.name, 'process', request);

    try {
      if (request.type === RequestTypes.Close) {
        await this.closeConnection();
        return;
      }

      if (request.type === RequestTypes.Get && (Date.now() - this.timestamp <= 1000)) {
        return this.status;
      }

      if (this.timer) {
        clearTimeout(this.timer);
      }

      if (this.connectionState === ConnectionStates.Open) {
        // If no status receieved for > 2 sec then close connection.
        if (Date.now() - this.timestamp > 2000) {
          await this.closeConnection();
        }
      } else if (this.connectionState === ConnectionStates.Closing) {
        await this.connectionClosed();
      }
      if (this.connectionState === ConnectionStates.Closed || this.connectionState === ConnectionStates.Error) {
        await this.connect();
      }

      // Wait for new status to be emitted from tcp, break out after 4 minutes
      if (request.type === RequestTypes.Get) {
        const ts: number = this.timestamp;
        const startTime: number = Date.now();
        while (ts === this.timestamp || this.status === undefined) {
          await this.delay(100);
          if (Date.now() - startTime > 240000) {
            this.status = undefined;
            break;
          }
        }
        return this.status;
      }

      const command = new Command(this.sequenceNumber, request.path, request.state, request.command);

      this.platform.log.info(`Sending Command: ${command.toString()}`);
      for (let i = 1; i <= 3; i++) {
        await this.tcp.write(command.toString());

        const success: boolean = await this.commandSucceeded(command);
        if (success) {
          return;
        }
        this.platform.log.warn(`Command failed. Attempt ${i} of 3`);
      }
    } catch (error) {
      this.platform.log.error(error);
      throw error;
    }
  }

  async connect(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'connect');

    while (this.connectionState !== ConnectionStates.Open) {
      for (let i = 1; i <= 3; i++) {
        try {
          await this.tcp.connect();
          this.connectionState = ConnectionStates.Open;
          return;
        } catch (error) {
          this.platform.log.warn(`TCP Connection: Failed. ${error.message}. Attempt ${i} of 3`);
          await this.delay(500);
        }
      }

      this.connectionState = ConnectionStates.Error;
      this.platform.log.warn('Unable to connect to Rinnai Touch Module. Will try again in 1 minute');
      await this.delay(60000);
    }
  }

  getCommand(request: IRequest): string {
    this.platform.log.debug(this.constructor.name, 'getCommand', request);

    const sequenceNumber: string = ((this.sequenceNumber + 1) % 255).toString().padStart(6, '0');

    if (request.type === RequestTypes.Set) {
      if (request.path) {
        const path: string[] = request.path.split('.');
        return `N${sequenceNumber}{"${path[0]}":{"${path[1]}":{"${path[2]}":"${request.state}"}}}`;  
      }
      throw new Error('path property missing from "set" request');
    }

    return `N${sequenceNumber}${request.command}`;
  }

  commandSucceeded(command: Command): Promise<boolean> {
    this.platform.log.debug(this.constructor.name, 'commandSucceeded', command.toString());

    let checkStatus: (status: Status) => void;

    return new Promise((resolve, reject) => {
      try {
        const startTime: number = Date.now();

        const timer: NodeJS.Timeout = setTimeout(() => {
          this.off('status', checkStatus);
          resolve(false);
        }, 10000);

        checkStatus = (status: Status) => {
          if (status.hasState(command.group1, command.group2, command.command, command.state)) {
            clearTimeout(timer);
            this.platform.log.info(`Command succeeded. Took ${Date.now() - startTime} ms`);
            this.off('status', checkStatus);
            resolve(true);
          }
        };

        this.on('status', checkStatus);
      } catch (error) {
        this.off('status', checkStatus);
        reject(error);
      }
    });
  }

  async drained(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'drained');

    if (this.connectionState !== ConnectionStates.Open) {
      return;
    }

    if (this.settings.connectionTimeout < 0) {
      return;
    }

    if (this.settings.connectionTimeout === 0) {
      await this.execute({ type: RequestTypes.Close });
      return;
    }

    this.timer = setTimeout(async () => {
      await this.execute({ type: RequestTypes.Close });
    }, this.settings.connectionTimeout);
  }

  async closeConnection(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'closeConnection');

    try {
      if (this.connectionState !== ConnectionStates.Open) {
        return;
      }

      this.connectionState = ConnectionStates.Closing;
      this.tcp.destroy();
      await this.delay(this.settings.closeConnectionDelay);
      this.connectionState = ConnectionStates.Closed;
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  messageHandler(message: Message): void {
    this.platform.log.debug(this.constructor.name, 'messageHandler', message.toString());

    if (message.isValid && message.status?.isValid) {
      this.sequenceNumber = <number>message.sequence;
      this.timestamp = Date.now();
      if (!message.status?.equals(this.status)) {
        this.status = message.status;
        this.emit('status', this.status);
      }
    }
  }

  async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async connectionClosed(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'connectionClosed');

    for (let i = 0; i < 10; i++) {
      await this.delay(500);
      if (this.connectionState === ConnectionStates.Closed) {
        return;
      }
    }
    throw new Error('Connection was not Closed within time limit');
  }
}