import net = require('net');
import events = require('events');

import { RinnaiTouchPlatform } from '../platform';
import { UdpService, IModuleAddress } from './UdpService';

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
          const packet: string = data.toString();
          if (packet.substr(0, 1) === 'N') {
            const from: number = data.lastIndexOf('[') - 7;
            this.emit('data', packet.substr(from));
            resolve();
          }
        });

        this.socket.on('error', (error: Error) => {
          this.address = undefined;
          if (this.socket) {
            this.socket.removeAllListeners();
            this.socket = undefined;
          }
          reject(error);
        });

        this.socket.on('ready', () => {
          this.platform.log.info('TCP Connection: Open');
        });

        this.socket.on('timeout', () => {
          this.platform.log.info('TCP Connection: Timed out');
          this.emit('timeout');
        });

        if (!this.address) {
          reject(new Error('Cannot connect to module as address is undefined'));
          return;
        }

        this.socket.connect(this.address.port, this.address.address);
        this.socket.setTimeout(5000);
      } catch (error) {
        this.address = undefined;
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket = undefined;
        }
        reject(error);
      }
    });
  }

  destroy(): void {
    this.platform.log.debug(this.constructor.name, 'destroy');

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = undefined;
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