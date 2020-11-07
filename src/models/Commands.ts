type RinnaiCommand = Record<string, Record<string, Record<string, string>>>

export class Commands {
  private readonly _commands: RinnaiCommand;

  constructor(commands?: RinnaiCommand) {
    this._commands = commands ?? {};
  }

  static fromJsonString(commands: string): Commands | undefined {
    try {
      return new Commands(JSON.parse(commands));
    } catch {
      return;
    }
  }

  static fromPath(path: string, state: string): Commands | undefined {
    try {
      const commands: RinnaiCommand = {};
      const tiers = path.split('.');
      commands[tiers[0]] = {};
      commands[tiers[0]][tiers[1]] = {};
      commands[tiers[0]][tiers[1]][tiers[2]] = state;
      return new Commands(commands);
    } catch {
      return;
    }
  }

  static fromPaths(paths: string[], states: string[]): Commands | undefined {
    try {
      const commands: RinnaiCommand = {};
      const tiers = paths[0].split('.');
      commands[tiers[0]] = {};
      commands[tiers[0]][tiers[1]] = {};
      for(let i = 0; i < paths.length; i++) {
        const command = paths[i].split('.')[2];
        const state = states[i];
        commands[tiers[0]][tiers[1]][command] = state;
      }
      return new Commands(commands);
    } catch {
      return;
    }
  }

  get group1(): string {
    return Object.keys(this._commands)[0];
  }

  get group2(): string {
    return Object.keys(this._commands[this.group1])[0];
  }

  get commands(): string[] {
    return Object.keys(this._commands[this.group1][this.group2]);
  }

  get states(): string[] {
    return Object.values(this._commands[this.group1][this.group2]);
  }

  get isPing(): boolean {
    return Object.keys(this._commands).length === 0;
  }

  toString(): string {
    return this.isPing
      ? ''
      : JSON.stringify(this._commands);
  }

  toCommand(sequence: number): string {
    const sequenceNumber: string = sequence.toString().padStart(6, '0');

    return `N${sequenceNumber}${this.toString()}`;
  }
}