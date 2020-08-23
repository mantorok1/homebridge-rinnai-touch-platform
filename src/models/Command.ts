
export class Command {
  private _currentSequence: number;
  private _path: string[] = ['', '', ''];
  private _state = '';
  
  constructor(currentSequence?: number, path?: string, state?: string, command?: string) {
    this._currentSequence = currentSequence ?? 1;
    if (path !== undefined && state !== undefined) {
      this._path = path.split('.');
      this._state = state;
    } else if (command !== undefined) {
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

  private get nextSequence(): number {
    let nextSequence = (this._currentSequence + 1) % 255;
    if (nextSequence === 0) {
      nextSequence = 1;
    }
    return nextSequence;
  }

  toString(): string {
    const sequenceNumber: string = this.nextSequence.toString().padStart(6, '0');

    return `N${sequenceNumber}{"${this._path[0]}":{"${this._path[1]}":{"${this._path[2]}":"${this._state}"}}}`;  
  }
}