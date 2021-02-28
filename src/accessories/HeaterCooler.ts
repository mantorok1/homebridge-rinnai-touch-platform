import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { OperatingModes, ControlModes } from '../rinnai/RinnaiService';
import { ThermostatBase } from './ThermostatBase';

export class HeaterCooler extends ThermostatBase {
  private switching = false;

  constructor(
    platform: RinnaiTouchPlatform,
    platformAccessory: PlatformAccessory,
  ) {
    super(platform, platformAccessory);

    const service = this.platformAccessory.getService(this.platform.Service.HeaterCooler);
    if (service) {
      this.service = service;
      this.initialiseAutoMode();
    } else {
      this.service = this.platformAccessory.addService(this.platform.Service.HeaterCooler, platformAccessory.displayName);
      this.initialiseService();
    }

    this.setEventHandlers();
  }

  private autoModeEnabled(): boolean {
    this.platform.log.debug(this.constructor.name, 'autoModeEnabled');

    return this.platform.settings.showAuto &&
      this.platform.service.getHasHeater() &&
      this.platform.service.getHasCooler() &&
      (
        this.platform.service.getHasMultiSetPoint() ||
        this.platformAccessory.context.zone === 'U'
      );
  }

  initialiseAutoMode() {
    this.platform.log.debug(this.constructor.name, 'initialiseService');

    const validStates = this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .props.validValues ?? [];

    if (this.platform.settings.showAuto) {
      if (!validStates.includes(this.platform.Characteristic.TargetHeaterCoolerState.AUTO)) {
        const validValues = validStates.concat(this.platform.Characteristic.TargetHeaterCoolerState.AUTO);
        this.service
          .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
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
    } else {
      if (validStates.includes(this.platform.Characteristic.TargetHeaterCoolerState.AUTO)) {
        const validValues = validStates.filter(value => value !== this.platform.Characteristic.TargetHeaterCoolerState.AUTO);
        this.service
          .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
          .setProps({
            minValue: Math.min(...validValues),
            maxValue: Math.max(...validValues),
            validValues: validValues,
          }); 
      }
    }
  }

  initialiseService(): void {
    this.platform.log.debug(this.constructor.name, 'initialiseService');

    let validStates: number[] = this.getValidCurrentHeaterCoolerStates();
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .setProps({
        minValue: Math.min(...validStates),
        maxValue: Math.max(...validStates),
        validValues: validStates,
      });

    validStates = this.getValidTargetHeaterCoolerStates();
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .setProps({
        minValue: Math.min(...validStates),
        maxValue: Math.max(...validStates),
        validValues: validStates,
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

  getValidCurrentHeaterCoolerStates(): number[] {
    this.platform.log.debug(this.constructor.name, 'getValidCurrentHeaterCoolerStates');

    const validStates = [this.platform.Characteristic.CurrentHeaterCoolerState.IDLE];
    if (this.platform.service.getHasHeater()) {
      validStates.push(this.platform.Characteristic.CurrentHeaterCoolerState.HEATING);
    }
    if (this.platform.service.getHasCooler() || this.platform.service.getHasEvaporative()) {
      validStates.push(this.platform.Characteristic.CurrentHeaterCoolerState.COOLING);
    }
    return validStates;
  }

  getValidTargetHeaterCoolerStates(): number[] {
    this.platform.log.debug(this.constructor.name, 'getValidTargetHeaterCoolerStates');

    const validStates: number[] = [];
    if (this.autoModeEnabled()) {
      validStates.push(this.platform.Characteristic.TargetHeaterCoolerState.AUTO);
    }
    if (this.platform.service.getHasHeater()) {
      validStates.push(this.platform.Characteristic.TargetHeaterCoolerState.HEAT);
    }
    if (this.platform.service.getHasCooler() || this.platform.service.getHasEvaporative()) {
      validStates.push(this.platform.Characteristic.TargetHeaterCoolerState.COOL);
    }

    return validStates;
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');

    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .on('get', this.getCharacteristicValue.bind(this, this.getActive.bind(this), 'Active'))
      .on('set', this.setCharacteristicValue.bind(this, this.setActive.bind(this), 'Active'));

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .on('get', this.getCharacteristicValue.bind(this, this.getCurrentHeaterCoolerState.bind(this), 'CurrentHeaterCoolerState'));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .on('get', this.getCharacteristicValue.bind(this, this.getTargetHeaterCoolerState.bind(this), 'TargetHeaterCoolerState'))
      .on('set', this.setCharacteristicValue.bind(this, this.setTargetHeaterCoolerState.bind(this), 'TargetHeaterCoolerState'));

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

  getActive(): number {
    this.platform.log.debug(this.constructor.name, 'getActive');

    let state = this.platform.service.getHasMultiSetPoint() || this.platformAccessory.context.zone === 'U'
      ? this.platform.service.getPowerState()
      : this.platform.service.getUserEnabled(this.platformAccessory.context.zone);

    if (this.platform.settings.seperateFanZoneSwitches && this.platform.service.getFanState()) {
      state = false;
    }

    return state
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;
  }

  getCurrentHeaterCoolerState(): number {
    this.platform.log.debug(this.constructor.name, 'getCurrentHeaterCoolerState');

    const state = this.platform.service.getHeaterCoolerActive(this.platformAccessory.context.zone);

    if (!state) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }

    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
    }

    return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
  }

  getTargetHeaterCoolerState(): number {
    this.platform.log.debug(this.constructor.name, 'getTargetHeaterCoolerState');

    if (this.platformAccessory.context.autoMode) {
      return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }

    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
    }

    return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
  }

  getHeatingThresholdTemperature(): number {
    this.platform.log.debug(this.constructor.name, 'getHeatingThresholdTemperature');

    const zone = this.platform.service.getHasMultiSetPoint()
      ? this.platformAccessory.context.zone
      : 'U';

    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING && !this.switching) {
      const setPointTemperature = this.platform.service.getSetPointTemperature(zone);
      if (setPointTemperature !== undefined) {
        this.platformAccessory.context.heatingThresholdTemperature = setPointTemperature;
      }
    }

    return this.platformAccessory.context.heatingThresholdTemperature;
  }

  getCoolingThresholdTemperature(): number {
    this.platform.log.debug(this.constructor.name, 'getCoolingThresholdTemperature');

    const zone = this.platform.service.getHasMultiSetPoint()
      ? this.platformAccessory.context.zone
      : 'U';

    if (this.platform.service.getOperatingMode() === OperatingModes.COOLING && !this.switching) {
      const setPointTemperature = this.platform.service.getSetPointTemperature(zone);
      if (setPointTemperature !== undefined) {
        this.platformAccessory.context.coolingThresholdTemperature = setPointTemperature;
      }
    }

    return this.platformAccessory.context.coolingThresholdTemperature;
  }

  async setActive(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setActive', value);

    if (!this.platform.service.getHasMultiSetPoint() && this.platformAccessory.context.zone !== 'U') {
      if (!this.platform.service.getPowerState() && !this.platform.service.getFanState()) {
        await this.platform.service.setPowerState(true);
      }
      await this.platform.service.setUserEnabled(
        value === this.platform.Characteristic.Active.ACTIVE,
        this.platformAccessory.context.zone,
      );
      return;
    }

    if (this.platform.service.getOperatingMode() !== OperatingModes.EVAPORATIVE_COOLING &&
        this.platform.service.getFanState() &&
        value === this.platform.Characteristic.Active.INACTIVE) {
      return;
    }

    if (value === this.platform.Characteristic.Active.INACTIVE) {
      await this.platform.service.setPowerState(false);
      return;
    }

    if (this.platform.service.getOperatingMode() !== OperatingModes.EVAPORATIVE_COOLING) {
      await this.platform.service.setFanState(false);
    }   
    await this.platform.service.setPowerState(true);
  }

  async setTargetHeaterCoolerState(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setTargetHeaterCoolerState', value);

    this.platformAccessory.context.autoMode = false;

    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        await this.platform.service.setOperatingMode(OperatingModes.HEATING);
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        if (this.platform.service.getHasCooler()) {
          await this.platform.service.setOperatingMode(OperatingModes.COOLING);
        } else {
          await this.platform.service.setOperatingMode(OperatingModes.EVAPORATIVE_COOLING);
        }
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        this.platformAccessory.context.autoMode = true;
        if (this.platform.service.getPowerState()) {
          await this.platform.service.setControlMode(ControlModes.MANUAL);
          await this.autoModeHandler();
        }
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
    
    if (this.platform.service.getPowerState()) {
      if (this.platform.service.getControlMode() !== ControlModes.MANUAL) {
        this.platform.log.warn('AUTO mode cancelled as the the controller is not in Manual operation');
        return false;
      }
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
        this.switchModes(OperatingModes.COOLING, this.platformAccessory.context.coolingThresholdTemperature!);
      }
    } else { // COOLING
      if (temperature! < this.platformAccessory.context.heatingThresholdTemperature) {
        this.switchModes(OperatingModes.HEATING, this.platformAccessory.context.heatingThresholdTemperature!);
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

  async setHeatingThresholdTemperature(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setHeatingThresholdTemperature', value);

    if (this.platformAccessory.context.autoMode) {
      this.platformAccessory.context.heatingThresholdTemperature = value;
    }

    if (this.switching) {
      return;
    }

    const zone = this.platform.service.getHasMultiSetPoint()
      ? this.platformAccessory.context.zone
      : 'U';

    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      await this.platform.service.setSetPointTemperature(value, zone);
    }
    await this.autoModeHandler();
  }

  async setCoolingThresholdTemperature(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setCoolingThresholdTemperature', value);

    if (this.platformAccessory.context.autoMode) {
      this.platformAccessory.context.coolingThresholdTemperature = value;
    }

    if (this.switching) {
      return;
    }

    const zone = this.platform.service.getHasMultiSetPoint()
      ? this.platformAccessory.context.zone
      : 'U';

    if (this.platform.service.getOperatingMode() === OperatingModes.COOLING) {
      await this.platform.service.setSetPointTemperature(value, zone);
    }
    await this.autoModeHandler();
  }

  updateValues(): void {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    super.updateValues();

    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .updateValue(this.getActive());

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .updateValue(this.getCurrentHeaterCoolerState());

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .updateValue(this.getTargetHeaterCoolerState());

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .updateValue(this.getHeatingThresholdTemperature());

    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .updateValue(this.getCoolingThresholdTemperature());
  }
}