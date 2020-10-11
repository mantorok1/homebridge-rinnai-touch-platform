import mqtt = require('async-mqtt');

import { RinnaiTouchPlatform } from '../platform';
import { IMqttFormat } from './MqttService';
import { Command } from '../models/Command';
import { Status } from '../models/Status';

export class NativeFormat implements IMqttFormat {
  private readonly subTopic: string;
  private readonly pubTopic: string;
  private topicPayload: string | undefined;

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.AsyncMqttClient,
  ) {
    const prefix: string = this.platform.settings.mqtt!.topicPrefix
      ? `${this.platform.settings.mqtt!.topicPrefix}/`
      : '';
    this.subTopic = `${prefix}native/set`;
    this.pubTopic = `${prefix}native/get`;

    // Publish on status change
    if (this.platform.settings.mqtt!.publishStatusChanged) {
      this.platform.session.on('status', (status: Status) => {
        this.publish(this.pubTopic, status.toString());
      });
    }
  }

  get subscriptionTopics(): string[] {
    return [this.subTopic];
  }

  process(topic: string, payload: string): void {
    this.platform.log.debug(this.constructor.name, 'process', topic, payload);

    try {
      const command = new Command(undefined, undefined, payload);
      this.platform.session.sendCommand(command);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  async publishTopics(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'publishTopics');

    try {
      const status = this.platform.session.getStatus();
      if (status === undefined) {
        return;
      }

      await this.publish(this.pubTopic, status.toString());   
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private async publish(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'publish', topic, payload);

    try {
      if (payload === this.topicPayload && !this.platform.settings.mqtt!.publishAll) {
        return;
      }
      this.topicPayload = payload;
      await this.client.publish(topic, payload, {retain: true});
      if (this.platform.settings.mqtt!.showMqttEvents) {
        this.platform.log.info(`MQTT: Publish: ${topic}, Payload: ${payload}`);
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }
}