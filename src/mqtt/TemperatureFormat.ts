import mqtt = require('async-mqtt');

import { RinnaiTouchPlatform } from '../platform';
import { IMqttFormat } from './MqttService';

export class TemperatureFormat implements IMqttFormat {
  private readonly zoneTopics: Record<string, string> = {};

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.AsyncMqttClient,
  ) {
    if (platform.settings.mqtt.subscribeTemperature) {
      this.zoneTopics = <Record<string, string>>platform.settings.mqtt.subscribeTemperature; 
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
          this.platform.service.setCurrentTemperatureOverride(parseFloat(payload), zone);
        }
      }
    } catch(error) {
      this.platform.log.error(error);
    }
  }

  async publishTopics(): Promise<void> {
    // Do nothing
  }
}