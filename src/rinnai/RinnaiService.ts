import events = require('events');

import { RinnaiTouchPlatform } from '../platform';
import { StateService } from './StateService';
import { Status } from '../models/Status';
import { Command } from '../models/Command';

export enum Modes {
  HEAT, COOL, EVAP,
}

export enum ControlModes {
  MANUAL, AUTO
}

export enum ScheduleOverrideModes {
  NONE, ADVANCE, OPERATION
}

export class RinnaiService extends events.EventEmitter {
  private readonly stateService: StateService;
  private previousMode?: Modes;
  public readonly AllZones = ['U', 'A', 'B', 'C', 'D'];
  private readonly ModeMap: Map<Modes, string> = new Map();

  private readonly states: Record<string, unknown> = {
    ZoneName: { U: 'Common' },
    Zones: [],
    Controllers: [],
    CurrentTemperature: {},
    CurrentTemperatureOverride: {},
  };

  constructor(private readonly platform: RinnaiTouchPlatform) {
    super();
    this.setMaxListeners(20);
    this.stateService = new StateService(platform);

    this.ModeMap.set(Modes.HEAT, 'HGOM');
    this.ModeMap.set(Modes.COOL, 'CGOM');
    this.ModeMap.set(Modes.EVAP, 'ECOM');
  }

  async init(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'init');

    try {
      await new Promise((resolve) => {
        this.platform.session.once('status', resolve);
      });

      const status = this.platform.session.getStatus();
      if (status === undefined) {
        throw new Error('Unable to obtain a valid status from the Rinnai Touch module');
      }

      for (const state of ['HasHeater', 'HasCooler', 'HasEvap', 'HasMultiSP']) {
        this.states[state] = this.stateService.getState(state, status) === 'Y';
      }
      this.stateService.hasMtsp = this.hasMultiSetPoint;

      // Zone Names
      for (const zone of ['A', 'B', 'C', 'D']) {
        const name = <string>this.stateService.getState('ZoneName', status, zone);
        (<Record<string, string>>this.states.ZoneName)[zone] = name.trim() === ''
          ? `Zone ${zone}`
          : name.trim();
      }

      // Controllers
      if (!this.hasMultiSetPoint) {
        this.states.Controllers = ['U'];
      } else {
        for (const zone of ['A', 'B', 'C', 'D']) {
          const installed = this.stateService.getState('ZoneInstalled', status, zone);
          if (installed === 'Y') {
            (<string[]>this.states.Controllers).push(zone);
          }
        }
      }

      this.updateStates();

      this.platform.session.on('status', this.updateAll.bind(this));
    } catch (error) {
      this.platform.log.error(error);
      throw error;
    }
  }

  //
  // Getters
  //
  get hasHeater(): boolean {
    return <boolean>this.states.HasHeater;
  }

  get hasCooler(): boolean {
    return <boolean>this.states.HasCooler;
  }

  get hasEvaporative(): boolean {
    return <boolean>this.states.HasEvap;
  }

  get hasMultiSetPoint():boolean {
    return <boolean>this.states.HasMultiSP;
  }

  get mode(): Modes {
    return <Modes>this.states.Mode;
  }

  get zones(): string[] {
    return <string[]>this.states.Zones;
  }

  get controllers(): string[] {
    return <string[]>this.states.Controllers;
  }

  getZoneName(zone: string): string {
    return (<Record<string, string>>this.states.ZoneName)[zone];
  }

  getState(): boolean {
    return <boolean>this.states.State;
  }

  getFanState(): boolean {
    return <boolean>this.states.FanState;
  }

  getFanSpeed(): number {
    return <number>this.states.FanSpeed;
  }

  getTemperatureUnits(): string {
    return <string>this.states.TemperatureUnits;
  }

  getCurrentTemperature(zone: string): number {
    return (<Record<string, number>>this.states.CurrentTemperatureOverride)[zone] ??
      (<Record<string, number>>this.states.CurrentTemperature)[zone];
  }

  getTargetTemperature(zone = 'U'): number {
    return (<Record<string, number>>this.states.TargetTemperature)[zone];
  }

  getSystemActive(zone: string): boolean {
    return this.hasMultiSetPoint
      ? this.getAutoEnabled(zone)
      : <boolean>this.states.SystemActive;
  }

  getAutoEnabled(zone: string): boolean {
    return (<Record<string, boolean>>this.states.AutoEnabled)[zone];
  }

  getUserEnabled(zone: string): boolean {
    return (<Record<string, boolean>>this.states.UserEnabled)[zone];
  }

  getControlMode(zone = 'U'): ControlModes {
    return (<Record<string, ControlModes>>this.states.ControlMode)[zone];
  }

  getScheduleOverride(zone: string): ScheduleOverrideModes {
    return (<Record<string, ScheduleOverrideModes>>this.states.ScheduleOverride)[zone];
  }

  getPumpState(): boolean {
    return <boolean>this.states.PumpState;
  }

  //
  // Updaters
  //
  updateStates(): void {
    this.platform.log.debug(this.constructor.name, 'updateStates');

    try {
      const status = this.platform.session.getStatus();
      if (status === undefined) {
        throw new Error('Unable to obtain a valid status from the Rinnai Touch module');
      }

      this.updateAll(status);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  updateAll(status: Status): void {
    this.platform.log.debug(this.constructor.name, 'updateAll', 'status');

    const previousStates = JSON.stringify(this.states);

    this.updateMode(status);
    this.updateZones(status);
    this.updateState(status);
    this.updateFanState(status);
    this.updateFanSpeed(status);
    this.updateCurrentTemperature(status);
    this.updateTargetTemperature(status);
    this.updateTemperatureUnits(status);
    this.updateSystemActive(status);
    this.updateAutoEnabled(status);
    this.updateUserEnabled(status);
    this.updateControlMode(status);
    this.updateScheduleOverride(status);
    this.updatePumpState(status);

    if (this.previousMode !== this.mode) {
      if (this.previousMode !== undefined) {
        this.emit('mode', this.mode);
      }
      this.previousMode = this.mode;
    }

    if (previousStates !== JSON.stringify(this.states)) {
      this.emit('updated');
    }
  }

  updateMode(status: Status): void {
    const state = this.stateService.getState('Mode', status);
    let mode: Modes;
    switch (state) {
      case 'H':
        mode = Modes.HEAT;
        break;
      case 'C':
        mode = Modes.COOL;
        break;
      case 'E':
        mode = Modes.EVAP;
        break;
      default:
        throw new Error(`Unsupported mode '${state}'`);
    }

    this.states.Mode = mode;
  }

  updateZones(status: Status): void {
    const zones: string[] = [];
    for (const zone of this.AllZones) {
      const installed = this.stateService.getState('ZoneInstalled', status, zone);
      if (installed === 'Y') {
        zones.push(zone);
      }
    }

    this.states.Zones = zones;
  }

  updateState(status: Status): void {
    const state = this.stateService.getState('State', status);

    this.states.State = state === 'N';
  }

  updateFanState(status: Status): void {
    const state = this.stateService.getState('FanState', status);

    this.states.FanState = this.mode === Modes.EVAP
      ? state === 'N'
      : state === 'Z';
  }

  updateFanSpeed(status: Status): void {
    const state = this.stateService.getState('FanSpeed', status);

    this.states.FanSpeed = parseInt(state ?? '0');
  }

  updateTemperatureUnits(status: Status): void {
    const state = this.stateService.getState('TempUnits', status);

    this.states.TemperatureUnits = state;
  }

  updateCurrentTemperature(status: Status): void {
    const states: Record<string, number> = {};
    for (const zone of this.AllZones) {
      const state = this.stateService.getState('CurrentTemp', status, zone);
      if (state !== '999') {
        states[zone] = parseFloat(state ?? '0') / 10.0;
      }
    }

    this.states.CurrentTemperature = states;
  }

  updateTargetTemperature(status: Status): void {
    const states: Record<string, number> = {};
    const zones = this.hasMultiSetPoint ? this.controllers : ['U'];
    for (const zone of zones) {
      const state = this.stateService.getState('TargetTemp', status, zone);
      if (state) {
        states[zone] = this.mode === Modes.EVAP
          ? Math.round((parseInt(state) - 19) / 15 * 22 + 8) // Convert Comfort level to Temperature
          : parseInt(state);
      }
    }

    this.states.TargetTemperature = states;
  }

  updateSystemActive(status: Status): void {
    if (!this.hasMultiSetPoint) {
      const state = this.stateService.getState('SystemActive', status);
      if (state) {
        this.states.SystemActive = state === 'Y';
      }
    }
  }

  updateAutoEnabled(status: Status): void {
    const states: Record<string, boolean> = {};
    for (const zone of this.AllZones) {
      const state = this.stateService.getState('AutoEnabled', status, zone);
      states[zone] = state === 'Y';
    }

    this.states.AutoEnabled = states;
  }

  updateUserEnabled(status: Status): void {
    const states: Record<string, boolean> = {};
    for (const zone of this.AllZones) {
      const state = this.stateService.getState('UserEnabled', status, zone);
      states[zone] = state === 'Y';
    }

    this.states.UserEnabled = states;
  }

  updateControlMode(status: Status): void {
    const states: Record<string, ControlModes> = {};
    const zones = this.hasMultiSetPoint ? this.controllers : ['U'];
    for (const zone of zones) {
      const state = this.stateService.getState('ControlMode', status, zone);
      if (state !== undefined) {
        states[zone] = state === 'M'
          ? ControlModes.MANUAL
          : ControlModes.AUTO;
      }
    }

    this.states.ControlMode = states;
  }

  updateScheduleOverride(status: Status): void {
    const states: Record<string, ScheduleOverrideModes> = {};
    const zones = this.hasMultiSetPoint ? this.controllers : ['U'];
    for (const zone of zones) {
      const state = this.stateService.getState('ScheduleOverride', status, zone);
      if (state !== undefined) {
        switch (state) {
          case 'N':
            states[zone] = ScheduleOverrideModes.NONE;
            break;
          case 'A':
            states[zone] = ScheduleOverrideModes.ADVANCE;
            break;
          case 'O':
            states[zone] = ScheduleOverrideModes.OPERATION;
            break;
        }
      }
    }

    this.states.ScheduleOverride = states;
  }

  updatePumpState(status: Status): void {
    const state = this.stateService.getState('PumpState', status);

    this.states.PumpState = state === 'N';
  }

  //
  // Setters
  //
  async setMode(value: Modes): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setMode', value);

    try {
      this.updateStates();

      if (this.mode === value) {
        return;
      }

      const path = this.stateService.getPath('Mode');
      const state = this.ModeMap.get(value)?.substr(0, 1);

      await this.sendRequest(path, state);
    } catch (error) {
      this.platform.log.error(error);
    }

  }

  async setState(value: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setState', value);

    try {
      this.updateStates();

      if (this.getState() === value) {
        return;
      }

      const mode = this.getRinnaiTouchMode();
      const path = this.stateService.getPath('State', mode);
      const state = value ? 'N' : 'F';

      await this.sendRequest(path, state);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  async setFanState(value: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanState', value);

    try {
      this.updateStates();

      if (this.getFanState() === value) {
        return;
      }

      const mode = this.getRinnaiTouchMode();
      const path = this.stateService.getPath('FanState', mode);
      const state = value
        ? (this.mode === Modes.EVAP) ? 'N' : 'Z'
        : 'F';

      await this.sendRequest(path, state);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  async setFanSpeed(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanSpeed', value);

    try {
      this.updateStates();

      if (!this.getFanState()) {
        return;
      }

      if (this.getFanSpeed() === value) {
        return;
      }

      const mode = this.getRinnaiTouchMode();
      const path = this.stateService.getPath('FanSpeed', mode);
      const state = value.toString().padStart(2, '0');

      await this.sendRequest(path, state);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  setCurrentTemperatureOverride(value: number, zone: string): void {
    this.platform.log.debug(this.constructor.name, 'setCurrentTemperatureOverride', value, zone);

    const states = <Record<string, number>>this.states.CurrentTemperatureOverride ?? {};
    if (states[zone] !== value) {
      states[zone] = value;
      this.states.CurrentTemperatureOverride = states;
      this.emit('updated');
    }
  }

  async setTargetTemperature(value: number, zone = 'U'): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setTargetTemperature', value, zone);

    try {
      this.updateStates();

      value = Math.round(value);
      if (this.getTargetTemperature(zone) === value) {
        return;
      }

      const mode = this.getRinnaiTouchMode();
      const path = this.stateService.getPath('TargetTemp', mode, zone);
      const state = this.mode === Modes.EVAP
        ? Math.round((1 - ((value - 8) / 22)) * 15 + 19)
        : value;

      await this.sendRequest(path, state.toString().padStart(2, '0'));
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  // Zone Switch
  async setUserEnabled(value: boolean, zone: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setUserEnabled', value, zone);

    try {
      this.updateStates();

      if (this.getUserEnabled(zone) === value) {
        return;
      }

      const mode = this.getRinnaiTouchMode();
      const path = this.stateService.getPath('UserEnabled', mode, zone);
      const state = value ? 'Y' : 'N';

      await this.sendRequest(path, state);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  async setControlMode(value: ControlModes, zone = 'U'): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setControlMode', value, zone);

    try {
      this.updateStates();

      if (this.getControlMode(zone) === value) {
        return;
      }

      const mode = this.getRinnaiTouchMode();
      const path = this.stateService.getPath('ControlMode', mode, zone);
      const state = value === ControlModes.MANUAL ? 'M' : 'A';

      await this.sendRequest(path, state);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  async setScheduleOverride(value: ScheduleOverrideModes, zone: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setScheduleOverride', value, zone);

    try {
      this.updateStates();

      if (this.getScheduleOverride(zone) === value) {
        return;
      }

      const mode = this.getRinnaiTouchMode();
      const path = this.stateService.getPath('ScheduleOverride', mode, zone);
      let state: string;
      switch (value) {
        case ScheduleOverrideModes.NONE:
          state = 'N';
          break;
        case ScheduleOverrideModes.ADVANCE:
          state = 'A';
          break;
        case ScheduleOverrideModes.OPERATION:
          state = 'O';
          break;
      }

      await this.sendRequest(path, state);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  async setPumpState(value: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setPumpState', value);

    try {
      this.updateStates();

      if (this.getPumpState() === value) {
        return;
      }

      const mode = this.getRinnaiTouchMode();
      const path = this.stateService.getPath('PumpState', mode);
      const state = value ? 'N' : 'F';

      await this.sendRequest(path, state);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  //
  // Helpers
  //
  getRinnaiTouchMode(): string | undefined {
    return this.ModeMap.get(this.mode);
  }

  async sendRequest(path?: string, state?: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'sendRequest', path, state);

    if (path === undefined || state === undefined) {
      this.platform.log.warn('Invalid request. Cannot send');
      return;
    }

    try {
      const command = new Command(path, state);
      await this.platform.session.sendCommand(command);
    } catch (error) {
      this.platform.log.error(error);
    }
  }
}