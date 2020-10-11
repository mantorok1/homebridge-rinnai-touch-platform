import { PlatformAccessory } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from '../settings';
import { RinnaiTouchPlatform } from '../platform';
import { AccessoryBase } from './AccessoryBase';
import { Thermostat } from './Thermostat';
import { HeaterCooler } from './HeaterCooler';
import { Fan } from './Fan';
import { ZoneSwitch } from './ZoneSwitch';
import { AdvanceSwitch } from './AdvanceSwitch';
import { ManualSwitch } from './ManualSwitch';
import { Pump } from './Pump';

export class AccessoryService {
  private accessories: Map<string, AccessoryBase> = new Map();

  constructor(private readonly platform: RinnaiTouchPlatform) { }

  discover(): void {
    this.platform.log.debug(this.constructor.name, 'discover');

    try {
      this.discoverThermostats();
      this.discoverHeaterCoolers();
      this.discoverFan();
      this.discoverZoneSwitches();
      this.discoverAdvanceSwitches();
      this.discoverManualSwitches();
      this.discoverPump();
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  discoverThermostats(): void {
    this.platform.log.debug(this.constructor.name, 'discoverThermostats');

    for(const zone of this.platform.service.AllZones) {
      if (this.platform.settings.controllerType === 'T' && this.platform.service.controllers.includes(zone)) {
        this.addAccessory(Thermostat, Thermostat.name, zone);
      } else {
        this.removeAccessory(Thermostat.name, zone);
      }
    }
  }

  discoverHeaterCoolers(): void {
    this.platform.log.debug(this.constructor.name, 'discoverHeaterCoolers');

    for (const zone of this.platform.service.AllZones) {
      const addHeaterCooler: boolean =
        (this.platform.settings.controllerType === 'H' && this.platform.service.controllers.includes(zone)) ||
        (
          !this.platform.service.hasMultiSetPoint &&
          zone !== 'U' &&
          this.platform.settings.zoneType === 'H' &&
          this.platform.service.zones.includes(zone)
        );

      if (addHeaterCooler) {
        this.addAccessory(HeaterCooler, HeaterCooler.name, zone);
      } else {
        this.removeAccessory(HeaterCooler.name, zone);
      }
    }
  }

  discoverFan(): void {
    this.platform.log.debug(this.constructor.name, 'discoverFan');

    if (this.platform.settings.showFan) {
      this.addAccessory(Fan, Fan.name);
    } else {
      this.removeAccessory(Fan.name);
    }
  }

  discoverZoneSwitches(): void {
    this.platform.log.debug(this.constructor.name, 'discoverZoneSwitches');

    for(const zone of ['A', 'B', 'C', 'D']) {
      if (!this.platform.service.hasMultiSetPoint &&
         this.platform.settings.zoneType === 'S' &&
         this.platform.service.zones.includes(zone)
      ) {
        this.addAccessory(ZoneSwitch, ZoneSwitch.name, zone);
      } else {
        this.removeAccessory(ZoneSwitch.name, zone);
      }
    }
  }

  discoverAdvanceSwitches() {
    this.platform.log.debug(this.constructor.name, 'discoverAdvanceSwitches');

    for(const zone of this.platform.service.AllZones) {
      if (this.platform.settings.showAdvanceSwitches && this.platform.service.controllers.includes(zone)) {
        this.addAccessory(AdvanceSwitch, AdvanceSwitch.name, zone);
      } else {
        this.removeAccessory(AdvanceSwitch.name, zone);
      }
    }
  }

  discoverManualSwitches() {
    this.platform.log.debug(this.constructor.name, 'discoverManualSwitches');

    for(const zone of this.platform.service.AllZones) {
      if (this.platform.settings.showManualSwitches && this.platform.service.controllers.includes(zone)) {
        this.addAccessory(ManualSwitch, ManualSwitch.name, zone);
      } else {
        this.removeAccessory(ManualSwitch.name, zone);
      }
    }
  }

  discoverPump() {
    this.platform.log.debug(this.constructor.name, 'discoverPump');

    if (this.platform.service.hasEvaporative) {
      this.addAccessory(Pump, Pump.name);
    } else {
      this.removeAccessory(Pump.name);
    }
  }

  addAccessory<TAccessory extends AccessoryBase>(
    Accessory: new (platform: RinnaiTouchPlatform, accessory: PlatformAccessory) => TAccessory,
    name: string, zone?: string,
  ): void {
    this.platform.log.debug(this.constructor.name, 'addAccessory', 'Accessory', name, zone);

    const key: string = this.getKey(name, zone);

    if (this.accessories.has(key)) {
      return;
    }

    const displayName: string = zone ? `${name} ${zone}` : name;
    const uuid: string = this.platform.api.hap.uuid.generate(key);
    const platformAccessory: PlatformAccessory = new this.platform.api.platformAccessory(displayName, uuid);
    platformAccessory.context.type = name.toLowerCase();
    platformAccessory.context.zone = zone;
    platformAccessory.context.key = key;

    const accessory = new Accessory(this.platform, platformAccessory);

    this.accessories.set(key, accessory);

    this.platform.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
    this.platform.log.info(`Add ${platformAccessory.displayName}`);
  }

  removeAccessory(name: string, zone?: string): void {
    this.platform.log.debug(this.constructor.name, 'removeAccessory', name, zone);

    const key: string = this.getKey(name, zone);

    if (!this.accessories.has(key)) {
      return;
    }

    const accessory: AccessoryBase = <AccessoryBase>this.accessories.get(key);
    const platformAccessory: PlatformAccessory = accessory.platformAccessory;

    this.platform.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
 
    this.accessories.delete(key);
    this.platform.log.info(`Remove ${platformAccessory.displayName}`);
  }

  // Called from configureAccessory
  configure(platformAccessory: PlatformAccessory): void {
    this.platform.log.debug(this.constructor.name, 'configure', 'platformAccessory');

    this.platform.log.info(`Configure ${platformAccessory.displayName}`);

    const accessory: AccessoryBase | undefined = this.createAccessory(platformAccessory);

    if (accessory) {
      this.accessories.set(platformAccessory.context.key, accessory);
    }
  }

  createAccessory(platformAccessory: PlatformAccessory): AccessoryBase | undefined {
    this.platform.log.debug(this.constructor.name, 'createAccessory', 'platformAccessory');

    switch(platformAccessory.context.type) {
      case 'thermostat':
        return new Thermostat(this.platform, platformAccessory);
        break;
      case 'heatercooler':
        return new HeaterCooler(this.platform, platformAccessory);
        break;
      case 'fan':
        return new Fan(this.platform, platformAccessory);
        break;
      case 'zoneswitch':
        return new ZoneSwitch(this.platform, platformAccessory);
        break;
      case 'advanceswitch':
        return new AdvanceSwitch(this.platform, platformAccessory);
        break;
      case 'manualswitch':
        return new ManualSwitch(this.platform, platformAccessory);
        break;
      case 'pump':
        return new Pump(this.platform, platformAccessory);
        break;
    }

    return;
  }

  getKey(name:string, zone?: string): string {
    this.platform.log.debug(this.constructor.name, 'getKey', zone);

    return zone ? `${name}_${zone}` : name;
  }
}