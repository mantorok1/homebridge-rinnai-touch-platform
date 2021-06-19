import { Status } from './Status';

export enum Commands {
  Ping,
  Boot,
  OperatingMode,
  OperatingState,
  SetDayAndTime,
  SaveDayAndTime,
  PowerState,
  FanState,
  FanSpeed,
  PumpState,
  UserEnabled,
  ControlMode,
  SetPointTemperature,
  ScheduleOverride,
}

export class Command {
  private readonly command: Commands;
  private readonly zone: string;
  private readonly states?: string[];

  constructor(command: {command: Commands, zone?: string, state?: string, states?: string[]}) {

    this.command = command.command;
    this.zone = command.zone ?? '';
    this.states = command.state === undefined ? command.states : [command.state];

    // Validate
    switch(this.command) {
      case Commands.Ping:
      case Commands.Boot:
        return;
      case Commands.SetDayAndTime:
        if (this.states === undefined || this.states.length !== 2) {
          throw new Error(`${Commands[this.command]} requires 2 values`);
        }
        break;
      default:
        if (this.states === undefined) {
          throw new Error(`${Commands[this.command]} requires 1 value`);
        }
    }
  }

  get isPing(): boolean {
    return this.command === Commands.Ping;
  }

  get isBoot(): boolean {
    return this.command === Commands.Boot;
  }

  toString(): string {
    if (this.isPing || this.isBoot) {
      return Commands[this.command];
    }
    return `Set ${Commands[this.command]} to '${this.states}'` +
      (this.zone === '' ? '' : ` for zone '${this.zone}'`);
  }

  toJson(status: Status): Record<string, Record<string, Record<string, string>>> | undefined {
    if (this.isPing || this.isBoot) {
      return;
    }

    const group1 = this.getGroup1(status);
    const group2 = this.getGroup2(status);
    const commands = this.getCommands(status);

    if (group1 === undefined || group2 === undefined || commands === undefined) {
      return;
    }

    if (status.getStateByPath({group1: group1, group2: group2, command: commands[0]}) === undefined) {
      return;
    }

    const json = {};
    json[group1] = {};
    json[group1][group2] = {};
    for(let i = 0; i < commands.length; i++) {
      json[group1][group2][commands[i]] = this.states![i];
    }

    return json;
  }

  getGroup1(status: Status): string | undefined {
    switch(this.command) {
      case Commands.OperatingMode:
      case Commands.OperatingState:
      case Commands.SetDayAndTime:
      case Commands.SaveDayAndTime:
        return 'SYST';
      default:
        return status.mode;
    }
  }

  getGroup2(status: Status): string | undefined {
    switch(this.command) {
      case Commands.OperatingMode:
      case Commands.OperatingState:
        return 'OSS';
      case Commands.SetDayAndTime:
      case Commands.SaveDayAndTime:
        return 'STM';
      case Commands.PowerState:
      case Commands.FanState:
      case Commands.FanSpeed:
        return status.modeEvap ? 'GSO' : 'OOP';
      case Commands.PumpState:
        return status.modeEvap ? 'GSO' : undefined;
      case Commands.UserEnabled:
        return status.modeEvap ? 'GSO' : `Z${this.zone}O`;
      case Commands.ControlMode:
      case Commands.SetPointTemperature:
        return status.modeEvap
          ? 'GSO'
          : status.hasMultiSetPoint ? `Z${this.zone}O` : 'GSO';
      case Commands.ScheduleOverride:
        return status.modeEvap
          ? undefined
          : status.hasMultiSetPoint ? `Z${this.zone}O` : 'GSO';
      default:
        throw new Error(`No group2 defined for Command ${Commands[this.command]}`);
    }
  }

  getCommands(status: Status): string[] | undefined {
    switch(this.command) {
      case Commands.OperatingMode:
        return ['MD'];
      case Commands.OperatingState:
        return ['ST'];
      case Commands.SetDayAndTime:
        return ['DY', 'TM'];
      case Commands.SaveDayAndTime:
        return ['SV'];
      case Commands.PowerState:
        return status.modeEvap ? ['SW'] : ['ST'];
      case Commands.FanState:
        return status.modeEvap ? ['FS'] : ['ST'];
      case Commands.FanSpeed:
        return ['FL'];
      case Commands.PumpState:
        return status.modeEvap ? ['PS'] : undefined;
      case Commands.UserEnabled:
        return status.modeEvap ? [`Z${this.zone}UE`] : ['UE'];
      case Commands.ControlMode:
        return ['OP'];
      case Commands.SetPointTemperature:
        return ['SP'];
      case Commands.ScheduleOverride:
        return status.modeEvap ? undefined : ['AO'];
      default:
        throw new Error(`No command(s) defined for Command ${Commands[this.command]}`);
    }
  }
}