import mqtt = require('async-mqtt');

import { RinnaiTouchPlatform } from '../platform';
import { IMqttFormat } from './MqttService';
import { IRequest, RequestTypes } from '../services/QueueService';

export class NativeFormat implements IMqttFormat {
  private readonly subTopic: string;
  private readonly pubTopic: string;
  private topicPayload: string | undefined;

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.AsyncMqttClient,
  ) {
    const prefix: string = this.platform.settings.mqtt.topicPrefix
      ? `${this.platform.settings.mqtt.topicPrefix}/`
      : '';
    this.subTopic = `${prefix}native/set`;
    this.pubTopic = `${prefix}native/get`;

    // Publish on status change
    if (this.platform.settings.mqtt.publishStatusChanged) {
      this.platform.queue.on('status', (status) => {
        this.publish(this.pubTopic, JSON.stringify(status));
      });
    }
  }

  get subscriptionTopics(): string[] {
    return [this.subTopic];
  }

  process(topic: string, payload: string): void {
    this.platform.log.debug(this.constructor.name, 'process', topic, payload);

    try {
      const request: IRequest = {
        type: RequestTypes.Command,
        command: payload,
      };

      this.platform.queue.execute(request);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  async publishTopics(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'publishTopics');

    try {
      const status = await this.platform.queue.execute({ type: RequestTypes.Get });
      if (!status) {
        return;
      }

      this.publish(this.pubTopic, JSON.stringify(status));   
    } catch (error) {
      this.platform.log.error(error);
    }
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