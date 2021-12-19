import crypto = require('crypto');

import { Service, PlatformAccessory, CharacteristicValue, Nullable } from 'homebridge';
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
  ): Nullable<CharacteristicValue> | Promise<Nullable<CharacteristicValue>> {
    this.platform.log.debug('AccessoryBase', 'getCharacteristicValue', 'getValue', characteristic);

    if (this.platform.settings.showHomebridgeEvents) {
      this.platform.log.info(`${this.platformAccessory.displayName}: Getting characteristic '${characteristic}'`);
    }

    try {
      return getValue();
    } catch (error) {
      if (error instanceof Error) {
        this.platform.log.error(error.message);
      }
      throw error;
    }
  }

  async setCharacteristicValue(
    setValue: (value: CharacteristicValue) => Promise<void>,
    characteristic: string,
    value: CharacteristicValue,
  ): Promise<void> {
    this.platform.log.debug('AccessoryBase', 'setCharacteristicValue', 'setValue', characteristic, value);

    if (this.platform.settings.showHomebridgeEvents) {
      this.platform.log.info(`${this.platformAccessory.displayName}: Setting characteristic '${characteristic}' to '${value}'`);
    }

    try {
      await setValue(value);
    } catch (error) {
      if (error instanceof Error) {
        this.platform.log.error(error.message);
      }
      throw error;
    }
  }
}