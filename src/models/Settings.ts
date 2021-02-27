import { PlatformConfig } from 'homebridge';

export type MqttSettings = {
  host?: string,
  port?: number,
  username?: string,
  password?: string,
  topicPrefix?: string,
  formatHomeAssistant: boolean,
  formatConnection: boolean,
  formatFault: boolean,
  publishStatusChanged: boolean,
  publishIntervals: boolean,
  publishFrequency: number,
  publishAll: boolean,
  showMqttEvents: boolean, 
  subscribeTemperature: {
    U?: string,
    A?: string,
    B?: string,
    C?: string,
    D?: string,
    jsonPathU?: string,
    jsonPathA?: string,
    jsonPathB?: string,
    jsonPathC?: string,
    jsonPathD?: string,
  }
}

type PushoverSettings = {
  token: string,
  users: string[],
  minTemperatureThreshold?: number,
  maxTemperatureThreshold?: number,
  connectionError: boolean,
  faultDetected: boolean,
  dayIncorrect: boolean,
  timeIncorrect: boolean,
}

export class Settings {
  private _mqtt?: MqttSettings;

  constructor(private readonly config: PlatformConfig) {
    if (config.mqtt) {
      const mqtt = <MqttSettings>config.mqtt;

      this._mqtt = {
        host: mqtt.host,
        port: mqtt.port ?? 1883,
        username: mqtt.username,
        password: mqtt.password,
        topicPrefix: mqtt.topicPrefix,
        formatHomeAssistant: mqtt.formatHomeAssistant ?? false,
        formatConnection: mqtt.formatConnection ?? false,
        formatFault: mqtt.formatFault ?? false,
        publishStatusChanged: mqtt.publishStatusChanged ?? false,
        publishIntervals: mqtt.publishIntervals ?? false,
        publishFrequency: mqtt.publishFrequency ?? 60,
        publishAll: mqtt.publishAll ?? false,
        showMqttEvents: mqtt.showMqttEvents ?? true,
        subscribeTemperature: mqtt.subscribeTemperature,
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

  get seperateModeAccessories(): boolean {
    return <boolean | undefined>this.config.seperateModeAccessories ?? false;
  }

  get seperateFanZoneSwitches(): boolean {
    return <boolean | undefined>this.config.seperateFanZoneSwitches ?? false;
  }

  get invertComfortLevel(): boolean {
    return <boolean | undefined>this.config.invertComfortLevel ?? true;
  }

  get setAutoOperatingState(): boolean {
    return <boolean | undefined>this.config.setAutoOperatingState ?? true;
  }

  get showHomebridgeEvents(): boolean {
    return <boolean | undefined>this.config.showHomebridgeEvents ?? true;
  }

  get showModuleEvents(): boolean {
    return <boolean | undefined>this.config.showModuleEvents ?? true;
  }

  get showModuleStatus(): boolean {
    return <boolean | undefined>this.config.showModuleStatus ?? false;
  }

  get clearCache(): boolean {
    return <boolean | undefined>this.config.clearCache ?? false;
  }

  get forceAutoDiscovery(): boolean {
    return <boolean | undefined>this.config.forceAutoDiscovery ?? false;
  }

  get mqtt(): MqttSettings | undefined {
    return this._mqtt;
  }

  get pushover() : PushoverSettings | undefined {
    return <PushoverSettings | undefined> this.config.pushover;
  }
}
