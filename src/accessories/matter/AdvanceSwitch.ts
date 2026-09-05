import type { RinnaiTouchPlatform } from '../../platform.js'

import { ControlModes, OperatingModes, ScheduleOverrideModes } from '../../rinnai/RinnaiService.js'
import { MatterAccessoryBase } from './MatterAccessoryBase.js'

export class AdvanceSwitch extends MatterAccessoryBase {
  constructor(
    platform: RinnaiTouchPlatform,
    displayName: string,
    key: string,
    zone?: string,
    mode?: string,
  ) {
    platform.log.debug('AdvanceSwitch', 'constructor', displayName, key, zone, mode)

    const onOff = AdvanceSwitch.getAdvanceSwitchState(platform, zone as string, mode)

    super(platform, {
      UUID: platform.api.matter!.uuid.generate(key),
      displayName,
      deviceType: platform.api.matter!.deviceTypes.OnOffSwitch,

      context: {
        type: AdvanceSwitch.name.toLowerCase(),
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
          on: async () => this.setAdvanceSwitchState(true),
          off: async () => this.setAdvanceSwitchState(false),
        },
      },
    })

    this.setEventHandlers()
  }

  protected setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers')

    super.setEventHandlers()
  }

  private async setAdvanceSwitchState(state: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setAdvanceSwitchState', state)

    await this.platform.semaphore.acquire()
    try {
      if (this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING) {
        return
      }

      if (state) {
        switch (this.context.mode) {
          case 'H':
            await this.platform.service.setOperatingMode(OperatingModes.HEATING)
            break
          case 'C':
            await this.platform.service.setOperatingMode(OperatingModes.COOLING)
            break
        }

        if (!this.platform.service.getPowerState()) {
          await this.platform.service.setFanState(false)
          await this.platform.service.setPowerState(true)
        }
      }

      const scheduleOverrideMode: ScheduleOverrideModes = state
        ? ScheduleOverrideModes.ADVANCE
        : ScheduleOverrideModes.NONE

      await this.platform.service.setControlMode(ControlModes.AUTO, this.context.zone as string)
      await this.platform.service.setScheduleOverride(scheduleOverrideMode, this.context.zone as string)
    } finally {
      this.platform.semaphore.release()
    }
  }

  private static getAdvanceSwitchState(platform: RinnaiTouchPlatform, zone: string, mode?: string): boolean {
    let scheduleOverrideMode: ScheduleOverrideModes = ScheduleOverrideModes.NONE

    switch (mode) {
      case 'A':
        scheduleOverrideMode = platform.service.getScheduleOverride(zone)
        break
      case 'H':
        if (platform.service.getOperatingMode() === OperatingModes.HEATING) {
          scheduleOverrideMode = platform.service.getScheduleOverride(zone)
        }
        break
      case 'C':
        if (platform.service.getOperatingMode() === OperatingModes.COOLING) {
          scheduleOverrideMode = platform.service.getScheduleOverride(zone)
        }
        break
    }

    return scheduleOverrideMode === ScheduleOverrideModes.ADVANCE
  }

  protected async updateValues(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'updateValues')

    if (this.platform.semaphore.isLocked()) {
      return
    }

    const onOffState = AdvanceSwitch.getAdvanceSwitchState(
      this.platform,
      this.context.zone as string,
      this.context.mode as string | undefined,
    )
    await this.updateState('onOff', { onOff: onOffState })
  }
}
