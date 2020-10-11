import dgram = require('dgram');

import { RinnaiTouchPlatform } from '../platform';

export type ModuleAddress = {
  address: string;
  port: number;
}

export class UdpService {
  private readonly port: number = 50000;

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly timeout: number = 5000,
  ) {
  }

  getAddress(): Promise<ModuleAddress> {
    this.platform.log.debug(this.constructor.name, 'getAddress');

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
          const port = message[32] * 256 + message[33];
          this.platform.log.info(`Found: Rinnai Touch module [${remote.address}:${port}]`);
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