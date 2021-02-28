import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { OperatingModes, ControlModes } from '../rinnai/RinnaiService';
import { ThermostatBase } from './ThermostatBase';

export class Thermostat extends ThermostatBase {
  private switching = false;

  constructor(
    platform: RinnaiTouchPlatform,
    platformAccessory: PlatformAccessory,
  ) {
    super(platform, platformAccessory);

    const service = this.platformAccessory.getService(this.platform.Service.Thermostat);
    if (service) {
      this.service = service;
      this.initialiseAutoMode();
    } else {
      this.service = this.platformAccessory.addService(this.platform.Service.Thermostat, platformAccessory.displayName);
      this.initialiseService();
    }
    
    this.setEventHandlers();
  }

  private autoModeEnabled(): boolean {
    this.platform.log.debug(this.constructor.name, 'autoModeEnabled');

    return this.platform.settings.showAuto &&
      this.platform.service.getHasHeater() &&
      this.platform.service.getHasCooler();
  }

  initialiseAutoMode() {
    this.platform.log.debug(this.constructor.name, 'initialiseService');

    const validStates = this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .props.validValues ?? [];

    if (this.platform.settings.showAuto) {
      if (!validStates.includes(this.platform.Characteristic.TargetHeatingCoolingState.AUTO)) {
        const validValues = validStates.concat(this.platform.Characteristic.TargetHeatingCoolingState.AUTO);
        this.service
          .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
          .setProps({
            minValue: Math.min(...validValues),
            maxValue: Math.max(...validValues),
            validValues: validValues,
          });
      }
        
      if (this.platformAccessory.context.autoMode === undefined) {
        this.platformAccessory.context.autoMode = false;
        this.platformAccessory.context.heatingThresholdTemperature = 22.0;
        this.platformAccessory.context.coolingThresholdTemperature = 28.0;
      }

      this.service
        .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
        .setProps({
          minValue: 8,
          maxValue: 30,
          minStep: 1,
        });

      this.service
        .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
        .setProps({
          minValue: 8,
          maxValue: 30,
          minStep: 1,
        });
    } else {
      if (validStates.includes(this.platform.Characteristic.TargetHeatingCoolingState.AUTO)) {
        const validValues = validStates.filter(value => value !== this.platform.Characteristic.TargetHeatingCoolingState.AUTO);
        this.service
          .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
          .setProps({
            minValue: Math.min(...validValues),
            maxValue: Math.max(...validValues),
            validValues: validValues,
          }); 
      }
    }
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

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: 8,
        maxValue: 30,
        minStep: 1,
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: 8,
        maxValue: 30,
        minStep: 1,
      });

    if (this.platformAccessory.context.autoMode === undefined) {
      this.platformAccessory.context.autoMode = false;
      this.platformAccessory.context.heatingThresholdTemperature = 22.0;
      this.platformAccessory.context.coolingThresholdTemperature = 28.0;

      const setSetPointTemperature = this.platform.service.getSetPointTemperature(this.platformAccessory.context.zone);
      if (setSetPointTemperature === undefined) {
        return;
      }
      if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
        this.platformAccessory.context.heatingThresholdTemperature = setSetPointTemperature;
        this.platformAccessory.context.coolingThresholdTemperature = setSetPointTemperature + 6.0;
      } else {
        this.platformAccessory.context.heatingThresholdTemperature = setSetPointTemperature - 6.0;
        this.platformAccessory.context.coolingThresholdTemperature = setSetPointTemperature;
      }
    }
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
    if (this.autoModeEnabled()) {
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

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .on('get', this.getCharacteristicValue.bind(this, this.getHeatingThresholdTemperature.bind(this), 'HeatingThresholdTemperature'))
      .on('set', this.setCharacteristicValue.bind(this, this.setHeatingThresholdTemperature.bind(this), 'HeatingThresholdTemperature'));

    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .on('get', this.getCharacteristicValue.bind(this, this.getCoolingThresholdTemperature.bind(this), 'CoolingThresholdTemperature'))
      .on('set', this.setCharacteristicValue.bind(this, this.setCoolingThresholdTemperature.bind(this), 'CoolingThresholdTemperature'));

    // Wait 15 seconds before setting the event handlers for AUTO mode
    if (this.autoModeEnabled()) {
      setTimeout(async () => {
        await this.autoModeHandler();
        this.platform.temperatureService.on('temperature_change', async () => {
          await this.autoModeHandler();
        });
  
        this.platform.service.session.on('status', () => {
          if (!this.platformAccessory.context.autoMode) {
            return;
          }
      
          if (!this.autoModeIsValid()) {
            this.platformAccessory.context.autoMode = false;
            setTimeout(this.updateValues.bind(this), 1000);
            return;
          }
        });
      }, 15000);
    }
  }

  getCurrentHeatingCoolingState(): number {
    this.platform.log.debug(this.constructor.name, 'getCurrentHeatingCoolingState');

    const state = this.platform.service.getHeaterCoolerActive(this.platformAccessory.context.zone);

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

    if (!this.platform.service.getPowerState()) {
      return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    }

    if (this.platformAccessory.context.autoMode) {
      return this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
    }

    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      return this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
    }

    return this.platform.Characteristic.TargetHeatingCoolingState.COOL;
  }

  getTargetTemperature(): number {
    this.platform.log.debug(this.constructor.name, 'getTargetTemperature');

    return this.platform.service.getSetPointTemperature(this.platformAccessory.context.zone) ?? 8;
  }

  getHeatingThresholdTemperature(): number {
    this.platform.log.debug(this.constructor.name, 'getHeatingThresholdTemperature');

    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING && !this.switching) {
      const setPointTemperature = this.platform.service.getSetPointTemperature(this.platformAccessory.context.zone);
      if (setPointTemperature !== undefined) {
        this.platformAccessory.context.heatingThresholdTemperature = setPointTemperature;
      }
    }

    return this.platformAccessory.context.heatingThresholdTemperature;
  }

  getCoolingThresholdTemperature(): number {
    this.platform.log.debug(this.constructor.name, 'getCoolingThresholdTemperature');

    if (this.platform.service.getOperatingMode() === OperatingModes.COOLING && !this.switching) {
      const setPointTemperature = this.platform.service.getSetPointTemperature(this.platformAccessory.context.zone);
      if (setPointTemperature !== undefined) {
        this.platformAccessory.context.coolingThresholdTemperature = setPointTemperature;
      }
    }

    return this.platformAccessory.context.coolingThresholdTemperature;
  }

  async setTargetHeatingCoolingState(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setTargetHeatingCoolingState', value);

    this.platformAccessory.context.autoMode = false;

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
      await this.platform.service.setFanState(false);
      await this.platform.service.setPowerState(true);
      await this.platform.service.setControlMode(ControlModes.MANUAL);

      this.platformAccessory.context.autoMode = true;
      await this.autoModeHandler();
    }
  }

  autoModeIsValid(): boolean {
    this.platform.log.debug(this.constructor.name, 'autoModeIsValid');

    if (this.switching) {
      return true;
    }

    const temperature = this.platform.temperatureService.getTemperature(this.platformAccessory.context.zone);
    if (temperature === undefined) {
      this.platform.log.warn('AUTO mode cancelled as the current temperature cannot be determined');
      return false;
    }
    
    if (!this.platform.service.getPowerState()) {
      this.platform.log.warn('AUTO mode cancelled as the power is Off');
      return false;
    }
    
    if (this.platform.service.getControlMode() !== ControlModes.MANUAL) {
      this.platform.log.warn('AUTO mode cancelled as the the controller is not in Manual operation');
      return false;
    }

    if (this.getHeatingThresholdTemperature() >= this.getCoolingThresholdTemperature()) {
      this.platform.log.warn('AUTO mode cancelled as the Heat temperature must be less than the Cool temperature');
      return false;
    }

    return true;
  }

  async autoModeHandler(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'autoModeHandler');

    if (!this.platformAccessory.context.autoMode) {
      return;
    }

    if (!this.autoModeIsValid()) {
      this.platformAccessory.context.autoMode = false;
      setTimeout(this.updateValues.bind(this), 1000);
      return;
    }

    const temperature = this.platform.temperatureService.getTemperature(this.platformAccessory.context.zone);
    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      if (temperature! > this.platformAccessory.context.coolingThresholdTemperature) {
        await this.switchModes(OperatingModes.COOLING, this.platformAccessory.context.coolingThresholdTemperature!);
      }
    } else { // COOLING
      if (temperature! < this.platformAccessory.context.heatingThresholdTemperature) {
        await this.switchModes(OperatingModes.HEATING, this.platformAccessory.context.heatingThresholdTemperature!);
      }
    }
  }

  async switchModes(mode: OperatingModes, temperature: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'switchModes', mode, temperature);

    this.switching = true;
    await this.platform.service.setOperatingMode(mode);
    await this.platform.service.setControlMode(ControlModes.MANUAL);
    await this.platform.service.setSetPointTemperature(temperature, this.platformAccessory.context.zone);
    this.switching = false;
  }

  async setTargetTemperature(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setTargetTemperature', value);

    if (this.getTargetTemperature() === value) {
      return;
    }

    if (this.platformAccessory.context.autoMode) {
      return;
    }

    if (this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING && this.platform.settings.setAutoOperatingState) {
      await this.platform.service.setControlMode(ControlModes.AUTO);
    }

    await this.platform.service.setSetPointTemperature(value, this.platformAccessory.context.zone);
  }

  async setHeatingThresholdTemperature(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setHeatingThresholdTemperature', value);

    if (!this.platformAccessory.context.autoMode || this.switching) {
      return;
    }

    this.platformAccessory.context.heatingThresholdTemperature = value;
    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      await this.platform.service.setSetPointTemperature(value, this.platformAccessory.context.zone);
    }
    await this.autoModeHandler();
  }

  async setCoolingThresholdTemperature(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setCoolingThresholdTemperature', value);

    if (!this.platformAccessory.context.autoMode || this.switching) {
      return;
    }

    this.platformAccessory.context.coolingThresholdTemperature = value;
    if (this.platform.service.getOperatingMode() === OperatingModes.COOLING) {
      await this.platform.service.setSetPointTemperature(value, this.platformAccessory.context.zone);
    }
    await this.autoModeHandler();
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

    if (this.platformAccessory.context.autoMode) {
      this.service
        .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
        .updateValue(this.getHeatingThresholdTemperature());
    
      this.service
        .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
        .updateValue(this.getCoolingThresholdTemperature());
    } else {
      this.service
        .getCharacteristic(this.platform.Characteristic.TargetTemperature)
        .updateValue(this.getTargetTemperature());
    }
  }
}