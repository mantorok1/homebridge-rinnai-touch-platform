import { PlatformConfig } from 'homebridge';

export class SettingsService {
  private _settings: Record<string, unknown>;

  constructor(config: PlatformConfig) {
    this._settings = this.getConfigSettings(config);
  }

  private getConfigSettings(config: PlatformConfig): Record<string, unknown> {

    return {
      name: config.name ?? 'Rinnai Touch',
      address: config.address,
      port: config.port,

      controllerType: (<string | undefined>config.controllerType)?.substr(0, 1).toUpperCase() ?? 'T',
      zoneType: (<string | undefined>config.zoneType)?.substr(0, 1).toUpperCase() ?? 'S',
      showFan: config.showFan ?? true,
      showAuto: config.showAuto ?? true,
      showAdvanceSwitches: config.showAdvanceSwitches ?? true,
      howManualSwitches: config.showManualSwitches ?? true,

      closeConnectionDelay: config.closeConnectionDelay === undefined
        ? 1100
        : Math.min(<number>config.closeConnectionDelay, 10000),
      connectionTimeout: config.connectionTimeout === undefined
        ? 5000
        : Math.min(<number>config.connectionTimeout, 300000),
      clearCache: config.clearCache ?? false,

      mqtt: this._getMqttSettings(<Record<string, unknown>>config.mqtt),
    };
  }

  private _getMqttSettings(config: Record<string, unknown>): Record<string, unknown> {

    let mqtt: Record<string, unknown> = {};

    if (config && config.host) {
      mqtt = {
        host: config.host,
        port: config.port ?? 1883,
        username: config.username,
        password: config.password,
        topicPrefix: config.topicPrefix,
        formatNative: config.formatNative ?? false,
        formatHomeAssistant: config.formatHomeAssistant ?? false,
        formatConnection: config.formatConnection ?? false,
        publishStatusChanged: config.publishStatusChanged ?? false,
        publishIntervals: config.publishIntervals ?? false,
        publishFrequency: config.publishFrequency ?? 60,
        publishAll: config.publishAll ?? false,
        subscribeTemperature: config.subscribeTemperature ?? false,
      };
    }

    return mqtt;
  }

  // Getters
  get name(): string {
    return <string>this._settings.name;
  }

  get address(): string {
    return <string>this._settings.address;
  }

  get port(): number {
    return <number>this._settings.port;
  }

  get controllerType(): string {
    return ['T', 'H'].includes(<string>this._settings.controllerType)
      ? <string>this._settings.controllerType
      : 'T';
  }

  get zoneType(): string {
    return ['N', 'S', 'H'].includes(<string>this._settings.zoneType)
      ? <string>this._settings.zoneType
      : 'S';
  }

  get showFan(): boolean {
    return <boolean>this._settings.showFan;
  }

  get showAuto(): boolean {
    return this._settings.showAuto === undefined
      ? true
      : <boolean>this._settings.showAuto;
  }

  get showAdvanceSwitches(): boolean {
    return this._settings.showAdvanceSwitches === undefined
      ? true
      : <boolean>this._settings.showAdvanceSwitches;
  }

  get showManualSwitches(): boolean {
    return this._settings.showManualSwitches === undefined
      ? true
      : <boolean>this._settings.showManualSwitches;
  }

  get closeConnectionDelay(): number {
    return <number>this._settings.closeConnectionDelay;
  }

  get connectionTimeout(): number {
    return <number>this._settings.connectionTimeout;
  }

  get clearCache(): boolean {
    return <boolean>this._settings.clearCache;
  }

  get mqtt(): Record<string, unknown> {
    return <Record<string, unknown>>this._settings.mqtt;
  }

  toString(): string {
    return JSON.stringify(this._settings);
  }
}
