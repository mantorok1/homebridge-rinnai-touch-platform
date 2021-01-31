import { PlatformAccessory } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from '../settings';
import { RinnaiTouchPlatform, devices } from '../platform';
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
  private deviceModes: string[] = [];
  private deviceModesAll: string[] = ['A', 'H', 'C', 'E', 'F']

  constructor(private readonly platform: RinnaiTouchPlatform) { }

  discover(devices: devices): void {
    this.platform.log.debug(this.constructor.name, 'discover');

    try {
      if (this.platform.settings.seperateModeAccessories) {
        if ('heat' in devices) {
          this.deviceModes.push('H');
        }
        if ('cool' in devices) {
          this.deviceModes.push('C');
        }
        if ('evap' in devices) {
          this.deviceModes.push('E');
        }
      } else {
        this.deviceModes.push('A');
      }
      if (this.platform.settings.showFan && devices.controllers.length > 1) {
        this.deviceModes.push('F');
      }

      this.discoverThermostats(devices);
      this.discoverHeaterCoolers(devices);
      this.discoverFan();
      this.discoverZoneSwitches(devices);
      this.discoverAdvanceSwitches(devices);
      this.discoverManualSwitches(devices);
      this.discoverPump(devices);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  discoverThermostats(devices: devices): void {
    this.platform.log.debug(this.constructor.name, 'discoverThermostats', devices);

    const zones: string[] = [];
    if (this.platform.settings.controllerType === 'T') {
      zones.push(...devices.controllers);
    }

    for(const zone of this.platform.service.AllZones) {
      if (zones.includes(zone)) {
        this.addAccessory(Thermostat, Thermostat.name, zone);
      } else {
        this.removeAccessory(Thermostat.name, zone);
      }
    }
  }

  discoverHeaterCoolers(devices: devices): void {
    this.platform.log.debug(this.constructor.name, 'discoverHeaterCoolers', devices);

    const zones: string[] = [];
    if (this.platform.settings.controllerType === 'H') {
      zones.push(...devices.controllers);
    }

    if (this.platform.settings.zoneType === 'H' && 'heat' in devices) {
      for(const zone of devices.heat) {
        if (!zones.includes(zone)) {
          zones.push(zone);
        }
      }
    }

    for(const zone of this.platform.service.AllZones) {
      if (zones.includes(zone)) {
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

  discoverZoneSwitches(devices: devices): void {
    this.platform.log.debug(this.constructor.name, 'discoverZoneSwitches', devices);

    const zones: string[] = [];
    if (this.platform.settings.zoneType === 'S') {
      if ('heat' in devices) {
        zones.push(...devices.heat);
      } else if ('evap' in devices) {
        zones.push(...devices.evap);
      }
    }

    // Remove the old zone switches that don't have mode
    for(const zone of ['A', 'B', 'C', 'D']) {
      this.removeAccessory(ZoneSwitch.name, zone);
    }

    for(const mode of this.deviceModesAll) {
      for(const zone of ['A', 'B', 'C', 'D']) {
        if (zones.includes(zone) && this.deviceModes.includes(mode)) {
          this.addAccessory(ZoneSwitch, ZoneSwitch.name, zone, mode);
        } else {
          this.removeAccessory(ZoneSwitch.name, zone, mode);
        }
      }
    }
  }

  discoverAdvanceSwitches(devices: devices) {
    this.platform.log.debug(this.constructor.name, 'discoverAdvanceSwitches', devices);

    const zones: string[] = [];
    if (this.platform.settings.showAdvanceSwitches && 'heat' in devices) {
      zones.push(...devices.controllers);
    }

    // Remove the old zone switches that don't have mode
    for(const zone of this.platform.service.AllZones) {
      this.removeAccessory(AdvanceSwitch.name, zone);
    }

    for(const mode of ['A', 'H', 'C']) {
      for(const zone of this.platform.service.AllZones) {
        if (zones.includes(zone) && this.deviceModes.includes(mode)) {
          this.addAccessory(AdvanceSwitch, AdvanceSwitch.name, zone, mode);
        } else {
          this.removeAccessory(AdvanceSwitch.name, zone, mode);
        }
      }
    }
  }

  discoverManualSwitches(devices: devices) {
    this.platform.log.debug(this.constructor.name, 'discoverManualSwitches', devices);

    const zones: string[] = [];
    if (this.platform.settings.showManualSwitches) {
      zones.push(...devices.controllers);
    }

    // Remove the old zone switches that don't have mode
    for(const zone of this.platform.service.AllZones) {
      this.removeAccessory(ManualSwitch.name, zone);
    }

    for(const mode of ['A', 'H', 'C', 'E']) {
      for(const zone of this.platform.service.AllZones) {
        if (zones.includes(zone) && this.deviceModes.includes(mode)) {
          this.addAccessory(ManualSwitch, ManualSwitch.name, zone, mode);
        } else {
          this.removeAccessory(ManualSwitch.name, zone, mode);
        }
      }
    }
  }

  discoverPump(devices: devices) {
    this.platform.log.debug(this.constructor.name, 'discoverPump', devices);

    if ('evap' in devices) {
      this.addAccessory(Pump, Pump.name);
    } else {
      this.removeAccessory(Pump.name);
    }
  }

  addAccessory<TAccessory extends AccessoryBase>(
    Accessory: new (platform: RinnaiTouchPlatform, accessory: PlatformAccessory) => TAccessory,
    name: string, zone?: string, mode?: string,
  ): void {
    this.platform.log.debug(this.constructor.name, 'addAccessory', 'Accessory', name, zone, mode);

    const key: string = this.getKey(name, zone, mode);

    if (this.accessories.has(key)) {
      return;
    }

    const displayName: string = name + (zone ? ` ${zone}` : '' ) + (mode ? ` ${mode}` : '');
    const uuid: string = this.platform.api.hap.uuid.generate(key);
    const platformAccessory: PlatformAccessory = new this.platform.api.platformAccessory(displayName, uuid);
    platformAccessory.context.type = name.toLowerCase();
    platformAccessory.context.zone = zone;
    platformAccessory.context.mode = mode;
    platformAccessory.context.key = key;

    const accessory = new Accessory(this.platform, platformAccessory);

    this.accessories.set(key, accessory);

    this.platform.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
    this.platform.log.info(`Add ${platformAccessory.displayName}`);
  }

  removeAccessory(name: string, zone?: string, mode?: string): void {
    this.platform.log.debug(this.constructor.name, 'removeAccessory', name, zone, mode);

    const key: string = this.getKey(name, zone, mode);

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

  getKey(name:string, zone?: string, mode?: string): string {
    this.platform.log.debug(this.constructor.name, 'getKey', zone);

    return name + (zone ? `_${zone}` : '' ) + (mode ? `_${mode}` : '');
  }
}