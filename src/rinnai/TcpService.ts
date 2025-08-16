import net = require('net');
import events = require('events');

import { ILogging } from './ILogging';
import { UdpService, ModuleAddress } from './UdpService';
import { Message } from '../models/Message';

export { ModuleAddress };

export class TcpService extends events.EventEmitter {
  private readonly log: ILogging;
  private readonly hasStaticIpAddress: boolean;
  private address?: ModuleAddress;
  private readonly timeout: number;
  private readonly udp: UdpService;
  private socket?: net.Socket;

  constructor(options: {log?: ILogging, address?: ModuleAddress, timeout?: number} = {}) {
    super();
    this.log = options.log ?? console;

    this.hasStaticIpAddress = options.address !== undefined;
    this.address = options.address;
    this.timeout = options.timeout ?? 5000;
    this.udp = new UdpService({log: this.log, timeout: this.timeout});
  }

  async connect(): Promise<void> {
    this.log.debug(this.constructor.name, 'connect');

    if (!this.address) {
      this.address = await this.udp.getAddress();
    }

    return new Promise((resolve, reject) => {
      try {
        if (this.socket) {
          resolve();
        }
       
        this.socket = new net.Socket();

        this.socket.on('data', (data: Buffer) => {
          const message: Message = new Message(data);
          if (message.isValid) {
            this.emit('message', message);
            resolve();
          }
        });

        this.socket.once('error', (error: Error) => {
          this.closeSocket();
          this.emit('connection_error', error.message);
          reject(error);
        });

        this.socket.once('ready', () => {
          this.log.info(`TCP Connection: Open [${this.address?.address}:${this.address?.port}]`);
        });

        this.socket.once('timeout', () => {
          this.closeSocket();
          this.emit('connection_error', 'TCP Connection timed out');
          reject(new Error('TCP Connection timed out'));
        });

        if (!this.address) {
          reject(new Error('Cannot connect to module as address is undefined'));
          return;
        }

        this.socket.connect(this.address.port, this.address.address);
        this.socket.setTimeout(5000);
      } catch (error) {
        this.closeSocket();
        reject(error);
      }
    });
  }

  closeSocket() {
    this.log.debug(this.constructor.name, 'closeSocket');

    if (!this.hasStaticIpAddress) {
      this.address = undefined;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = undefined;
    }
  }

  destroy(): void {
    this.log.debug(this.constructor.name, 'destroy');

    if (this.socket) {
      this.closeSocket();
      this.log.info('TCP Connection: Closed');
    }
  }

  write(data: string): Promise<void> {
    this.log.debug(this.constructor.name, 'write', data);

    return new Promise((resolve, reject) => {
      try {
        if (!this.socket) {
          throw new Error('Cannot write data as socket is undefined');
        }

        this.socket.write(data, (error?: Error | null) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}