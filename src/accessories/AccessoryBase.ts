import crypto = require('crypto');

import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';

export abstract class AccessoryBase {
  protected service!: Service;
  
  constructor(
    protected readonly platform: RinnaiTouchPlatform,
    public readonly platformAccessory: PlatformAccessory,
  ) { 

    this.setAccessoryInformation();
  }

  abstract serviceName: string;

  abstract updateValues(): void

  setAccessoryInformation(): void {
    this.platform.log.debug('AccessoryBase', 'setAccessoryInformation');

    const service = <Service>this.platformAccessory.getService(this.platform.Service.AccessoryInformation);
    service
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Rinnai')
      .setCharacteristic(this.platform.Characteristic.Model, 'N-BW2')
      .setCharacteristic(this.platform.Characteristic.SerialNumber,
        crypto.createHash('sha1').update(this.platformAccessory.UUID).digest('hex'));
  }

  setEventHandlers(): void {
    this.platform.log.debug('AccessoryBase', 'setEventHandlers');

    this.platform.service.on('updated', () => {
      this.updateValues();
    });
  }

  async getCharacteristicValue(
    getValue: () => CharacteristicValue,
    characteristic: string,
    callback: CharacteristicGetCallback,
  ): Promise<void> {
    this.platform.log.debug('AccessoryBase', 'getCharacteristicValue', 'getValue', characteristic, 'callback');

    this.platform.log.info(`${this.platformAccessory.displayName}: Getting characteristic '${characteristic}'`);
    try {
      await this.platform.service.updateStates();
      const value = getValue();

      callback(null, value);
    } catch (error) {
      this.platform.log.error(error);
      callback(error);
    }
  }

  async setCharacteristicValue(
    setValue,
    characteristic: string,
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): Promise<void> {
    this.platform.log.debug('AccessoryBase', 'setCharacteristic', 'setValue', characteristic, value, 'callback');

    this.platform.log.info(`${this.platformAccessory.displayName}: Setting characteristic '${characteristic}' to '${value}'`);
    try {
      await setValue(value);

      callback(null);

      await this.platform.service.updateStates();
    } catch (error) {
      this.platform.log.error(error);
      callback(error);
    }
  }
}