export class Command {
  private _path: string[] = ['', '', ''];
  private _state = '';
  
  constructor(path?: string, state?: string, command?: string) {
    if (path !== undefined && state !== undefined) {
      this._path = path.split('.');
      this._state = state;
    } else if (command !== undefined) {
      this._path = [];
      const json = JSON.parse(command);
      this._path.push(Object.keys(json)[0]);
      this._path.push(Object.keys(json[this._path[0]])[0]);
      this._path.push(Object.keys(json[this._path[0]][this._path[1]])[0]);
      this._state = json[this._path[0]][this._path[1]][this._path[2]];
    }
  }

  get group1(): string {
    return this._path[0];
  }

  get group2(): string {
    return this._path[1];
  }

  get command(): string {
    return this._path[2];
  }

  get state(): string {
    return this._state;
  }

  get isPing(): boolean {
    return this._state === '';
  }

  toString(): string {
    return this._state !== ''
      ? `{"${this._path[0]}":{"${this._path[1]}":{"${this._path[2]}":"${this._state}"}}}`
      : '';
  }

  toCommand(sequence: number): string {
    const sequenceNumber: string = sequence.toString().padStart(6, '0');

    return `N${sequenceNumber}${this.toString()}`;
  }
}