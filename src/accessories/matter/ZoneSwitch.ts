import type { RinnaiTouchPlatform } from '../../platform.js'

import { OperatingModes } from '../../rinnai/RinnaiService.js'
import { MatterAccessoryBase } from './MatterAccessoryBase.js'

export class ZoneSwitch extends MatterAccessoryBase {
  constructor(
    platform: RinnaiTouchPlatform,
    displayName: string,
    key: string,
    zone?: string,
    mode?: string,
  ) {
    platform.log.debug('ZoneSwitch', 'constructor', displayName, key, zone, mode)

    const onOff = ZoneSwitch.getZoneSwitchState(platform, zone as string, mode)

    super(platform, {
      UUID: platform.api.matter!.uuid.generate(key),
      displayName,
      deviceType: platform.api.matter!.deviceTypes.OnOffSwitch,

      context: {
        type: ZoneSwitch.name.toLowerCase(),
        key,
        zone,
        mode,
      },

      clusters: {
        onOff: {
          onOff,
        },
      },

      handlers: {
        onOff: {
          on: async () => this.setZoneSwitchState(true),
          off: async () => this.setZoneSwitchState(false),
        },
      },
    })

    this.setEventHandlers()
  }

  protected setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers')

    super.setEventHandlers()
  }

  private static getZoneSwitchState(platform: RinnaiTouchPlatform, zone: string, mode?: string): boolean {
    platform.log.debug(this.constructor.name, 'getZoneSwitchOn')

    if (mode !== 'F') {
      if (platform.settings.seperateFanZoneSwitches && platform.service.getFanState()) {
        return false
      }
    }

    switch (mode) {
      case 'A':
        return platform.service.getUserEnabled(zone)
      case 'H':
        return platform.service.getOperatingMode() === OperatingModes.HEATING
          ? platform.service.getUserEnabled(zone)
          : false
      case 'C':
        return platform.service.getOperatingMode() === OperatingModes.COOLING
          ? platform.service.getUserEnabled(zone)
          : false
      case 'E':
        return platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING
          ? platform.service.getUserEnabled(zone)
          : false
      case 'F':
        return platform.service.getFanState()
          ? platform.service.getUserEnabled(zone)
          : false
      default:
        return false
    }
  }

  private async setZoneSwitchState(state: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setZoneSwitchState', state)

    await this.platform.semaphore.acquire()
    try {
      if (state) {
        switch (this.context.mode) {
          case 'H':
            await this.platform.service.setOperatingMode(OperatingModes.HEATING)
            break
          case 'C':
            await this.platform.service.setOperatingMode(OperatingModes.COOLING)
            break
          case 'E':
            await this.platform.service.setOperatingMode(OperatingModes.EVAPORATIVE_COOLING)
            break
        }

        if (!this.platform.service.getZoneInstalled(this.context.zone as string)) {
          const zoneName = this.platform.service.getZoneName(this.context.zone as string)
          this.platform.log.warn(`'${zoneName}' cannot be turned on as it's not installed`)
          setTimeout(this.updateValues.bind(this), 1000)
          return
        }

        if (this.context.mode === 'F') {
          if (this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING) {
            this.platform.log.warn('Fan Zone Switch is not supported for Evaporative Cooling')
            setTimeout(this.updateValues.bind(this), 1000)
            return
          }
          await this.platform.service.setPowerState(false)
          await this.platform.service.setFanState(true)
        } else {
          if (this.platform.settings.seperateFanZoneSwitches && this.platform.service.getFanState()) {
            await this.platform.service.setFanState(false)
            await this.platform.service.setPowerState(true)
          } else {
            if (!this.platform.service.getFanState() && !this.platform.service.getPowerState()) {
              await this.platform.service.setPowerState(true)
            }
          }
        }
      }

      await this.platform.service.setUserEnabled(state, this.context.zone as string)
    } finally {
      this.platform.semaphore.release()
    }
  }

  protected async updateValues(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'updateValues')

    if (this.platform.semaphore.isLocked()) {
      return
    }

    const onOffState = ZoneSwitch.getZoneSwitchState(this.platform, this.context.zone as string, this.context.mode as string)
    await this.updateState('onOff', { onOff: onOffState })
  }
}
