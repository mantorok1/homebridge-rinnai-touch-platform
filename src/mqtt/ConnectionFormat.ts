import mqtt = require('async-mqtt');

import { RinnaiTouchPlatform } from '../platform';
import { IMqttFormat } from './MqttService';

export class ConnectionFormat implements IMqttFormat {
  private readonly pubTopic: string;
  private topicPayload: string | undefined;
  private connectionError: boolean | undefined;

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.AsyncMqttClient,
  ) {
    const prefix: string = this.platform.settings.mqtt!.topicPrefix
      ? `${this.platform.settings.mqtt!.topicPrefix}/`
      : '';
    this.pubTopic = `${prefix}connection/status/get`;

    // Publish on status change
    if (this.platform.settings.mqtt!.publishStatusChanged) {
      this.platform.service.session.on('connection', () => {
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
      if (error instanceof Error) {
        this.platform.log.error(error.message);
      }
    }
  }

  private publishStatus() {
    this.platform.log.debug(this.constructor.name, 'publishStatus');

    if (this.connectionError === this.platform.service.session.hasConnectionError) {
      return;
    }

    this.connectionError = this.platform.service.session.hasConnectionError;
    const payload: string = this.connectionError
      ? 'error'
      : 'ok';

    this.publish(this.pubTopic, payload);
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
      if (error instanceof Error) {
        this.platform.log.error(error.message);
      }
    }
  }
}