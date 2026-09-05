import type { RinnaiTouchPlatform } from '../../platform.js'

import { OperatingModes } from '../../rinnai/RinnaiService.js'
import { MatterAccessoryBase } from './MatterAccessoryBase.js'

interface SystemModeChangeRequest {
  systemMode: number
  oldSystemMode: number
}

interface OccupiedHeatingSetpointChangeRequest {
  occupiedHeatingSetpoint: number
  oldOccupiedHeatingSetpoint: number
}

interface OccupiedCoolingSetpointChangeRequest {
  occupiedCoolingSetpoint: number
  oldOccupiedCoolingSetpoint: number
}

export class Thermostat extends MatterAccessoryBase {
  constructor(
    platform: RinnaiTouchPlatform,
    displayName: string,
    key: string,
    zone?: string,
    mode?: string,
  ) {
    platform.log.debug('Thermostat', 'constructor', displayName, key, zone, mode)

    const thermostatZone = zone ?? 'U'

    super(platform, {
      UUID: platform.api.matter!.uuid.generate(key),
      displayName,
      deviceType: platform.api.matter!.deviceTypes.Thermostat,
      /*
      deviceType: platform.api.matter!.deviceTypes.Thermostat.with(
        platform.api.matter!.deviceRequirements.Thermostat.ThermostatServer.with(
          'Heating',
          'Cooling',
        ),
      ),
      */
      context: {
        type: Thermostat.name.toLowerCase(),
        key,
        zone: thermostatZone,
        mode,
      },

      clusters: {
        thermostat: {
          externalMeasuredIndoorTemperature: Thermostat.getCurrentTemperature(platform, thermostatZone),
          occupiedHeatingSetpoint: Thermostat.getHeatingSetpointTemperature(platform, thermostatZone),
          occupiedCoolingSetpoint: Thermostat.getCoolingSetpointTemperature(platform, thermostatZone),
          absMinHeatSetpointLimit: 0,
          minHeatSetpointLimit: 0,
          maxHeatSetpointLimit: 3000,
          absMinCoolSetpointLimit: 0,
          minCoolSetpointLimit: 0,
          maxCoolSetpointLimit: 3000,
          minSetpointDeadBand: 0,
          controlSequenceOfOperation: Thermostat.getControlSequenceOfOperation(platform),
          systemMode: Thermostat.getSystemMode(platform, thermostatZone),
          externallyMeasuredOccupancy: true,
        },
      },

      handlers: {
        thermostat: {
          systemModeChange: async request => await this.setSystemMode(request),
          occupiedHeatingSetpointChange: async request => await this.setHeatingSetpointTemperature(request),
          occupiedCoolingSetpointChange: async request => await this.setCoolingSetpointTemperature(request),
          setpointRaiseLower: async request => this.platform.log.warn('UNSUPPORTED: setpointRaiseLower', request),
        },
      },
    })

    this.setEventHandlers()
  }

  protected setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers')

    super.setEventHandlers()

    this.platform.temperatureService.on('temperature_change', async () => {
      await this.updateValues()
    })
  }

  private static getSystemMode(platform: RinnaiTouchPlatform, zone: string): number {
    platform.log.debug('Thermostat', 'getSystemMode', 'platform', zone)

    if (!platform.service.getPowerState()) {
      return 0
    }
    if (platform.service.getOperatingMode() === OperatingModes.HEATING) {
      return 4
    }
    return 3
  }

  private async setSystemMode(request: SystemModeChangeRequest): Promise<void> {
    this.platform.log.debug(this.constructor.name, request)

    await this.platform.semaphore.acquire()
    try {
      if (this.platform.service.getOperatingMode() !== OperatingModes.EVAPORATIVE_COOLING
        && this.platform.service.getFanState()
        && request.systemMode === 0) {
        return
      }

      switch (request.systemMode) {
        case 0: // Off
          await this.platform.service.setPowerState(false)
          return
        case 1: // Auto
          this.platform.log.warn('AUTO mode is not currently supported')
          return
        case 3: // Cool
          if (this.platform.service.getHasCooler()) {
            await this.platform.service.setFanState(false)
            await this.platform.service.setOperatingMode(OperatingModes.COOLING)
            await this.platform.service.setPowerState(true)
          } else {
            await this.platform.service.setOperatingMode(OperatingModes.EVAPORATIVE_COOLING)
            await this.platform.service.setPowerState(true)
          }
          return
        case 4: // Heat
          await this.platform.service.setFanState(false)
          await this.platform.service.setOperatingMode(OperatingModes.HEATING)
          await this.platform.service.setPowerState(true)
          return
        default:
          this.platform.log.warn(`Unsupported system mode received: ${request.systemMode}`)
      }
    } finally {
      this.platform.semaphore.release()
    }
  }

  private static getControlSequenceOfOperation(platform: RinnaiTouchPlatform): number {
    platform.log.debug('Thermostat', 'getSystemMode', 'platform')

    if (platform.service.getHasHeater() && platform.service.getHasCooler()) {
      return 4
    }
    if (platform.service.getHasHeater()) {
      return 2
    }
    return 0
  }

  private static getCurrentTemperature(platform: RinnaiTouchPlatform, zone: string): number {
    platform.log.debug('Thermostat', 'getCurrentTemperature', 'platform', zone)

    return (platform.temperatureService.getTemperature(zone) ?? 0) * 100
  }

  private static getHeatingSetpointTemperature(platform: RinnaiTouchPlatform, zone: string): number {
    platform.log.debug(this.constructor.name, 'getHeatingSetpointTemperature', 'platform', zone)

    if (platform.service.getOperatingMode() !== OperatingModes.HEATING) {
      return 0
    }

    const setPointTemperature = platform.service.getSetPointTemperature(zone)
    return (setPointTemperature ?? 0) * 100
  }

  private async setHeatingSetpointTemperature(request: OccupiedHeatingSetpointChangeRequest): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setHeatingSetpointTemperature', request)

    await this.platform.semaphore.acquire()
    try {
      if (this.platform.service.getOperatingMode() !== OperatingModes.HEATING) {
        return
      }

      const setpointTemperature = request.occupiedHeatingSetpoint / 100
      await this.platform.service.setSetPointTemperature(setpointTemperature, this.context.zone as string)
    } finally {
      this.platform.semaphore.release()
    }
  }

  private static getCoolingSetpointTemperature(platform: RinnaiTouchPlatform, zone: string): number {
    platform.log.debug(this.constructor.name, 'getCoolingSetpointTemperature', 'platform', zone)

    if (platform.service.getOperatingMode() !== OperatingModes.COOLING) {
      return 0
    }

    const setPointTemperature = platform.service.getSetPointTemperature(zone)
    return (setPointTemperature ?? 0) * 100
  }

  private async setCoolingSetpointTemperature(request: OccupiedCoolingSetpointChangeRequest): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setCoolingSetpointTemperature', request)

    await this.platform.semaphore.acquire()
    try {
      if (this.platform.service.getOperatingMode() !== OperatingModes.COOLING) {
        return
      }

      const setpointTemperature = request.occupiedCoolingSetpoint / 100
      await this.platform.service.setSetPointTemperature(setpointTemperature, this.context.zone as string)
    } finally {
      this.platform.semaphore.release()
    }
  }

  protected async updateValues(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'updateValues')

    if (this.platform.semaphore.isLocked()) {
      return
    }

    const currentTemperature = Thermostat.getCurrentTemperature(this.platform, this.context.zone as string)
    const systemMode = Thermostat.getSystemMode(this.platform, this.context.zone as string)
    const heatingSetpointTemperature = Thermostat.getHeatingSetpointTemperature(this.platform, this.context.zone as string)
    const coolingSetpointTemperature = Thermostat.getCoolingSetpointTemperature(this.platform, this.context.zone as string)

    const attributes: {
      externalMeasuredIndoorTemperature: number
      systemMode: number
      occupiedHeatingSetpoint?: number
      occupiedCoolingSetpoint?: number
    } = {
      externalMeasuredIndoorTemperature: currentTemperature,
      systemMode,
    }

    if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      attributes.occupiedHeatingSetpoint = heatingSetpointTemperature
    }
    if (this.platform.service.getOperatingMode() === OperatingModes.COOLING) {
      attributes.occupiedCoolingSetpoint = coolingSetpointTemperature
    }

    if (Object.keys(attributes).length > 0) {
      await this.updateState('thermostat', attributes)
    }
  }
}
