import dgram = require('dgram');
import { ILogging } from './ILogging';

export type ModuleAddress = {
  address: string;
  port: number;
}

export class UdpService {
  private readonly log: ILogging;
  private readonly port: number;
  private readonly timeout: number;

  constructor(options: {log?: ILogging, port?: number, timeout?: number} = {}) {
    this.log = options.log ?? console;
    this.port = options.port ?? 50000;
    this.timeout = options.timeout ?? 5000;
  }

  getAddress(): Promise<ModuleAddress> {
    this.log.debug(this.constructor.name, 'getAddress');

    return new Promise((resolve, reject) => {
      const socket: dgram.Socket = dgram.createSocket('udp4');

      const timer: NodeJS.Timeout = setTimeout(() => {
        socket.removeAllListeners();
        socket.close();
        reject(new Error('Timeout occured. No UDP message received from Rinnai Touch Module'));
      }, this.timeout);

      socket.on('message', (message: Buffer, remote: dgram.RemoteInfo) => {
        if (message.toString().substr(0, 18) === 'Rinnai_NBW2_Module') {
          clearTimeout(timer);
          socket.removeAllListeners();
          socket.close();
          const port = message.readUInt16BE(32);
          this.log.info(`Found: Rinnai Touch module [${remote.address}:${port}]`);
          resolve({
            address: remote.address,
            port: port,
          });
        }
      });

      socket.on('error', (error) => {
        clearTimeout(timer);
        socket.removeAllListeners();
        socket.close();
        reject(error);
      });

      socket.bind(this.port);
    });
  }
}