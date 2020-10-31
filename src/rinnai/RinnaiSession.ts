import events = require('events');
import cq = require('concurrent-queue');

import { RinnaiTouchPlatform } from '../platform';
import { TcpService, ModuleAddress } from './TcpService';
import { Message } from '../models/Message';
import { Status } from '../models/Status';
import { Command } from '../models/Command';

export class RinnaiSession extends events.EventEmitter {
  private tcp: TcpService;
  private address?: ModuleAddress;
  private pingIntervalId?: NodeJS.Timeout;
  private readonly queue: cq;
  private sequence = 0;
  private status?: Status;
  private connectionError = false;

  constructor(private readonly platform: RinnaiTouchPlatform) {
    super();

    if (platform.settings.address) {
      this.address = {
        address: platform.settings.address,
        port: platform.settings.port ?? 27847,
      };
    }

    this.tcp = new TcpService(this.platform, this.address);

    this.queue = cq()
      .limit({ concurrency: 1 })
      .process(this.process.bind(this));
  }

  async start() {
    this.platform.log.debug(this.constructor.name, 'start');

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
          this.platform.log.warn(`TCP Connection failed. Attempt ${i} of 3 [Error: ${error.message}]`);
          await this.delay(500);
        }
      }

      if (!connected) {
        this.platform.log.warn('Will try again in 1 minute');
        await this.delay(60000);
      }
    }

    // message handler
    this.tcp.on('message', this.receiveMessage.bind(this));

    // error handler
    this.tcp.on('connection_error', this.handleConnectionError.bind(this));

    // Ping module
    this.pingIntervalId = setInterval(async () => {
      await this.sendCommand(new Command());
    }, 60000);
  }

  stop() {
    this.platform.log.debug(this.constructor.name, 'stop');

    try {
      if (this.pingIntervalId !== undefined) {
        clearInterval(this.pingIntervalId);
      }

      this.tcp.removeAllListeners();

      this.tcp.destroy();
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  getStatus(): Status | undefined {
    return this.status;
  }

  async sendCommand(command: Command): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'sendCommand', command.toString());

    try {
      await this.queue(command);
    } catch (error) {
      this.platform.log.error(error);
      throw error;
    }
  }

  private async process(command: Command): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'process', command.toString());

    try {
      const payload = command.toCommand(this.nextSequence);

      if (this.platform.settings.showModuleEvents && !command.isPing) {
        this.platform.log.info(`Sending: ${payload}`);
      }

      for (let i = 1; i <= 3; i++) {
        await this.tcp.write(payload);

        if (command.isPing) {
          return;
        }

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

  private async commandSucceeded(command: Command): Promise<boolean> {
    this.platform.log.debug(this.constructor.name, 'commandSucceeded', command.toString());

    let checkStatus: (status: Status) => void;

    return new Promise((resolve, reject) => {
      try {
        const startTime: number = Date.now();

        const timerId: NodeJS.Timeout = setTimeout(() => {
          this.off('status', checkStatus);
          resolve(false);
        }, 10000);

        checkStatus = (status: Status) => {
          if (status.hasState(command.group1, command.group2, command.command, command.state)) {
            clearTimeout(timerId);
            if (this.platform.settings.showModuleEvents) {
              this.platform.log.info(`Command succeeded. Took ${Date.now() - startTime} ms`);
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
    this.platform.log.debug(this.constructor.name, 'receiveMessage', message.toString());

    try {
      this.sequence = message.sequence!;

      if (message.status!.equals(this.status)) {
        return;
      }

      if (this.platform.settings.showModuleStatus) {
        this.platform.log.info(message.status!.toString());
      }

      this.status = message.status;
      this.emit('status', message.status);
    } catch(error) {
      this.platform.log.error(error);
    }
  }

  private async handleConnectionError(error: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'handleError', error);

    try {
      this.platform.log.warn(`TCP Connection failed. Attempting to reconnect [Error: ${error}]`);
      this.connectionError = true;
      this.emit('connection');
      this.stop();
      await this.delay(2000);
      await this.start();
    } catch(error) {
      this.platform.log.error(error);
    }
  }

  get hasConnectionError(): boolean {
    return this.connectionError;
  }

  private get nextSequence(): number {
    let nextSequence = (this.sequence + 1) % 255;
    if (nextSequence === 0) {
      nextSequence = 1;
    }
    return nextSequence;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

}