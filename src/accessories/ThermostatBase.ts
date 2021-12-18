import { CharacteristicValue, PlatformAccessory } from 'homebridge';
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

    this.platform.temperatureService.on('temperature_change', () => {
      this.updateValues();
    });

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCharacteristicValue.bind(this, this.getCurrentTemperature.bind(this), 'CurrentTemperature'));

    this.service
      .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onGet(this.getCharacteristicValue.bind(this, this.getTemperatureUnits.bind(this), 'TemperatureDisplayUnits'));
  }

  getCurrentTemperature(): CharacteristicValue {
    this.platform.log.debug('ThermostatBase', 'getCurrentTemperature');

    return this.platform.temperatureService.getTemperature(this.platformAccessory.context.zone) ?? 0;
  }

  getTemperatureUnits(): CharacteristicValue {
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