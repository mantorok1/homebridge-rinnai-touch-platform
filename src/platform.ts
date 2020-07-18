import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { SettingsService } from './services/SettingsService';
import { QueueService } from './services/QueueService';
import { RinnaiTouchService } from './services/RinnaiTouchService';
import { AccessoryService } from './accessories/AccessoryService';
import { MqttService } from './mqtt/MqttService';

export class RinnaiTouchPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly settings!: SettingsService;
  public readonly queue!: QueueService;
  public readonly service!: RinnaiTouchService;
  public readonly accessoryService!: AccessoryService;
  public readonly mqttService!: MqttService;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    try {
      this.settings = new SettingsService(config);
      this.queue = new QueueService(this, this.settings);
      this.service = new RinnaiTouchService(this, this.queue);
      this.accessoryService = new AccessoryService(this);
      this.mqttService = new MqttService(this);

      this.api.on('didFinishLaunching', () => {
        this.discoverDevices();
      });

      this.api.on('shutdown', () => {
        this.log.info('Shutting down plugin');
        this.queue.closeConnection();
      });
    } catch(error) {
      log.error(error);
    }
  }

  configureAccessory(platformAccessory: PlatformAccessory) {
    this.log.debug(this.constructor.name, 'configureAccessory');

    this.accessoryService.configure(platformAccessory);
  }

  async discoverDevices(): Promise<void> {
    try {
      this.log.debug(this.constructor.name, 'discoverDevices');

      // Clear cached accessories if required
      if (this.settings.clearCache) {
        this.accessoryService.clearAccessories();
      }

      await this.service.init();

      // Display found items
      if (this.service?.hasHeater) {
        this.log.info('Found: Heater');
      }
      if (this.service?.hasCooler) {
        this.log.info('Found: Cooler');
      } 
      if (this.service?.hasEvaporative) {
        this.log.info('Found: Evaporative Cooler');
      } 
      const zones = this.service?.zones.map(z => this.service?.getZoneName(z)) ?? [];
      this.log.info(`Found Zone(s): ${zones.join()}`);
      const operation = this.service?.hasMultiSetPoint ? 'Multi' : 'Single';
      this.log.info(`Operation Mode: ${operation} Temperature Set Point`);

      // Add/Remove accessories
      this.accessoryService.discover();

      // MQTT
      this.mqttService.init();

    } catch (error) {
      this.log.error(error);
    }
  }
}
