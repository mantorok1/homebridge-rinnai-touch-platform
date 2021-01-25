import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Settings } from './models/Settings';
import { OperatingModes, RinnaiService } from './rinnai/RinnaiService';
import { AccessoryService } from './accessories/AccessoryService';
import { MqttService } from './mqtt/MqttService';
import { PushoverService } from './services/PushoverService';
import { TemperatureService } from './services/TemperatureService';

type devices = {
  heat: boolean,
  cool: boolean,
  evap: boolean,
  fan: boolean,
  pump: boolean,
  controllers: string[],
  heatZones: string[],
  coolZones: string[]
}

export class RinnaiTouchPlatform implements DynamicPlatformPlugin {
  private deletedAccessories: PlatformAccessory[] = [];

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly settings!: Settings;
  public readonly service!: RinnaiService;
  public readonly accessoryService!: AccessoryService;
  public readonly mqttService!: MqttService;
  public readonly pushoverService!: PushoverService;
  public readonly temperatureService!: TemperatureService;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    try {
      this.settings = new Settings(config);

      this.service = new RinnaiService({
        log: this.log,
        address: this.settings.address,
        port: this.settings.port,
        showModuleEvents: this.settings.showModuleEvents,
        showModuleStatus: this.settings.showModuleStatus,
        invertComfortLevel: this.settings.invertComfortLevel,
      });
      this.accessoryService = new AccessoryService(this);
      this.mqttService = new MqttService(this);
      this.pushoverService = new PushoverService(this);
      this.temperatureService = new TemperatureService(this);

      this.api.on('didFinishLaunching', () => {
        this.discoverDevices();
      });

      this.api.on('shutdown', () => {
        this.log.info('Shutting down plugin');
        this.service.session.stop();
      });
    } catch(error) {
      log.error(error);
    }
  }

  configureAccessory(platformAccessory: PlatformAccessory) {
    this.log.debug(this.constructor.name, 'configureAccessory');

    if (this.settings.clearCache) {
      this.deletedAccessories.push(platformAccessory);
      return;
    }

    this.accessoryService.configure(platformAccessory);
  }

  async discoverDevices(): Promise<void> {
    try {
      this.log.debug(this.constructor.name, 'discoverDevices');

      // Clear cached accessories if required
      if (this.settings.clearCache) {
        this.log.info('Clear Cached Accessories');
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.deletedAccessories);
        this.deletedAccessories = [];
      }

      await this.service.init();

      // Display discovered devices
      const devices = await this.getDevices();
      this.displayDevices(devices);

      // Add/Remove accessories
      this.accessoryService.discover();

      // Initialise MQTT
      this.mqttService.init();

      // Initialise Pushover notifications
      this.pushoverService.init();

    } catch (error) {
      this.log.error(error);
    }
  }

  private async getDevices(): Promise<devices> {
    this.log.debug(this.constructor.name, 'getDevices');

    const powerState = this.service.getPowerState();
    const fanState = this.service.getFanState();
    const operatingMode = this.service.getOperatingMode();
    let controllers: string[];
    let heatZones: string[] = [];
    let coolZones: string[] = [];

    await this.service.setPowerState(false);
    await this.service.setFanState(false);
    if (this.service.getHasHeater()) {
      await this.service.setOperatingMode(OperatingModes.HEATING);
    }

    if (this.service.getHasMultiSetPoint()) {
      controllers = this.service.getZonesInstalled();
    } else {
      controllers = ['U'];
      heatZones = this.service.getZonesInstalled();
      if (this.service.getHasCooler()) {
        await this.service.setOperatingMode(OperatingModes.COOLING);
        coolZones = this.service.getZonesInstalled();
      }
    }

    if (this.service.getHasEvaporative()) {
      await this.service.setOperatingMode(OperatingModes.EVAPORATIVE_COOLING);
      coolZones = this.service.getZonesInstalled();
    }

    await this.service.setOperatingMode(operatingMode);
    await this.service.setPowerState(powerState);
    await this.service.setFanState(fanState);

    return {
      heat: this.service.getHasHeater(),
      cool: this.service.getHasCooler(),
      evap: this.service.getHasEvaporative(),
      fan: true,
      pump: this.service.getHasEvaporative(),
      controllers: controllers,
      heatZones: heatZones,
      coolZones: coolZones,
    };
  }

  private async displayDevices(devices: devices): Promise<void> {
    this.log.debug(this.constructor.name, 'displayDevices', devices);

    this.log.info(`Controllers found: ${devices.controllers.length}`);
    for(const controller of devices.controllers) {
      this.log.info(`  ${this.service.getZoneName(controller)}`);
    }
    if (devices.heat) {
      this.log.info(`Gas Heater found. Zones: ${devices.heatZones.length}`);
      for(const zone of devices.heatZones) {
        this.log.info(`  ${this.service.getZoneName(zone)}`);
      }
    }
    if (devices.cool) {
      this.log.info(`Add-On Cooler found. Zones: ${devices.coolZones.length}`);
      for(const zone of devices.coolZones) {
        this.log.info(`  ${this.service.getZoneName(zone)}`);
      }
    }
    if (devices.evap) {
      this.log.info(`Evaporative Cooler found. Zones: ${devices.coolZones.length}`);
      for(const zone of devices.coolZones) {
        this.log.info(`  ${this.service.getZoneName(zone)}`);
      }
    }

    if (devices.fan) {
      this.log.info('Circulation Fan found');
    }
    if (devices.pump) {
      this.log.info('Pump found');
    }
  }

}
