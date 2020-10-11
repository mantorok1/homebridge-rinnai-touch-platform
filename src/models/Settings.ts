import { PlatformConfig } from 'homebridge';

export type MqttSettings = {
  host: string | undefined,
  port: number | undefined,
  username: string | undefined,
  password: string | undefined,
  topicPrefix: string | undefined,
  formatNative: boolean,
  formatHomeAssistant: boolean,
  formatConnection: boolean,
  publishStatusChanged: boolean,
  publishIntervals: boolean,
  publishFrequency: number,
  publishAll: boolean,
  showMqttEvents: boolean, 
  subscribeTemperature: Record<string, string> | undefined,
}

export class Settings {
  private _mqtt?: MqttSettings;

  constructor(private readonly config: PlatformConfig) {
    if (config.mqtt) {
      const mqtt = <Record<string, string | number | boolean | undefined>>config.mqtt;

      this._mqtt = {
        host: <string>mqtt.host,
        port: <number | undefined>mqtt.port ?? 1883,
        username: <string | undefined>mqtt.username,
        password: <string | undefined>mqtt.password,
        topicPrefix: <string | undefined>mqtt.topicPrefix,
        formatNative: <boolean | undefined>mqtt.formatNative ?? false,
        formatHomeAssistant: <boolean | undefined>mqtt.formatHomeAssistant ?? false,
        formatConnection: <boolean | undefined>mqtt.formatConnection ?? false,
        publishStatusChanged: <boolean | undefined>mqtt.publishStatusChanged ?? false,
        publishIntervals: <boolean | undefined>mqtt.publishIntervals ?? false,
        publishFrequency: <number | undefined>mqtt.publishFrequency ?? 60,
        publishAll: <boolean | undefined>mqtt.publishAll ?? false,
        showMqttEvents: <boolean | undefined>mqtt.showMqttEvents ?? true,
        subscribeTemperature: <Record<string, string> | undefined>mqtt.subscribeTemperature,
      };
    }
  }

  // Getters
  get name(): string {
    return this.config.name ?? 'Rinnai Touch';
  }

  get address(): string | undefined {
    return <string | undefined>this.config.address;
  }

  get port(): number | undefined {
    return <number | undefined>this.config.port;
  }

  get controllerType(): string {
    const controllerType = (<string | undefined>this.config.controllerType)?.substr(0, 1).toUpperCase() ?? 'T';
    return ['T', 'H'].includes(controllerType)
      ? controllerType
      : 'T';
  }

  get zoneType(): string {
    const zoneType = (<string | undefined>this.config.zoneType)?.substr(0, 1).toUpperCase() ?? 'S';
    return ['N', 'S', 'H'].includes(zoneType)
      ? zoneType
      : 'S';
  }

  get showFan(): boolean {
    return <boolean | undefined>this.config.showFan ?? true;
  }

  get showAuto(): boolean {
    return <boolean | undefined>this.config.showAuto ?? true;
  }

  get showAdvanceSwitches(): boolean {
    return <boolean | undefined>this.config.showAdvanceSwitches ?? true;
  }

  get showManualSwitches(): boolean {
    return <boolean | undefined>this.config.showManualSwitches ?? true;
  }

  get showHomebridgeEvents(): boolean {
    return <boolean | undefined>this.config.showHomebridgeEvents ?? true;
  }

  get showModuleEvents(): boolean {
    return <boolean | undefined>this.config.showModuleEvents ?? true;
  }

  get clearCache(): boolean {
    return <boolean | undefined>this.config.clearCache ?? true;
  }

  get mqtt(): MqttSettings | undefined {
    return this._mqtt;
  }
}
