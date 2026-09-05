import type { RinnaiTouchPlatform } from '../../platform.js'

import { ControlModes, OperatingModes } from '../../rinnai/RinnaiService.js'
import { MatterAccessoryBase } from './MatterAccessoryBase.js'

export class ManualSwitch extends MatterAccessoryBase {
  constructor(
    platform: RinnaiTouchPlatform,
    displayName: string,
    key: string,
    zone?: string,
    mode?: string,
  ) {
    platform.log.debug('ManualSwitch', 'constructor', displayName, key, zone, mode)

    const onOff = ManualSwitch.getManualSwitchState(platform, zone as string, mode)

    super(platform, {
      UUID: platform.api.matter!.uuid.generate(key),
      displayName,
      deviceType: platform.api.matter!.deviceTypes.OnOffSwitch,

      context: {
        type: ManualSwitch.name.toLowerCase(),
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
          on: async () => this.setManualSwitchState(true),
          off: async () => this.setManualSwitchState(false),
        },
      },
    })

    this.setEventHandlers()
  }

  protected setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers')

    super.setEventHandlers()
  }

  private async setManualSwitchState(state: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setManualSwitchState', state)

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

        if (!this.platform.service.getPowerState()) {
          await this.platform.service.setFanState(false)
          await this.platform.service.setPowerState(true)
        }
      }

      const controlMode: ControlModes = state
        ? ControlModes.MANUAL
        : ControlModes.AUTO

      await this.platform.service.setControlMode(controlMode, this.context.zone as string)
    } finally {
      this.platform.semaphore.release()
    }
  }

  private static getManualSwitchState(platform: RinnaiTouchPlatform, zone: string, mode?: string): boolean {
    let controlMode: ControlModes = ControlModes.AUTO

    switch (mode) {
      case 'A':
        controlMode = platform.service.getControlMode(zone)
        break
      case 'H':
        if (platform.service.getOperatingMode() === OperatingModes.HEATING) {
          controlMode = platform.service.getControlMode(zone)
        }
        break
      case 'C':
        if (platform.service.getOperatingMode() === OperatingModes.COOLING) {
          controlMode = platform.service.getControlMode(zone)
        }
        break
      case 'E':
        if (platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING) {
          controlMode = platform.service.getControlMode(zone)
        }
        break
    }

    return controlMode === ControlModes.MANUAL
  }

  protected async updateValues(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'updateValues', this.context.zone)

    if (this.platform.semaphore.isLocked()) {
      return
    }

    const onOffState = ManualSwitch.getManualSwitchState(this.platform, this.context.zone as string, this.context.mode as string | undefined)
    await this.updateState('onOff', { onOff: onOffState })
  }
}
