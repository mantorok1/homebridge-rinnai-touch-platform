import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { OperatingModes, ControlModes, ScheduleOverrideModes } from '../rinnai/RinnaiService';
import { ThermostatBase } from './ThermostatBase';

export class Thermostat extends ThermostatBase {

  constructor(
    platform: RinnaiTouchPlatform,
    platformAccessory: PlatformAccessory,
  ) {
    super(platform, platformAccessory);

    const service = this.platformAccessory.getService(this.platform.Service.Thermostat);
    if (service) {
      this.service = service;
    } else {
      this.service = this.platformAccessory.addService(this.platform.Service.Thermostat, this.serviceName);
      this.initialiseService();
    }
    
    this.setEventHandlers();
  }

  get serviceName(): string {
    const name: string = this.platform.service.getHasMultiSetPoint()
      ? this.platform.service.getZoneName(this.platformAccessory.context.zone)
      : this.platform.settings.name;
    return name;
  }

  initialiseService() {
    this.platform.log.debug(this.constructor.name, 'initialiseService');

    let validStates = this.getValidCurrentHeatingCoolingStates();
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .setProps({
        minValue: Math.min(...validStates),
        maxValue: Math.max(...validStates),
        validValues: validStates,
      });

    validStates = this.getValidTargetHeatingCoolingStates();
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .setProps({
        minValue: Math.min(...validStates),
        maxValue: Math.max(...validStates),
        validValues: validStates,
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minValue: 8,
        maxValue: 30,
        minStep: 1,
      });
  }

  getValidCurrentHeatingCoolingStates(): number[] {
    this.platform.log.debug(this.constructor.name, 'getValidCurrentHeatingCoolingStates');

    const validStates: number[] = [this.platform.Characteristic.CurrentHeatingCoolingState.OFF];
    if (this.platform.service.getHasHeater()) {
      validStates.push(this.platform.Characteristic.CurrentHeatingCoolingState.HEAT);
    }
    if (this.platform.service.getHasCooler() || this.platform.service.getHasEvaporative()) {
      validStates.push(this.platform.Characteristic.CurrentHeatingCoolingState.COOL);
    }
    return validStates;
  }

  getValidTargetHeatingCoolingStates(): number[] {
    this.platform.log.debug(this.constructor.name, 'getValidTargetHeatingCoolingStates');

    const validStates: number[] = [this.platform.Characteristic.TargetHeatingCoolingState.OFF];
    if (this.platform.service.getHasHeater()) {
      validStates.push(this.platform.Characteristic.TargetHeatingCoolingState.HEAT);
    }
    if (this.platform.service.getHasCooler() || this.platform.service.getHasEvaporative()) {
      validStates.push(this.platform.Characteristic.TargetHeatingCoolingState.COOL);
    }
    if (this.platform.settings.showAuto) {
      validStates.push(this.platform.Characteristic.TargetHeatingCoolingState.AUTO);
    }

    return validStates;
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');

    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getCharacteristicValue.bind(this, this.getCurrentHeatingCoolingState.bind(this), 'CurrentHeatingCoolingState'));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .on('get', this.getCharacteristicValue.bind(this, this.getTargetHeatingCoolingState.bind(this), 'TargetHeatingCoolingState'))
      .on('set', this.setCharacteristicValue.bind(this, this.setTargetHeatingCoolingState.bind(this), 'TargetHeatingCoolingState'));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .on('get', this.getCharacteristicValue.bind(this, this.getTargetTemperature.bind(this), 'TargetTemperature'))
      .on('set', this.setCharacteristicValue.bind(this, this.setTargetTemperature.bind(this), 'TargetTemperature'));
  }

  getCurrentHeatingCoolingState(): number {
    this.platform.log.debug(this.constructor.name, 'getCurrentHeatingCoolingState');

    const state: boolean = this.platform.service.getAutoEnabled(this.platformAccessory.context.zone);

    if (!state) {
      return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }

    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
    }

    return this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
  }

  getTargetHeatingCoolingState(): number {
    this.platform.log.debug(this.constructor.name, 'getTargetHeatingCoolingState');

    const state: boolean = this.platform.service.getPowerState();

    if (!state) {
      return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    }

    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      return this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
    }

    return this.platform.Characteristic.TargetHeatingCoolingState.COOL;
  }

  getTargetTemperature(): number {
    this.platform.log.debug(this.constructor.name, 'getTargetTemperature');

    return this.platform.service.getSetPointTemperature(this.platformAccessory.context.zone);
  }

  async setTargetHeatingCoolingState(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setTargetHeatingCoolingState', value);

    if (this.platform.service.getOperatingMode() !== OperatingModes.EVAPORATIVE_COOLING &&
        this.platform.service.getFanState() &&
        value === this.platform.Characteristic.TargetHeatingCoolingState.OFF) {
      return;
    }

    if (value === this.platform.Characteristic.TargetHeatingCoolingState.OFF) {
      await this.platform.service.setPowerState(false);
      return;
    }

    if (value === this.platform.Characteristic.TargetHeatingCoolingState.HEAT) {
      await this.platform.service.setFanState(false);
      await this.platform.service.setOperatingMode(OperatingModes.HEATING);
      await this.platform.service.setPowerState(true);
      return;
    }

    if (value === this.platform.Characteristic.TargetHeatingCoolingState.COOL) {
      if (this.platform.service.getHasCooler()) {
        await this.platform.service.setFanState(false);
        await this.platform.service.setOperatingMode(OperatingModes.COOLING);
        await this.platform.service.setPowerState(true);
      } else {
        await this.platform.service.setOperatingMode(OperatingModes.EVAPORATIVE_COOLING);
        await this.platform.service.setPowerState(true);
      }
      return;
    }

    if (value === this.platform.Characteristic.TargetHeatingCoolingState.AUTO) {
      await this.platform.service.setPowerState(true);
      if (this.platform.service.getOperatingMode() !== OperatingModes.EVAPORATIVE_COOLING) {
        await this.platform.service.setControlMode(ControlModes.AUTO, this.platformAccessory.context.zone);
        await this.platform.service.setScheduleOverride(ScheduleOverrideModes.NONE, this.platformAccessory.context.zone);  
      } else {
        await this.platform.service.setControlMode(ControlModes.AUTO);
      }
      // Force update values so mode switches back to correct mode
      setTimeout(this.updateValues.bind(this), 1000);
    }
  }

  async setTargetTemperature(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setTargetTemperature', value);

    if (this.getTargetTemperature() === value) {
      return;
    }

    if (this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING && this.platform.settings.setAutoOperatingState) {
      await this.platform.service.setControlMode(ControlModes.AUTO);
    }

    await this.platform.service.setSetPointTemperature(value, this.platformAccessory.context.zone);
  }

  updateValues(): void {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    super.updateValues();

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .updateValue(this.getCurrentHeatingCoolingState());

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .updateValue(this.getTargetHeatingCoolingState());

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .updateValue(this.getTargetTemperature());
  }
}