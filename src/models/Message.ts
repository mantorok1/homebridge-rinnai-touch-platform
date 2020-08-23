
import { Status } from './Status';

export class Message {
  private _sequence: number | undefined;
  private _status: Status | undefined;

  constructor(message: Buffer | string) {
    try {
      message = (message instanceof Buffer)
        ? message.toString()
        : message;

      if (message.substr(0, 1) !== 'N') {
        return;
      }
  
      const start = message.lastIndexOf('[') - 6;
      if (start < 0) {
        return;
      }
  
      this._sequence = parseInt(message.substr(start, 6));
      this._status = new Status(message.substr(start + 6));
    } catch {
      this._sequence = undefined;
      this._status = undefined;
    }
  }

  get sequence(): number | undefined {
    return this._sequence;
  }

  get status(): Status | undefined {
    return this._status;
  }

  get isValid(): boolean {
    return this._sequence !== undefined && this._sequence !== 0 && this._status !== undefined;
  }

  toString(): string {
    return this.isValid
      ? `${this._sequence}:${this._status?.toString()}`
      : 'invalid';
  }
}