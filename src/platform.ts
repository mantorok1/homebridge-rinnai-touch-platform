import type { API, Characteristic, DynamicPlatformPlugin, Logger, MatterAccessory, PlatformAccessory, PlatformConfig, Service } from 'homebridge'

import fs from 'node:fs'
import path from 'node:path'

import { Semaphore } from 'async-mutex'

import { HomekitAccessoryService } from './accessories/homekit/HomekitAccessoryService.js'
import { MatterAccessoryService } from './accessories/matter/MatterAccessoryService.js'
import { Settings } from './models/Settings.js'
import { MqttService } from './mqtt/MqttService.js'
import { OperatingModes, RinnaiService } from './rinnai/RinnaiService.js'
import { PushoverService } from './services/PushoverService.js'
import { TemperatureService } from './services/TemperatureService.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'

export interface devices {
  controllers: string[]
  heat?: string[]
  cool?: string[]
  evap?: string[]
}

export class RinnaiTouchPlatform implements DynamicPlatformPlugin {
  private deletedHomekitAccessories: PlatformAccessory[] = []
  private deletedMatterAccessories: MatterAccessory[] = []

  public get Service(): typeof Service {
    return this.api.hap.Service
  }

  public get Characteristic(): typeof Characteristic {
    return this.api.hap.Characteristic
  }

  public readonly settings!: Settings
  public readonly service!: RinnaiService
  public readonly homekitAccessoryService!: HomekitAccessoryService
  public readonly matterAccessoryService!: MatterAccessoryService
  public readonly mqttService!: MqttService
  public readonly pushoverService!: PushoverService
  public readonly temperatureService!: TemperatureService
  public readonly semaphore = new Semaphore(1)
  private _initServicePromise?: Promise<void>

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    try {
      this.settings = new Settings(config)

      this.service = new RinnaiService({
        log: this.log,
        address: this.settings.address,
        port: this.settings.port,
        showModuleEvents: this.settings.showModuleEvents,
        showModuleStatus: this.settings.showModuleStatus,
        invertComfortLevel: this.settings.invertComfortLevel,
        bootTime: this.settings.bootTime,
        bootPassword: this.settings.bootPassword,
      })
      this.homekitAccessoryService = new HomekitAccessoryService(this)
      this.matterAccessoryService = new MatterAccessoryService(this)
      this.mqttService = new MqttService(this)
      this.pushoverService = new PushoverService(this)
      this.temperatureService = new TemperatureService(this)

      this.api.on('didFinishLaunching', () => {
        this.discoverDevices()
      })

      this.api.on('shutdown', () => {
        this.log.info('Shutting down plugin')
        this.service.session.stop()
      })
    } catch (error) {
      if (error instanceof Error) {
        log.error(error.message)
      }
    }
  }

  async configureAccessory(platformAccessory: PlatformAccessory) {
    this.log.debug(this.constructor.name, 'configureAccessory')

    try {
      if (this.settings.clearCache) {
        this.deletedHomekitAccessories.push(platformAccessory)
        return
      }

      await this.initService()

      this.homekitAccessoryService.configure(platformAccessory)
    } catch (error) {
      if (error instanceof Error) {
        this.log.error(`Failed to configure accessory ${platformAccessory.displayName}: ${error.message}`)
      }
    }
  }

  async configureMatterAccessory(accessory: MatterAccessory) {
    this.log.debug(this.constructor.name, 'configureMatterAccessory')

    try {
      if (this.settings.clearCache) {
        this.deletedMatterAccessories.push(accessory)
        return
      }

      await this.initService()

      await this.matterAccessoryService.configure(accessory)
    } catch (error) {
      if (error instanceof Error) {
        this.log.error(`Failed to configure accessory ${accessory.displayName}: ${error.message}`)
      }
    }
  }

  private async initService(): Promise<void> {
    this.log.debug(this.constructor.name, 'initService')

    if (!this._initServicePromise) {
      this._initServicePromise = this.service.init()
    }

    await this._initServicePromise
  }

  async discoverDevices(): Promise<void> {
    try {
      this.log.debug(this.constructor.name, 'discoverDevices')

      // Clear cached accessories if required
      if (this.settings.clearCache) {
        this.log.info('Clear Cached Accessories')

        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.deletedHomekitAccessories)
        await this.api.matter?.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.deletedMatterAccessories)

        this.deletedHomekitAccessories = []
        this.deletedMatterAccessories = []
      }

      await this.initService()

      // Display discovered devices
      const devices = await this.getDevices()
      this.displayDevices(devices)

      // Add/Remove HAP accessories
      this.homekitAccessoryService.discover(devices)

      // Add/Remove Matter accessories
      await this.matterAccessoryService.discover(devices)

      // Initialise MQTT
      this.mqttService.init()

      // Initialise Pushover notifications
      this.pushoverService.init()
    } catch (error) {
      if (error instanceof Error) {
        this.log.error(error.message)
      }
    }
  }

  private async getDevices(): Promise<devices> {
    this.log.debug(this.constructor.name, 'getDevices')

    let devices: devices | undefined
    const cacheFolder = path.join(this.api.user.storagePath(), 'RinnaiTouchPlatform')
    const cacheFile = path.join(cacheFolder, `${this.settings.name}.json`)

    try {
      if (this.settings.forceAutoDiscovery) {
        this.log.info('Forcing Auto-Discovery')
      } else {
        const content = await fs.promises.readFile(cacheFile, { encoding: 'utf8' })
        this.log.info(`Read config from cache [${cacheFile}]`)
        devices = JSON.parse(content)
      }
    } catch {
      this.log.info('Performing Auto-Discovery as cache file not found')
      devices = undefined
    } finally {
      if (devices !== undefined) {
        if ((this.service.getHasMultiSetPoint() && devices.controllers.includes('U'))
          || (!this.service.getHasMultiSetPoint() && !devices.controllers.includes('U'))) {
          this.log.info('Performing Auto-Discovery as cache file is invalid')
          devices = undefined
        }
      }

      if (devices === undefined) {
        devices = await this.findDevices()
        try {
          this.log.info(`Writing config to cache [${cacheFile}]`)
          const content = JSON.stringify(devices)
          await fs.promises.mkdir(cacheFolder, { recursive: true })
          await fs.promises.writeFile(cacheFile, content, { encoding: 'utf8' })
        } catch (error) {
          if (error instanceof Error) {
            this.log.warn(`Writing config failed [${error.message}]`)
          }
        }
      }
    }

    return devices
  }

  private async findDevices(): Promise<devices> {
    this.log.debug(this.constructor.name, 'findDevices')

    const powerState = this.service.getPowerState()
    const fanState = this.service.getFanState()
    const operatingMode = this.service.getOperatingMode()

    await this.service.setFanState(false)
    await this.service.setPowerState(true)

    const devices: devices = {
      controllers: this.service.getHasMultiSetPoint()
        ? this.service.getZonesInstalled()
        : ['U'],
    }

    if (this.service.getHasHeater()) {
      await this.service.setOperatingMode(OperatingModes.HEATING)
      devices.heat = this.service.getZonesInstalled()
    }

    if (this.service.getHasCooler()) {
      await this.service.setOperatingMode(OperatingModes.COOLING)
      devices.cool = this.service.getZonesInstalled()
    }

    if (this.service.getHasEvaporative()) {
      await this.service.setOperatingMode(OperatingModes.EVAPORATIVE_COOLING)
      devices.evap = this.service.getZonesInstalled()
    }

    await this.service.setOperatingMode(operatingMode)
    await this.service.setPowerState(powerState)
    await this.service.setFanState(fanState)

    return devices
  }

  private async displayDevices(devices: devices): Promise<void> {
    this.log.debug(this.constructor.name, 'displayDevices', devices)

    if ('controllers' in devices) {
      this.log.info(`Controllers found: ${devices.controllers.length}`)
      for (const controller of devices.controllers) {
        this.log.info(`  ${this.service.getZoneName(controller)}`)
      }
    }

    if (devices.heat !== undefined) {
      this.log.info(`Gas Heater found. Zones: ${devices.heat.length}`)
      for (const zone of devices.heat) {
        this.log.info(`  ${this.service.getZoneName(zone)}`)
      }
    }

    if (devices.cool !== undefined) {
      this.log.info(`Add-On Cooler found. Zones: ${devices.cool.length}`)
      for (const zone of devices.cool) {
        this.log.info(`  ${this.service.getZoneName(zone)}`)
      }
    }

    if (devices.evap !== undefined) {
      this.log.info(`Evaporative Cooler found. Zones: ${devices.evap.length}`)
      for (const zone of devices.evap) {
        this.log.info(`  ${this.service.getZoneName(zone)}`)
      }
    }
  }
}
