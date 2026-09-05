import type { RinnaiTouchPlatform } from '../../platform.js'

import debounce from 'debounce'

import { ControlModes, OperatingModes } from '../../rinnai/RinnaiService.js'
import { MatterAccessoryBase } from './MatterAccessoryBase.js'

interface FanModeChangeRequest {
  fanMode: number
  oldFanMode: number
}

interface PercentSettingChangeRequest {
  percentSetting: number | null
  oldPercentSetting: number | null
}

export class Fan extends MatterAccessoryBase {
  private readonly debouncedSetPercentSetting: (percentSetting: number) => void

  constructor(
    platform: RinnaiTouchPlatform,
    displayName: string,
    key: string,
    zone?: string,
    mode?: string,
  ) {
    platform.log.debug('Fan', 'constructor', displayName, key, zone, mode)

    super(platform, {
      UUID: platform.api.matter!.uuid.generate(key),
      displayName,
      deviceType: platform.api.matter!.deviceTypes.Fan,

      context: {
        type: Fan.name.toLowerCase(),
        key,
      },

      clusters: {
        fanControl: {
          fanMode: Fan.getFanMode(platform),
          fanModeSequence: platform.api.matter!.types.FanControl.FanModeSequence.OffHigh,
          percentSetting: Fan.getFanPercentCurrent(platform),
          percentCurrent: Fan.getFanPercentCurrent(platform),
        },
      },

      handlers: {
        fanControl: {
          fanModeChange: async request => await this.setFanMode(request),
          percentSettingChange: async request => await this.setPercentSetting(request),
        },
      },
    })

    this.debouncedSetPercentSetting = debounce((percentSetting: number) => {
      void this.applyPercentSetting(percentSetting)
    }, 1000)

    this.setEventHandlers()
  }

  protected setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers')

    super.setEventHandlers()
  }

  private static getFanMode(platform: RinnaiTouchPlatform): number {
    return platform.service.getFanState()
      ? platform.api.matter!.types.FanControl.FanMode.High
      : platform.api.matter!.types.FanControl.FanMode.Off
  }

  private static getFanPercentCurrent(platform: RinnaiTouchPlatform): number {
    return Math.round(platform.service.getFanSpeed() / 16.0 * 100.0)
  }

  private async setFanMode(request: FanModeChangeRequest): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanMode', request)

    await this.platform.semaphore.acquire()
    try {
      await this.setFanOn(request.fanMode !== this.platform.api.matter!.types.FanControl.FanMode.Off)
    } finally {
      this.platform.semaphore.release()
    }
  }

  private async setFanOn(state: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanOn', state)

    if (state) {
      if (this.platform.service.getOperatingMode() !== OperatingModes.EVAPORATIVE_COOLING) {
        await this.platform.service.setPowerState(false)
      } else {
        await this.platform.service.setPowerState(true)
        await this.platform.service.setControlMode(ControlModes.MANUAL)
      }
    }

    await this.platform.service.setFanState(state)
  }

  private async setPercentSetting(request: PercentSettingChangeRequest): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setPercentSetting', request)

    this.debouncedSetPercentSetting(request.percentSetting ?? 0)
  }

  private async applyPercentSetting(percentSetting: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'applyPercentSetting', percentSetting)

    await this.platform.semaphore.acquire()
    try {
      if (percentSetting <= 0) {
        await this.setFanOn(false)
        return
      }

      const speed = Math.round(percentSetting / 100.0 * 16.0)

      await this.setFanOn(true)
      await this.platform.service.setFanSpeed(speed)
    } finally {
      this.platform.semaphore.release()
    }
  }

  protected async updateValues(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'updateValues')

    if (this.platform.semaphore.isLocked()) {
      return
    }

    await this.updateState('fanControl', {
      fanMode: Fan.getFanMode(this.platform),
      percentCurrent: Fan.getFanPercentCurrent(this.platform),
    })
  }
}
