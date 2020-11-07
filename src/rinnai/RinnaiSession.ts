import events = require('events');
import cq = require('concurrent-queue');

import { RinnaiTouchPlatform } from '../platform';
import { TcpService, ModuleAddress } from './TcpService';
import { Message } from '../models/Message';
import { Status } from '../models/Status';
import { Commands } from '../models/Commands';

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
      await this.sendCommands(new Commands());
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

  async sendCommands(commands: Commands): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'sendCommands', commands.toString());

    try {
      await this.queue(commands);
    } catch (error) {
      this.platform.log.error(error);
      throw error;
    }
  }

  private async process(commands: Commands): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'process', commands.toString());

    try {
      const payload = commands.toCommand(this.nextSequence);

      if (this.platform.settings.showModuleEvents && !commands.isPing) {
        this.platform.log.info(`Sending: ${payload}`);
      }

      for (let i = 1; i <= 3; i++) {
        await this.tcp.write(payload);

        if (commands.isPing) {
          return;
        }

        const success: boolean = await this.commandSucceeded(commands);
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

  private async commandSucceeded(commands: Commands): Promise<boolean> {
    this.platform.log.debug(this.constructor.name, 'commandSucceeded', commands.toString());

    let checkStatus: (status: Status) => void;

    return new Promise((resolve, reject) => {
      try {
        const startTime: number = Date.now();

        const timerId: NodeJS.Timeout = setTimeout(() => {
          this.off('status', checkStatus);
          resolve(false);
        }, 10000);

        checkStatus = (status: Status) => {
          if (status.hasStates(commands.group1, commands.group2, commands.commands, commands.states)) {
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

  async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

}