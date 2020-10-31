import { Status } from './Status';

export class Fault {
  private readonly _detected: boolean;
  private readonly _applicanceType?: string;
  private readonly _unit?: string;
  private readonly _severity?: string;
  private readonly _code?: string;

  constructor(status: Status) {
    this._detected = status.getState('SYST', 'FLT', 'AV') === 'Y';
    switch(status.getState('SYST', 'FLT', 'GP')) {
      case 'H':
        this._applicanceType = 'Heater';
        break;
      case 'C':
        this._applicanceType = 'Add-On Cooler';
        break;
      case 'E':
        this._applicanceType = 'Evaporative Cooler';
        break;
      case 'R':
        this._applicanceType = 'Reverse Cycle';
        break;
      case 'N':
        this._applicanceType = 'Controlling Device';
        break;
    }
    this._unit = status.getState('SYST', 'FLT', 'UT');
    switch(status.getState('SYST', 'FLT', 'TP')) {
      case 'M':
        this._severity = 'Minor';
        break;
      case 'B':
        this._severity = 'Busy';
        break;
      case 'L':
        this._severity = 'Lockout';
        break;
    }
    this._code = status.getState('SYST', 'FLT', 'CD');
  }

  get detected(): boolean {
    return this._detected;
  }

  toString(): string {
    return this._detected
      ? `Fault in ${this._applicanceType} detected [Unit: ${this._unit}, Severity: ${this._severity}, Code: ${this._code}]`
      : 'No fault detected';
  }
}