
export class Status {
  private _statusString: string | undefined;
  private _statusJson: Record<string, Record<string, Record<string, string>>>[] | undefined;

  constructor(status: string) {
    try {
      this._statusString = status;
      this._statusJson = JSON.parse(status);
      this.validate();
    } catch {
      this._statusString = undefined;
      this._statusJson = undefined;
    }
  }

  get mode(): string | undefined {
    return this._statusJson === undefined
      ? undefined
      : Object.keys(this._statusJson[1])[0];
  }

  get isValid(): boolean {
    return this._statusJson !== undefined;
  }

  getState(group1: string, group2: string, command: string): string | undefined {
    if (this._statusJson === undefined) {
      return undefined;
    }

    const index = (group1 === 'SYST') ? 0 : 1;

    return this._statusJson[index]?.[group1]?.[group2]?.[command];
  }

  hasState(group1: string, group2: string, command: string, state: string): boolean {
    return this.getState(group1, group2, command) === state;
  }

  toString(): string | undefined {
    return this._statusString;
  }

  equals(status?: Status): boolean {
    return this._statusString === status?.toString();
  }

  private validate(): void {
    if (this._statusJson === undefined) {
      return;
    }

    if (this._statusJson.length !== 2) {
      this._statusJson = undefined;
      return;
    }

    if (this._statusJson[0] === undefined || this._statusJson[1] === undefined) {
      this._statusJson = undefined;
    }
  }
}