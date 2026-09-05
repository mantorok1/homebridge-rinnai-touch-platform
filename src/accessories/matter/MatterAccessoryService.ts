import type { MatterAccessory } from 'homebridge'

import type { devices, RinnaiTouchPlatform } from '../../platform.js'
import type { MatterAccessoryBase } from './MatterAccessoryBase.js'

import { PLATFORM_NAME, PLUGIN_NAME } from '../../settings.js'
import { AdvanceSwitch } from './AdvanceSwitch.js'
import { Fan } from './Fan.js'
import { ManualSwitch } from './ManualSwitch.js'
import { Thermostat } from './Thermostat.js'
import { ZoneSwitch } from './ZoneSwitch.js'

export class MatterAccessoryService {
  private previousAccessories: Map<string, MatterAccessory> = new Map()
  private currentAccessories: Map<string, MatterAccessory> = new Map()
  private deviceModes: string[] = []
  private modeNames = {
    A: '',
    H: 'Heat',
    C: 'Cool',
    E: 'Cool',
    F: 'Fan',
  }

  constructor(
    private readonly platform: RinnaiTouchPlatform,
  ) { }

  async discover(devices: devices): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'discover', devices)

    if (!(this.platform.api.isMatterAvailable?.() && this.platform.api.isMatterEnabled?.())) {
      this.platform.log.warn('Matter is not available or enabled. Skipping Matter accessory discovery.')
      return
    }

    try {
      if (this.platform.settings.seperateModeAccessories) {
        if (devices.heat !== undefined) {
          this.deviceModes.push('H')
        }
        if (devices.cool !== undefined) {
          this.deviceModes.push('C')
        }
        if (devices.evap !== undefined) {
          this.deviceModes.push('E')
        }
      } else {
        this.deviceModes.push('A')
      }
      if (this.platform.settings.showFan && devices.controllers.length > 1) {
        this.deviceModes.push('F')
      }

      await this.discoverThermostats(devices)
      await this.discoverFan()
      await this.discoverZoneSwitches(devices)
      await this.discoverAdvanceSwitches(devices)
      await this.discoverManualSwitches(devices)
      // await this.discoverPump(devices)

      const accessories = [...this.currentAccessories.values()]
      if (accessories.length > 0) {
        this.platform.log.info(`Registering ${this.currentAccessories.size} Matter accessories with Homebridge`)
        for (const accessory of accessories) {
          this.platform.log.info(` - ${accessory.deviceType.name}: ${accessory.displayName}`)
        }
        await this.platform.api.matter!.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessories)
      }

      const removedAccessories = [...this.previousAccessories.values()]
        .filter(a => !this.currentAccessories.has(a.context.key as string))
      if (removedAccessories.length > 0) {
        this.platform.log.info(`Unregistering ${removedAccessories.length} Matter accessories from Homebridge`)
        for (const accessory of removedAccessories) {
          this.platform.log.info(` - ${accessory.deviceType.name}: ${accessory.displayName}`)
        }
        await this.platform.api.matter!.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removedAccessories)
      }
    } catch (error) {
      if (error instanceof Error) {
        this.platform.log.error(error.message)
      }
    }
  }

  async discoverZoneSwitches(devices: devices): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'discoverZoneSwitches', devices)

    const modeZones: Record<string, string[]> = {
      A: [],
      H: [],
      C: [],
      E: [],
      F: [],
    }

    if (this.platform.settings.zoneType !== 'N') {
      if (this.platform.settings.seperateModeAccessories) {
        modeZones.H = devices.heat ?? []
        modeZones.C = devices.cool ?? []
        modeZones.E = devices.evap ?? []
      } else {
        modeZones.A = [...new Set([
          ...(devices.heat ?? []),
          ...(devices.cool ?? []),
          ...(devices.evap ?? []),
        ])]
      }
    }

    if (this.platform.settings.seperateFanZoneSwitches) {
      modeZones.F = [...new Set([
        ...(devices.heat ?? []),
        ...(devices.cool ?? []),
      ])]
    }

    for (const mode of Object.keys(modeZones)) {
      for (const zone of ['A', 'B', 'C', 'D']) {
        if (modeZones[mode].includes(zone)) {
          const displayName = `${this.platform.service.getZoneName(zone)} ${this.modeNames[mode]}`
          await this.addMatterAccessory(ZoneSwitch, displayName.trim(), zone, mode)
        }
      }
    }
  }

  async discoverThermostats(devices: devices): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'discoverThermostats', devices)

    const zones: string[] = []
    zones.push(...devices.controllers)

    for (const zone of this.platform.service.AllZones) {
      if (zones.includes(zone)) {
        const displayName: string = this.platform.service.getHasMultiSetPoint()
          ? this.platform.service.getZoneName(zone)
          : this.platform.settings.name
        await this.addMatterAccessory(Thermostat, displayName, zone)
      }
    }
  }

  async discoverFan(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'discoverFan')

    if (this.platform.settings.showFan) {
      await this.addMatterAccessory(Fan, 'Circulation Fan')
    }
  }

  async discoverManualSwitches(devices: devices): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'discoverManualSwitches', devices)

    const zones: string[] = []
    if (this.platform.settings.showManualSwitches) {
      zones.push(...devices.controllers)
    }

    for (const mode of ['A', 'H', 'C', 'E']) {
      for (const zone of this.platform.service.AllZones) {
        if (zones.includes(zone) && this.deviceModes.includes(mode)) {
          let displayName = 'Manual'
          if (this.platform.service.getHasMultiSetPoint()) {
            displayName += ` ${this.platform.service.getZoneName(zone)}`
          }
          displayName += ` ${this.modeNames[mode]}`
          await this.addMatterAccessory(ManualSwitch, displayName.trim(), zone, mode)
        }
      }
    }
  }

  async discoverAdvanceSwitches(devices: devices): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'discoverAdvanceSwitches', devices)

    const zones: string[] = []
    if (this.platform.settings.showAdvanceSwitches && devices.heat !== undefined) {
      zones.push(...devices.controllers)
    }

    for (const mode of ['A', 'H', 'C']) {
      for (const zone of this.platform.service.AllZones) {
        if (zones.includes(zone) && this.deviceModes.includes(mode)) {
          let displayName = 'Advance Period'
          if (this.platform.service.getHasMultiSetPoint()) {
            displayName += ` ${this.platform.service.getZoneName(zone)}`
          }
          displayName += ` ${this.modeNames[mode]}`
          await this.addMatterAccessory(AdvanceSwitch, displayName.trim(), zone, mode)
        }
      }
    }
  }

  async addMatterAccessory<TAccessory extends MatterAccessoryBase>(
    Accessory: new (platform: RinnaiTouchPlatform, name: string, key: string, zone?: string, mode?: string) => TAccessory,
    name: string,
    zone?: string,
    mode?: string,
  ): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'addMatterAccessory', 'Accessory', name, zone, mode)

    const key: string = this.getKey(name, zone, mode)
    const accessory = new Accessory(this.platform, name, key, zone, mode)
    this.currentAccessories.set(key, accessory)
  }

  // Called from configureAccessory
  async configure(accessory: MatterAccessory): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'configure', 'accessory')

    this.previousAccessories.set(accessory.context.key, accessory)
  }

  getKey(name: string, zone?: string, mode?: string): string {
    this.platform.log.debug(this.constructor.name, 'getKey', zone)

    return name + (zone ? `_${zone}` : '') + (mode ? `_${mode}` : '')
  }
}
