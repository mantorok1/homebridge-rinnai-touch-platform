import mqtt = require('async-mqtt');

import { RinnaiTouchPlatform } from '../platform';
import { IMqttFormat } from './MqttService';
import { ConnectionStates } from '../services/QueueService';

export class ConnectionFormat implements IMqttFormat {
  private readonly pubTopic: string;
  private topicPayload: string | undefined;

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.AsyncMqttClient,
  ) {
    const prefix: string = this.platform.settings.mqtt.topicPrefix
      ? `${this.platform.settings.mqtt.topicPrefix}/`
      : '';
    this.pubTopic = `${prefix}connection/status/get`;

    // Publish on status change
    if (this.platform.settings.mqtt.publishStatusChanged) {
      this.platform.queue.on('connection', () => {
        this.publishStatus();
      });
    }
  }

  get subscriptionTopics(): string[] {
    return [];
  }

  process(topic: string, payload: string): void {
    this.platform.log.debug(this.constructor.name, 'process', topic, payload);
  }

  async publishTopics(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'publishTopics');

    try {
      this.publishStatus();
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private publishStatus() {
    this.platform.log.debug(this.constructor.name, 'publishStatus');

    const payload: string = this.platform.queue.connectionState === ConnectionStates.Error
      ? 'error'
      : 'ok';

    this.publish(this.pubTopic, payload);
  }

  private async publish(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'publish', topic, payload);

    try {
      if (payload === this.topicPayload) {
        return;
      }
      this.topicPayload = payload;
      await this.client.publish(topic, payload, {retain: true});
      this.platform.log.info(`MQTT: Publish: ${topic}, Payload: ${payload}`);
    } catch (error) {
      this.platform.log.error(error);
    }
  }
}