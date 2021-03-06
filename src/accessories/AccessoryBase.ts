import crypto = require('crypto');

import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';

export abstract class AccessoryBase {
  protected service!: Service;
  protected modeNames = {
    A: '',
    H: 'Heat',
    C: 'Cool',
    E: 'Cool',
    F: 'Fan',
  }
  
  constructor(
    protected readonly platform: RinnaiTouchPlatform,
    public readonly platformAccessory: PlatformAccessory,
  ) { 

    this.setAccessoryInformation();
  }

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

    this.platform.service.session.on('status', () => {
      this.updateValues();
    });

    this.platformAccessory.on('identify', () => {
      this.platform.log.info(`Identified: ${this.platformAccessory.displayName}`);
    });
  }

  getCharacteristicValue(
    getValue: () => CharacteristicValue,
    characteristic: string,
    callback: CharacteristicGetCallback,
  ): void {
    this.platform.log.debug('AccessoryBase', 'getCharacteristicValue', 'getValue', characteristic, 'callback');

    if (this.platform.settings.showHomebridgeEvents) {
      this.platform.log.info(`${this.platformAccessory.displayName}: Getting characteristic '${characteristic}'`);
    }

    try {
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

    if (this.platform.settings.showHomebridgeEvents) {
      this.platform.log.info(`${this.platformAccessory.displayName}: Setting characteristic '${characteristic}' to '${value}'`);
    }

    try {
      await setValue(value);

      callback(null);
    } catch (error) {
      this.platform.log.error(error);
      callback(error);
    }
  }
}