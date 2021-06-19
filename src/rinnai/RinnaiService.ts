import events = require('events');

import { ILogging } from './ILogging';
import { Status, States } from '../models/Status';
import { Fault } from '../models/Fault';
import { RinnaiSession } from './RinnaiSession';
import { Command, Commands } from '../models/Command';

export enum OperatingModes {
  HEATING, COOLING, EVAPORATIVE_COOLING, REVERSE_CYLCE, NONE
}

export enum OperatingStates {
  NORMAL, CLOCK_SETTING, PARAMETER_SETTING, USER_SETTING, PIN_ENTRY
}

export enum ControlModes {
  MANUAL, AUTO
}

export enum ScheduleOverrideModes {
  NONE, ADVANCE, OPERATION
}

export class RinnaiService extends events.EventEmitter {
  private readonly log: ILogging;
  private readonly _session: RinnaiSession;
  private readonly invertComfortLevel: boolean;
  private faultDetected = false;
  private faultMessage?: string;
  public readonly AllZones = ['U', 'A', 'B', 'C', 'D'];
  private readonly days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  constructor(options: {
    log?: ILogging,
    address?: string,
    port?: number,
    showModuleEvents?: boolean,
    showModuleStatus?: boolean,
    invertComfortLevel?: boolean,
    bootTime?: string,
    bootPassword?: string
  } = {}) {
    super();
    this.log = options.log ?? console;
    this.invertComfortLevel = options.invertComfortLevel ?? true;
    this._session = new RinnaiSession({
      log: options.log,
      address: options.address,
      port: options.port,
      showModuleEvents: options.showModuleEvents,
      showModuleStatus: options.showModuleStatus,
      bootTime: options.bootTime,
      bootPassword: options.bootPassword,
    });
  }

  async init(): Promise<void> {
    this.log.debug(this.constructor.name, 'init');

    try {
      await this.session.start();

      // Check that controller is in Normal Operating state
      let operatingState = this.session.status.getState(States.OperatingState);
      while (operatingState !== 'N') {
        this.log.warn('Controller is not in \'Normal\' operating state. Will wait for 1 minute');
        await this.session.delay(60000);
        operatingState = this.session.status.getState(States.OperatingState);
      }

      this.session.on('status', this.handleStatus.bind(this));
    } catch (error) {
      this.log.error(error);
      throw error;
    }
  }

  //
  // Getters
  //

  get session(): RinnaiSession {
    return this._session;
  }

  getHasMultiSetPoint(): boolean {
    return this.session.status.hasMultiSetPoint;
  }

  getTemperatureUnits(): string {
    return this.session.status.getState(States.TemperatureUnits) ?? 'C';
  }

  getZoneName(zone: string): string {
    if (zone === 'U') {
      return 'Common';
    }
    const name = this.session.status.getState(States.ZoneName, zone)?.trim() ?? '';
    return name === '' ? `Zone ${zone}` : name;
  }

  getHasHeater(): boolean {
    return this.session.status.getState(States.HasHeater) === 'Y';
  }

  getHasCooler(): boolean {
    return this.session.status.getState(States.HasCooler) === 'Y';
  }

  getHasEvaporative(): boolean {
    return this.session.status.getState(States.HasEvaporative) === 'Y';
  }

  getOperatingMode(): OperatingModes {
    const mode = this.session.status.getState(States.OperatingMode);
    switch(mode) {
      case 'H':
        return OperatingModes.HEATING;
      case 'C':
        return OperatingModes.COOLING;
      case 'E':
        return OperatingModes.EVAPORATIVE_COOLING;
      case 'R':
        return OperatingModes.REVERSE_CYLCE;
      default:
        return OperatingModes.NONE;
    }
  }

  getOperatingStates(): OperatingStates {
    const mode = this.session.status.getState(States.OperatingState);
    switch(mode) {
      case 'N':
        return OperatingStates.NORMAL;
      case 'C':
        return OperatingStates.CLOCK_SETTING;
      case 'P':
        return OperatingStates.PARAMETER_SETTING;
      case 'U':
        return OperatingStates.USER_SETTING;
      default:
        return OperatingStates.PIN_ENTRY;
    }
  }

  getZoneInstalled(zone: string): boolean {
    return this.session.status.getState(States.ZoneInstalled, zone) === 'Y';
  }

  getZonesInstalled(): string[] {
    const zones: string[] = [];
    for(const zone of this.AllZones) {
      if (this.getZoneInstalled(zone)) {
        zones.push(zone);
      }
    }
    return zones;
  }

  getPowerState(): boolean {
    return this.session.status.getState(States.PowerState) === 'N';
  }

  getFanState(): boolean {
    return this.session.status.modeEvap
      ? this.session.status.getState(States.FanState) === 'N'
      : this.session.status.getState(States.FanState) === 'Z';
  }

  getFanSpeed(): number {
    const speed = this.session.status.getState(States.FanSpeed);
    return speed === undefined
      ? 0.0
      : parseInt(speed);
  }

  getPumpState(): boolean {
    return this.session.status.getState(States.PumpState) === 'N';
  }

  getControlMode(zone?: string): ControlModes {
    const controlMode = this.session.status.getState(States.ControlMode, zone);
    return controlMode === 'M' ? ControlModes.MANUAL : ControlModes.AUTO;
  }

  getSetPointTemperature(zone?: string): number | undefined {
    const temperature = this.session.status.getState(States.SetPointTemperature, zone);
    if (temperature === undefined) {
      return undefined;
    }
    return this.session.status.modeEvap
      ? this.toTemperature(temperature)
      : parseInt(temperature);
  }

  getScheduleOverride(zone?: string): ScheduleOverrideModes {
    const override = this.session.status.getState(States.ScheduleOverride, zone);
    switch(override) {
      case 'N':
        return ScheduleOverrideModes.NONE;
      case 'A':
        return ScheduleOverrideModes.ADVANCE;
      default:
        return ScheduleOverrideModes.OPERATION;
    }
  }

  getHeaterCoolerActive(zone = 'U'): boolean {
    switch (this.getOperatingMode()) {
      case OperatingModes.HEATING:
        return this.getHasMultiSetPoint() || zone !== 'U'
          ? this.session.status.getState(States.AutoEnabled, zone) === 'Y'
          : this.session.status.getState(States.CallingForHeat) === 'Y';
      case OperatingModes.COOLING:
        return this.getHasMultiSetPoint() || zone !== 'U'
          ? this.session.status.getState(States.AutoEnabled, zone) === 'Y'
          : this.session.status.getState(States.CallingForCool) === 'Y';
      case OperatingModes.EVAPORATIVE_COOLING:
        return this.session.status.getState(States.CoolerIsBusy) === 'Y';
      default:
        return false;
    }
  }

  getUserEnabled(zone: string): boolean {
    return this.session.status.getState(States.UserEnabled, zone) === 'Y';
  }

  getMeasuredTemperature(zone: string): number | undefined {
    const temperature = this.session.status.getState(States.MeasuredTemperature, zone);
    if (temperature !== undefined && temperature !== '999') {
      return parseInt(temperature) / 10.0;
    }
  }

  getAutoEnabled(zone: string): boolean {
    return this.session.status.getState(States.AutoEnabled, zone) === 'Y';
  }

  //
  // Setters
  //
  async setOperatingMode(value: OperatingModes): Promise<void> {
    this.log.debug(this.constructor.name, 'setOperatingMode', value);

    try {
      const state = OperatingModes[value].substr(0, 1);
      const command = new Command({command: Commands.OperatingMode, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async setOperatingState(value: OperatingStates): Promise<void> {
    this.log.debug(this.constructor.name, 'setOperatingState', value);

    try {
      const state = OperatingStates[value].substr(0, 1);
      const command = new Command({command: Commands.OperatingState, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async setDayAndTime(): Promise<void> {
    this.log.debug(this.constructor.name, 'setDayAndTime');

    try {
      const now = new Date();
      const day = this.days[now.getDay()];
      const time = now.getHours().toString().padStart(2, '0') + ':'
        + now.getMinutes().toString().padStart(2, '0');

      const states = [day, time];
      const command = new Command({command: Commands.SetDayAndTime, states: states});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async saveDayAndTime(): Promise<void> {
    this.log.debug(this.constructor.name, 'saveDayAndTime');

    try {
      const state = 'Y';
      const command = new Command({command: Commands.SaveDayAndTime, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async setPowerState(value: boolean): Promise<void> {
    this.log.debug(this.constructor.name, 'setPowerState', value);

    try {
      // Don't turn power off if fan is on
      if (value === false && this.getFanState() && this.getOperatingMode() !== OperatingModes.EVAPORATIVE_COOLING) {
        return;
      }

      const state = value ? 'N' : 'F';
      const command = new Command({command: Commands.PowerState, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async setFanState(value: boolean): Promise<void> {
    this.log.debug(this.constructor.name, 'setFanState', value);

    try {
      // Don't turn fan off if power if on
      if (value === false && this.getPowerState() && this.getOperatingMode() !== OperatingModes.EVAPORATIVE_COOLING) {
        return;
      }

      const state = value
        ? this.session.status.modeEvap ? 'N' : 'Z'
        : 'F';
      const command = new Command({command: Commands.FanState, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async setFanSpeed(value: number): Promise<void> {
    this.log.debug(this.constructor.name, 'setFanSpeed', value);

    try {
      const state = value.toString().padStart(2, '0');
      const command = new Command({command: Commands.FanSpeed, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async setSetPointTemperature(value: number, zone = 'U'): Promise<void> {
    this.log.debug(this.constructor.name, 'setSetPointTemperature', value, zone);

    try {
      value = Math.round(value);
      value = this.session.status.modeEvap
        ? this.toComfortLevel(value)
        : this.toSetPointTemperature(value);
      const state = value.toString().padStart(2, '0');
      const command = new Command({command: Commands.SetPointTemperature, zone: zone, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  // Zone Switch
  async setUserEnabled(value: boolean, zone: string): Promise<void> {
    this.log.debug(this.constructor.name, 'setUserEnabled', value, zone);

    try {
      const state = value ? 'Y' : 'N';
      const command = new Command({command: Commands.UserEnabled, zone: zone, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async setControlMode(value: ControlModes, zone = 'U'): Promise<void> {
    this.log.debug(this.constructor.name, 'setControlMode', value, zone);

    try {
      const state = ControlModes[value].substr(0, 1);
      const command = new Command({command: Commands.ControlMode, zone: zone, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async setScheduleOverride(value: ScheduleOverrideModes, zone = 'U'): Promise<void> {
    this.log.debug(this.constructor.name, 'setScheduleOverride', value, zone);

    try {
      const state = ScheduleOverrideModes[value].substr(0, 1);
      const command = new Command({command: Commands.ScheduleOverride, zone: zone, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  async setPumpState(value: boolean): Promise<void> {
    this.log.debug(this.constructor.name, 'setPumpState', value);

    try {
      const state = value ? 'N' : 'F';
      const command = new Command({command: Commands.ScheduleOverride, state: state});
      await this.session.sendCommand(command);
    } catch (error) {
      this.log.error(error);
    }
  }

  //
  // Event Handlers
  //
  handleStatus(status: Status) {
    this.log.debug(this.constructor.name, 'handleStatus', status.toString());

    const fault = new Fault(status);
    if (fault.detected || this.faultDetected) {
      this.faultDetected = fault.detected;
      this.emit('fault', fault);

      const faultMessage = fault.toString();

      if (fault.detected && this.faultMessage !== faultMessage) {
        this.log.warn(faultMessage);
        this.faultMessage = faultMessage;
        return;
      }
  
      if (!fault.detected && this.faultMessage !== undefined) {
        this.log.warn(faultMessage);
        this.faultMessage = undefined;
      }
    }
  }

  //
  // Helpers
  //

  private toComfortLevel(temperature: number): number {
    temperature = Math.min(Math.max(temperature, 8), 30);
    let ratio = (temperature - 8) / 22;
    if (this.invertComfortLevel) {
      ratio = 1 - ratio;
    }
    return Math.round(ratio * 15 + 19);
  }

  private toTemperature(comfortLevel: string): number {
    let ratio = (parseInt(comfortLevel) - 19) / 15;
    if (this.invertComfortLevel) {
      ratio = 1 - ratio;
    }
    return Math.round(ratio * 22 + 8);
  }

  private toSetPointTemperature(temperature: number): number {
    temperature = Math.min(temperature, 30);
    if (temperature < 8) {
      temperature = 0;
    }
    return temperature;
  }
}