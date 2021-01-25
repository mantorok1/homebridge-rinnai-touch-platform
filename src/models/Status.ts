export enum States {
  HasMultiSetPoint,
  TemperatureUnits,
  ZoneName,
  HasHeater,
  HasCooler,
  HasEvaporative,
  Day,
  Time,
  OperatingMode,
  OperatingState,
  FaultDetected,
  FaultApplianceType,
  FaultUnit,
  FaultSeverity,
  FaultCode,
  SetDay,
  SetTime,
  SaveDayAndTime,
  
  ZoneInstalled,
  PowerState,
  FanState,
  FanSpeed,
  PumpState,
  UserEnabled,
  ControlMode,  // Auto, Manual
  SetPointTemperature,
  ScheduleOverride,  // None, Advance, Operation
  AutoEnabled,
  MeasuredTemperature,
  SchedulePeriod,  // Wake, Leave, Return, Presleep, Sleep  
}

type StatePath = {
  group1: string,
  group2: string,
  command: string
}

export class Status {
  private modeMap = {
    H: 'HGOM',
    C: 'CGOM',
    E: 'ECOM',
    R: undefined,
    N: undefined,
  };

  private _status: Record<string, Record<string, Record<string, string>>> = {};
  private _mode?: string;
  private _hasMultiSetPoint?: boolean

  update(status: string) {
    const json = JSON.parse(status);
    for(let i = 0; i < json.length; i++) {
      const key = Object.keys(json[i])[0];
      this._status[key] = json[i][key];
    }
    // Update mode
    const mode = this.getState(States.OperatingMode);
    if (mode !== undefined && mode !== this.mode?.substr(0, 1)) {
      this._mode = this.modeMap[mode];
    }
  }

  get mode(): string | undefined {
    return this._mode;
  }

  get modeEvap(): boolean {
    return this.mode === this.modeMap['E'];
  }

  get hasMultiSetPoint() : boolean {
    if (this._hasMultiSetPoint === undefined) {
      this._hasMultiSetPoint = this.getState(States.HasMultiSetPoint) === 'Y';
    }
    return this._hasMultiSetPoint;
  }

  hasStates(states: Record<string, Record<string, Record<string, string>>>): boolean {
    for(const group1 in states) {
      for(const group2 in states[group1]) {
        for(const command in states[group1][group2]) {
          if (this.getStateByPath({group1: group1, group2: group2, command: command}) !== states[group1][group2][command]) {
            return false;
          }
        }
      }
    }
    return true;
  }

  toString(): string {
    return JSON.stringify(this._status);
  }

  getStateByPath(path: StatePath): string | undefined {
    return this._status[path.group1]?.[path.group2]?.[path.command];
  }

  getState(state: States, zone?: string): string | undefined {
    const group1 = this.getStateGroup1(state);
    const group2 = this.getStateGroup2(state, zone);
    const command = this.getStateCommand(state, zone);

    if (group1 !== undefined && group2 !== undefined && command !== undefined) {
      return this.getStateByPath({group1: group1, group2: group2, command: command});
    }
  }

  getStateGroup1(state: States): string | undefined {
    switch(state) {
      case States.HasMultiSetPoint:
      case States.TemperatureUnits:
      case States.ZoneName:
      case States.HasHeater:
      case States.HasCooler:
      case States.HasEvaporative:
      case States.Day:
      case States.Time:
      case States.OperatingState:
      case States.OperatingMode:
      case States.FaultDetected:
      case States.FaultApplianceType:
      case States.FaultUnit:
      case States.FaultSeverity:
      case States.FaultCode:
      case States.SetDay:
      case States.SetTime:
      case States.SaveDayAndTime:
        return 'SYST';
      default:
        return this.mode;
    }
  }

  getStateGroup2(state: States, zone?: string): string | undefined {
    switch(state) {
      case States.HasMultiSetPoint:
      case States.TemperatureUnits:
      case States.ZoneName:
        return 'CFG';
      case States.HasHeater:
      case States.HasCooler:
      case States.HasEvaporative:
        return 'AVM';
      case States.Day:
      case States.Time:
      case States.OperatingState:
      case States.OperatingMode:
        return 'OSS';
      case States.FaultDetected:
      case States.FaultApplianceType:
      case States.FaultUnit:
      case States.FaultSeverity:
      case States.FaultCode:
        return 'FLT';
      case States.SetDay:
      case States.SetTime:
      case States.SaveDayAndTime:
        return 'STM';

      case States.ZoneInstalled:
        return 'CFG';
      case States.PowerState:
      case States.FanState:
      case States.FanSpeed:
        return this.modeEvap ? 'GSO' : 'OOP';
      case States.PumpState:
        return this.modeEvap ? 'GSO' : undefined;
      case States.UserEnabled:
        return this.modeEvap ? 'GSO' : `Z${zone}O`;
      case States.ControlMode:
      case States.SetPointTemperature:
        return this.modeEvap
          ? 'GSO'
          : this.hasMultiSetPoint ? `Z${zone}O` : 'GSO';
      case States.ScheduleOverride:
        return this.modeEvap
          ? undefined
          : this.hasMultiSetPoint ? `Z${zone}O` : 'GSO';
      case States.AutoEnabled:
      case States.MeasuredTemperature:
        return this.modeEvap ? 'GSS' : `Z${zone}S`;
      case States.SchedulePeriod:
        return this.modeEvap
          ? undefined
          : this.hasMultiSetPoint ? `Z${zone}S` : 'GSS';
    }
  }

  getStateCommand(state: States, zone?: string): string | undefined {
    switch(state) {
      case States.HasMultiSetPoint:
        return 'MTSP';
      case States.TemperatureUnits:
        return 'TU';
      case States.ZoneName:
        return `Z${zone}`;
      case States.HasHeater:
        return 'HG';
      case States.HasCooler:
        return 'CG';
      case States.HasEvaporative:
        return 'EC';
      case States.OperatingState:
        return 'ST';
      case States.OperatingMode:
        return 'MD';
      case States.FaultDetected:
        return 'AV';
      case States.FaultApplianceType:
        return 'GP';
      case States.FaultUnit:
        return 'UT';
      case States.FaultSeverity:
        return 'TP';
      case States.FaultCode:
        return 'CD';
      case States.Day:
      case States.SetDay:
        return 'DY';
      case States.Time:
      case States.SetTime:
        return 'TM';
      case States.SaveDayAndTime:
        return 'SV';

      case States.ZoneInstalled:
        return `Z${zone}IS`;
      case States.PowerState:
        return this.modeEvap ? 'SW' : 'ST';
      case States.FanState:
        return this.modeEvap ? 'FS' : 'ST';
      case States.FanSpeed:
        return 'FL';
      case States.PumpState:
        return this.modeEvap ? 'PS' : undefined;
      case States.UserEnabled:
        return this.modeEvap ? `Z${zone}UE` : 'UE';
      case States.ControlMode:
        return 'OP';
      case States.SetPointTemperature:
        return 'SP';
      case States.ScheduleOverride:
        return this.modeEvap ? undefined : 'AO';
      case States.AutoEnabled:
        return this.modeEvap ? `Z${zone}AE` : 'AE';
      case States.MeasuredTemperature:
        return 'MT';
      case States.SchedulePeriod:
        return this.modeEvap ? undefined : 'AT';
    }
  }
}