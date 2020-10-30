import mqtt = require('async-mqtt');
import jsonpath = require('jsonpath');

import { RinnaiTouchPlatform } from '../platform';
import { IMqttFormat } from './MqttService';

export class TemperatureFormat implements IMqttFormat {
  private readonly zoneTopics: Record<string, string> = {};

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.AsyncMqttClient,
  ) {
    if (platform.settings.mqtt!.subscribeTemperature) {
      for(const zone of this.platform.service.AllZones) {
        if (platform.settings.mqtt!.subscribeTemperature[zone] !== undefined) {
          this.zoneTopics[zone] = platform.settings.mqtt!.subscribeTemperature[zone];
        }
      }
    }
  }

  get subscriptionTopics(): string[] {
    return [...new Set(Object.values(this.zoneTopics))];
  }

  process(topic: string, payload: string): void {
    this.platform.log.debug(this.constructor.name, 'process', topic, payload);

    try {
      for(const zone in this.zoneTopics) {
        if (this.zoneTopics[zone] === topic) {
          const temperture = this.extractTemperature(zone, payload);
          this.platform.log.info(`MQTT: Extracted Temperature: ${temperture}`);
          if (temperture !== undefined) {
            this.platform.service.setCurrentTemperatureOverride(temperture, zone);
          }
        }
      }
    } catch(error) {
      this.platform.log.error(error);
    }
  }

  private extractTemperature(zone: string, payload: string): number | undefined {
    this.platform.log.debug(this.constructor.name, 'extractTemperature', zone, payload);

    try {
      let temperature: number;

      const path = this.platform.settings.mqtt?.subscribeTemperature[`jsonPath${zone}`];
      if (path === undefined || path === '') {
        temperature = Number(payload);
        return isNaN(temperature) ? undefined : temperature;
      }

      const json = JSON.parse(payload);
      const result = jsonpath.query(json, path);

      if (Array.isArray(result) && result.length > 0) {
        temperature = Number(result[0]);
        return isNaN(temperature) ? undefined : temperature;
      }
    } catch {
      return;
    }
  }

  async publishTopics(): Promise<void> {
    // Do nothing
  }
}