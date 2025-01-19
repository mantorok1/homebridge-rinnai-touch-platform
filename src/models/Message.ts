export class Message {
  private _sequence: number | undefined;
  private _status: string | undefined;

  constructor(message: Buffer | string) {
    try {
      const messageString = (message instanceof Buffer)
        ? message.toString()
        : message as string;

      if (messageString.substring(0, 1) !== 'N') {
        return;
      }
  
      const start = messageString.lastIndexOf('[') - 6;
      if (start < 0) {
        return;
      }
  
      this._sequence = parseInt(messageString.substring(start, start + 6));
      this._status = messageString.substring(start + 6);
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