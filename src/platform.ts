import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Settings } from './models/Settings';
import { OperatingModes, RinnaiService } from './rinnai/RinnaiService';
import { AccessoryService } from './accessories/AccessoryService';
import { MqttService } from './mqtt/MqttService';
import { PushoverService } from './services/PushoverService';
import { TemperatureService } from './services/TemperatureService';
import fs = require('fs');
import path = require('path');

export type devices = { controllers: string[] } & (
  {heat: string[]} |
  {heat: string[], cool: string[]} |
  {heat: string[], evap: string[]} |
  {evap: string[]}
)

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
      this.accessoryService.discover(devices);

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

    let devices: devices | undefined;
    const cacheFile = path.join(this.api.user.storagePath(), 'RinnaiTouchPlatform.json');

    try {
      if (this.settings.forceAutoDiscovery) {
        this.log.info('Forcing Auto-Discovery');
      } else {
        const content = await fs.promises.readFile(cacheFile, { encoding: 'utf8' });
        this.log.info(`Read config from cache [${cacheFile}]`);
        devices = JSON.parse(content);
      }
    } catch {
      this.log.info('Performing Auto-Discovery');
      devices = undefined;
    } finally {
      if (devices === undefined) {
        devices = await this.findDevices();
        try {
          this.log.info(`Writing config to cache [${cacheFile}]`);
          const content = JSON.stringify(devices);
          await fs.promises.writeFile(cacheFile, content, { encoding: 'utf8'});
        } catch(ex) {
          this.log.warn(`Writing config failed [${ex.message}]`);
        }
      }
    }

    return devices;
  }

  private async findDevices(): Promise<devices> {
    this.log.debug(this.constructor.name, 'findDevices');

    const powerState = this.service.getPowerState();
    const fanState = this.service.getFanState();
    const operatingMode = this.service.getOperatingMode();

    await this.service.setFanState(false);
    await this.service.setPowerState(true);

    const devices = {
      controllers: this.service.getHasMultiSetPoint()
        ? this.service.getZonesInstalled()
        : ['U'],
    };

    if (this.service.getHasHeater()) {
      await this.service.setOperatingMode(OperatingModes.HEATING);
      devices['heat'] = this.service.getZonesInstalled();
    }

    if (this.service.getHasCooler()) {
      await this.service.setOperatingMode(OperatingModes.COOLING);
      devices['cool'] = this.service.getZonesInstalled();
    }

    if (this.service.getHasEvaporative()) {
      await this.service.setOperatingMode(OperatingModes.EVAPORATIVE_COOLING);
      devices['evap'] = this.service.getZonesInstalled();
    }

    await this.service.setOperatingMode(operatingMode);
    await this.service.setPowerState(powerState);
    await this.service.setFanState(fanState);

    return <devices>devices;
  }

  private async displayDevices(devices: devices): Promise<void> {
    this.log.debug(this.constructor.name, 'displayDevices', devices);

    if ('controllers' in devices) {
      this.log.info(`Controllers found: ${devices.controllers.length}`);
      for(const controller of devices.controllers) {
        this.log.info(`  ${this.service.getZoneName(controller)}`);
      }
    }

    if ('heat' in devices) {
      this.log.info(`Gas Heater found. Zones: ${devices.heat.length}`);
      for(const zone of devices.heat) {
        this.log.info(`  ${this.service.getZoneName(zone)}`);
      }
    }

    if ('cool' in devices) {
      this.log.info(`Add-On Cooler found. Zones: ${devices.cool.length}`);
      for(const zone of devices.cool) {
        this.log.info(`  ${this.service.getZoneName(zone)}`);
      }
    }

    if ('evap' in devices) {
      this.log.info(`Evaporative Cooler found. Zones: ${devices.evap.length}`);
      for(const zone of devices.evap) {
        this.log.info(`  ${this.service.getZoneName(zone)}`);
      }
    }
  }
}
