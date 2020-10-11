import net = require('net');
import events = require('events');

import { RinnaiTouchPlatform } from '../platform';
import { UdpService, ModuleAddress } from './UdpService';
import { Message } from '../models/Message';

export { ModuleAddress };

export class TcpService extends events.EventEmitter {
  private readonly defaultAddress?: ModuleAddress;
  private readonly udp: UdpService;
  private socket?: net.Socket;

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private address?: ModuleAddress,
    private readonly timeout: number = 5000,
  ) {
    super();
    this.defaultAddress = address;
    this.udp = new UdpService(platform, timeout);
  }

  async connect(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'connect');

    if (!this.address) {
      this.address = this.defaultAddress ?? await this.udp.getAddress();
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
          this.closeSocket(true);
          this.emit('error', error.message);
          reject(error);
        });

        this.socket.once('ready', () => {
          this.platform.log.info('TCP Connection: Open');
        });

        this.socket.once('timeout', () => {
          this.closeSocket(true);
          this.emit('error', 'TCP Connection timed out');
          reject(new Error('TCP Connection timed out'));
        });

        if (!this.address) {
          reject(new Error('Cannot connect to module as address is undefined'));
          return;
        }

        this.socket.connect(this.address.port, this.address.address);
        this.socket.setTimeout(5000);
      } catch (error) {
        this.closeSocket(true);
        reject(error);
      }
    });
  }

  closeSocket(clearAddress: boolean) {
    this.platform.log.debug(this.constructor.name, 'closeSocket');

    if (clearAddress) {
      this.address = undefined;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = undefined;
    }
  }

  destroy(): void {
    this.platform.log.debug(this.constructor.name, 'destroy');

    if (this.socket) {
      this.closeSocket(true);
      this.platform.log.info('TCP Connection: Closed');
    }
  }

  write(data: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'write', data);

    return new Promise((resolve, reject) => {
      try {
        if (!this.socket) {
          throw new Error('Cannot write data as socket is undefined');
        }

        this.socket.write(data, (error?: Error) => {
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