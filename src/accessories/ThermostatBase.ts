import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { AccessoryBase } from './AccessoryBase';

export abstract class ThermostatBase extends AccessoryBase {
  constructor(
    platform: RinnaiTouchPlatform,
    platformAccessory: PlatformAccessory,
  ) {
    super(platform, platformAccessory);
  }

  setEventHandlers(): void {
    this.platform.log.debug('ThermostatBase', 'setEventHandlers');

    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .on('get', this.getCharacteristicValue.bind(this, this.getCurrentTemperature.bind(this), 'CurrentTemperature'));

    this.service
      .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .on('get', this.getCharacteristicValue.bind(this, this.getTemperatureUnits.bind(this), 'TemperatureDisplayUnits'));
  }

  getCurrentTemperature(): number {
    this.platform.log.debug('ThermostatBase', 'getCurrentTemperature');

    return this.platform.temperatureService.getTemperature(this.platformAccessory.context.zone) ?? 0;
  }

  getTemperatureUnits(): number {
    this.platform.log.debug('ThermostatBase', 'getTemperatureUnits');

    const state = this.platform.service.getTemperatureUnits();
    return state === 'F'
      ? this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT
      : this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
  }

  updateValues(): void {
    this.platform.log.debug('ThermostatBase', 'updateValues', 'service');

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .updateValue(this.getCurrentTemperature());

    this.service
      .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .updateValue(this.getTemperatureUnits());
  }
}