import mqtt = require('async-mqtt');

import { RinnaiTouchPlatform } from '../platform';
import { NativeFormat } from './NativeFormat';
import { HomeAssistantFormat } from './HomeAssistantFormat';
import { ConnectionFormat } from './ConnectionFormat';
import { TemperatureFormat } from './TemperatureFormat';

export interface IMqttFormat {
  subscriptionTopics: string[];
  process(topic: string, payload: string): void;
  publishTopics(): Promise<void>;
}

export class MqttService {
  private settings: Record<string, unknown>;
  private client!: mqtt.AsyncMqttClient;
  private formats: IMqttFormat[] = [];
  private topicMap: Map<string, IMqttFormat> = new Map();

  constructor(
    private readonly platform: RinnaiTouchPlatform,
  ) {
    this.settings = platform.settings.mqtt;
  }

  async init(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'init');

    try {
      if (this.settings.host === undefined) {
        this.platform.log.info('MQTT: No broker defined');
        return;
      }
  
      await this.connect();

      if (this.settings.formatNative) {
        this.formats.push(new NativeFormat(this.platform, this.client));
      }
      if (this.settings.formatHomeAssistant) {
        this.formats.push(new HomeAssistantFormat(this.platform, this.client));
      }
      if (this.settings.formatConnection) {
        this.formats.push(new ConnectionFormat(this.platform, this.client));
      }
      if (this.settings.subscribeTemperature) {
        this.formats.push(new TemperatureFormat(this.platform, this.client));
      }

      // Subscriptions
      for(const format of this.formats) {
        await this.subscribe(format);
      }

      this.client.on('message', (topic, payload) => {
        this.platform.log.info(`MQTT: Received: ${topic}, Payload: ${payload}`);

        const format: IMqttFormat | undefined = this.topicMap.get(topic);
        if (format) {
          format.process(topic, payload.toString());
        }
      });

      // Initial Publications
      for(const format of this.formats) {
        if (this.settings.publishIntervals || this.settings.publishStatusChanged) {
          await format.publishTopics();
        }
      }

      // Publish at intervals
      if (this.settings.publishIntervals) {
        setInterval(async () => {
          this.platform.log.info('MQTT: Publish Event: Scheduled Interval');
          for(const format of this.formats) {
            await format.publishTopics();
          }
        }, <number>this.settings.publishFrequency * 1000);
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  async connect(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'connect');

    const url = `${this.settings.host}:${this.settings.port}`;
    const options: mqtt.IClientOptions = {
      username: <string | undefined>this.settings.username,
      password: <string | undefined>this.settings.password,
    };

    let connected = false;
    while(!connected) {
      try {
        this.client = await mqtt.connectAsync(url, options);
        connected = true;
      } catch(error) {
        this.platform.log.warn(`Failed to connect to MQTT broker. Error: ${error.message}`);
        this.platform.log.warn('Will try again in 1 minute');
        await this.delay(60000);
      }
    }

    this.platform.log.info(`MQTT: Broker connected [${url}]`);
  }

  async subscribe(format: IMqttFormat): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'subscribe', 'format');

    for(const topic of format.subscriptionTopics) {
      this.platform.log.info(`MQTT: Subscribe: ${topic}`);
      await this.client.subscribe(topic);
      this.topicMap.set(topic, format);
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}