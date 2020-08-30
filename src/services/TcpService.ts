import net = require('net');
import events = require('events');

import { RinnaiTouchPlatform } from '../platform';
import { UdpService, IModuleAddress } from './UdpService';
import { Message } from '../models/Message';

export { IModuleAddress };

export class TcpService extends events.EventEmitter {
  private readonly defaultAddress?: IModuleAddress;
  private readonly udp: UdpService;
  private socket?: net.Socket;

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private address?: IModuleAddress,
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

        this.socket.on('error', (error: Error) => {
          this.closeSocket(true);
          reject(error);
        });

        this.socket.on('ready', () => {
          this.platform.log.info('TCP Connection: Open');
        });

        this.socket.on('timeout', () => {
          this.closeSocket(true);
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
      this.closeSocket(false);
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