import type * as mqtt from 'mqtt'

import type { RinnaiTouchPlatform } from '../platform.js'
import type { IMqttFormat } from './MqttService.js'

import { JSONPath } from 'jsonpath-plus'

export class TemperatureFormat implements IMqttFormat {
  private readonly zoneTopics: Record<string, string> = {}

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.MqttClient,
  ) {
    if (platform.settings.mqtt!.subscribeTemperature) {
      for (const zone of this.platform.service.AllZones) {
        if (platform.settings.mqtt!.subscribeTemperature[zone] !== undefined) {
          this.zoneTopics[zone] = platform.settings.mqtt!.subscribeTemperature[zone]
        }
      }
    }
  }

  get subscriptionTopics(): string[] {
    return [...new Set(Object.values(this.zoneTopics))]
  }

  process(topic: string, payload: string): void {
    this.platform.log.debug(this.constructor.name, 'process', topic, payload)

    try {
      for (const zone in this.zoneTopics) {
        if (this.zoneTopics[zone] === topic) {
          const temperture = this.extractTemperature(zone, payload)
          this.platform.log.info(`MQTT: Extracted Temperature: ${temperture}`)
          if (temperture !== undefined) {
            this.platform.temperatureService.setTemperature(zone, temperture)
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        this.platform.log.error(error.message)
      }
    }
  }

  private extractTemperature(zone: string, payload: string): number | undefined {
    this.platform.log.debug(this.constructor.name, 'extractTemperature', zone, payload)

    try {
      let temperature: number

      const path = this.platform.settings.mqtt?.subscribeTemperature[`jsonPath${zone}`]
      if (path === undefined || path === '') {
        temperature = Number(payload)
        return Number.isNaN(temperature) ? undefined : temperature
      }

      const json = JSON.parse(payload)
      const result = JSONPath({ path, json })

      if (Array.isArray(result) && result.length > 0) {
        temperature = Number(result[0])
        return Number.isNaN(temperature) ? undefined : temperature
      }
    } catch {

    }
  }

  async publishTopics(): Promise<void> {
    // Do nothing
  }
}
