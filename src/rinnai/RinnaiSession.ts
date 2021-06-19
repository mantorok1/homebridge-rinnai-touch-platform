import events = require('events');
import schedule = require('node-schedule');
import cq = require('concurrent-queue');

import { TcpService, ModuleAddress } from './TcpService';
import { Message } from '../models/Message';
import { Status } from '../models/Status';
import { Command, Commands } from '../models/Command';
import { ILogging } from './ILogging';

export class RinnaiSession extends events.EventEmitter {
  private readonly log: ILogging;
  private address?: ModuleAddress;
  private readonly showModuleEvents: boolean;
  private readonly showModuleStatus: boolean;
  private readonly bootTime?: {hour: number, minute: number};
  private readonly bootPassword?: string;

  private tcp: TcpService;
  private jobPing?: schedule.Job;
  private jobBoot?: schedule.Job
  private readonly queue: cq;
  private _message?: Message;
  private _status: Status = new Status;
  private connectionError = false;

  constructor(options: {
    log?: ILogging,
    address?: string,
    port?: number,
    showModuleEvents?: boolean,
    showModuleStatus?: boolean,
    bootTime?: string,
    bootPassword?: string
  } = {}) {
    super();
    this.setMaxListeners(40);

    this.log = options.log ?? console;
    if (options.address) {
      this.address = {
        address: options.address,
        port: options.port ?? 27847,
      };
    }
    this.showModuleEvents = options.showModuleEvents ?? true;
    this.showModuleStatus = options.showModuleStatus ?? false;

    if ((options.bootTime ?? '').length === 5 && (options.bootPassword ?? '').length > 0) {
      this.bootTime = {
        hour: Number(options.bootTime!.substring(0, 2)),
        minute: Number(options.bootTime!.substring(3, 5)),
      };
      this.bootPassword = options.bootPassword!;
    }

    this.tcp = new TcpService({log: this.log, address: this.address});

    this.queue = cq()
      .limit({ concurrency: 1 })
      .process(this.process.bind(this));
  }

  async start(): Promise<void> {
    this.log.debug(this.constructor.name, 'start');

    let connected = false;
    while (!connected) {
      for (let i = 1; i <= 3; i++) {
        try {
          await this.tcp.connect();
          connected = true;
          this.connectionError = false;
          this.emit('connection');
          break;
        } catch (error) {
          this.connectionError = true;
          this.emit('connection');
          this.log.warn(`TCP Connection failed. Attempt ${i} of 3 [Error: ${error.message}]`);
          await this.delay(500);
        }
      }

      if (!connected) {
        this.log.warn('Will try again in 1 minute');
        await this.delay(60000);
      }
    }

    // message handler
    this.tcp.on('message', this.receiveMessage.bind(this));

    // error handler
    this.tcp.on('connection_error', this.handleConnectionError.bind(this));

    // Ping Job
    this.jobPing = schedule.scheduleJob('*/1 * * * *', async () => {
      await this.sendCommand(new Command({command: Commands.Ping}));
    });

    // Boot Job
    if (this.bootTime !== undefined) {
      this.jobBoot = schedule.scheduleJob(`${this.bootTime.minute} ${this.bootTime.hour} * * *`, async () => {
        await this.sendCommand(new Command({command: Commands.Boot}));
      });
    }

    // Wait for first status
    await new Promise((resolve) => {
      this.once('status', resolve);
    });
  }

  stop() {
    this.log.debug(this.constructor.name, 'stop');

    try {
      this.jobPing?.cancel();
      this.jobBoot?.cancel();

      this.tcp.removeAllListeners();

      this.tcp.destroy();
    } catch (error) {
      this.log.error(error);
    }
  }

  get message(): Message | undefined {
    return this._message;
  }

  get status(): Status {
    return this._status;
  }

  async sendCommand(command: Command): Promise<void> {
    this.log.debug(this.constructor.name, 'sendCommand', command.toString());

    try {
      await this.queue(command);
    } catch (error) {
      this.log.error(error);
      throw error;
    }
  }

  private async process(command: Command): Promise<void> {
    this.log.debug(this.constructor.name, 'process', command.toString());

    try {
      if (command.isBoot) {
        const payload = `CS<DVPW>${this.bootPassword}<BOOT>\r`;
        this.log.info(`Sending: ${payload}`);
        await this.tcp.write(payload);
        return;
      }

      let payload = 'N' + this.getNextSequence();
      const states = command.toJson(this.status);
      if (!command.isPing) {
        if (states === undefined) {
          this.log.warn(`${command.toString()} is invalid due to module's current Status`);
          return;
        }
        if (this.status.hasStates(states)) {
          this.log.debug(`${command.toString()} not required as Status already in the requested state`);
          return;
        }
        payload += JSON.stringify(states);
      }

      if (this.showModuleEvents && !command.isPing) {
        this.log.info(`Sending: ${payload}`);
      }

      for (let i = 1; i <= 3; i++) {
        await this.tcp.write(payload);

        if (command.isPing) {
          return;
        }

        const success: boolean = await this.commandSucceeded(states!);
        if (success) {
          return;
        }
        this.log.warn(`Command failed. Attempt ${i} of 3`);
      }
    } catch (error) {
      this.log.error(error);
      throw error;
    }
  }

  private async commandSucceeded(states: Record<string, Record<string, Record<string, string>>>): Promise<boolean> {
    this.log.debug(this.constructor.name, 'commandSucceeded', states);

    let checkStatus: (status: Status) => void;

    return new Promise((resolve, reject) => {
      try {
        const startTime: number = Date.now();

        const timerId: NodeJS.Timeout = setTimeout(() => {
          this.off('status', checkStatus);
          resolve(false);
        }, 10000);

        checkStatus = (status: Status) => {
          if (status.hasStates(states)) {
            clearTimeout(timerId);
            if (this.showModuleEvents) {
              this.log.info(`Command succeeded. Took ${Date.now() - startTime} ms`);
            }
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

  private receiveMessage(message: Message) {
    this.log.debug(this.constructor.name, 'receiveMessage', message.toString());

    try {
      if (message.status! === this.message?.status) {
        return;
      }

      if (this.showModuleStatus) {
        this.log.info(message.status!);
      }

      this._message = message;
      this.status.update(message.status!);
      this.emit('status', this.status);
    } catch(error) {
      this.log.error(error);
    }
  }

  private async handleConnectionError(error: string): Promise<void> {
    this.log.debug(this.constructor.name, 'handleError', error);

    try {
      this.log.warn(`TCP Connection failed. Attempting to reconnect [Error: ${error}]`);
      this.connectionError = true;
      this.emit('connection');
      this.stop();
      await this.delay(2000);
      await this.start();
    } catch(error) {
      this.log.error(error);
    }
  }

  get hasConnectionError(): boolean {
    return this.connectionError;
  }

  private getNextSequence(): string {
    let nextSequence = ((this.message?.sequence ?? 0) + 1) % 255;
    if (nextSequence === 0) {
      nextSequence = 1;
    }
    return nextSequence.toString().padStart(6, '0');
  }

  async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}