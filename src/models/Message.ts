export class Message {
  private _sequence: number | undefined;
  private _status: string | undefined;

  constructor(message: Buffer | string) {
    try {
      message = (message instanceof Buffer)
        ? message.toString()
        : message;

      if (message.substring(0, 1) !== 'N') {
        return;
      }
  
      const start = message.lastIndexOf('[') - 6;
      if (start < 0) {
        return;
      }
  
      this._sequence = parseInt(message.substring(start, start + 6));
      this._status = message.substring(start + 6);
    } catch {
      this._sequence = undefined;
      this._status = undefined;
    }
  }

  get sequence(): number | undefined {
    return this._sequence;
  }

  get status(): string | undefined {
    return this._status;
  }

  get isValid(): boolean {
    return this._sequence !== undefined && this._status !== undefined;
  }

  toString(): string {
    return this.isValid
      ? `${this._sequence}:${this._status}`
      : 'invalid';
  }
}