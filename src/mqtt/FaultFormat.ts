import mqtt = require('async-mqtt');

import { RinnaiTouchPlatform } from '../platform';
import { IMqttFormat } from './MqttService';
import { Fault } from '../models/Fault';

export class FaultFormat implements IMqttFormat {
  private readonly pubTopicFaultDetected: string;
  private readonly pubTopicFaultMessage: string;
  private readonly topicPayload: Map<string, string> = new Map();

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.AsyncMqttClient,
  ) {
    const prefix: string = this.platform.settings.mqtt!.topicPrefix
      ? `${this.platform.settings.mqtt!.topicPrefix}/`
      : '';
    this.pubTopicFaultDetected = `${prefix}fault/detected/get`;
    this.pubTopicFaultMessage = `${prefix}fault/message/get`;

    // Publish on status change
    if (this.platform.settings.mqtt!.publishStatusChanged) {
      this.platform.service.on('fault', this.publishFault.bind(this));
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
      const status = this.platform.service.session.status;
      if (status !== undefined) {
        const fault = new Fault(status);
        this.publishFault(fault);
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private publishFault(fault: Fault) {
    this.platform.log.debug(this.constructor.name, 'publishFault', fault);

    this.publish(this.pubTopicFaultDetected, String(fault.detected));
    this.publish(this.pubTopicFaultMessage, fault.toString());
  }

  private async publish(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'publish', topic, payload);

    try {
      if (payload === this.topicPayload.get(topic) && !this.platform.settings.mqtt!.publishAll) {
        return;
      }
      this.topicPayload.set(topic, payload);
      await this.client.publish(topic, payload, {retain: true});
      if (this.platform.settings.mqtt!.showMqttEvents) {
        this.platform.log.info(`MQTT: Publish: ${topic}, Payload: ${payload}`);
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }
}