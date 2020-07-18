import mqtt = require('async-mqtt');

import { RinnaiTouchPlatform } from '../platform';
import { IMqttFormat } from './MqttService';
import { Modes, ControlModes } from '../services/RinnaiTouchService';

export class HomeAssistantFormat implements IMqttFormat {
  private readonly subTopics: Map<string, (topic: string, payload: string) => Promise<void>> = new Map();
  private readonly topicPayloads: Map<string, string> = new Map();
  private readonly prefix: string;

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.AsyncMqttClient,
  ) {
    this.prefix = this.platform.settings.mqtt.topicPrefix
      ? `${this.platform.settings.mqtt.topicPrefix}/`
      : '';

    this.subTopics
      .set(`${this.prefix}hvac/fan_mode/set`, this.setHvacFanMode.bind(this))
      .set(`${this.prefix}hvac/mode/set`, this.setHvacMode.bind(this))
      .set(`${this.prefix}hvac/temperature/set`, this.setHvacTemperature.bind(this))
      .set(`${this.prefix}switch/zone/a/set`, this.setSwitchZone.bind(this))
      .set(`${this.prefix}switch/zone/b/set`, this.setSwitchZone.bind(this))
      .set(`${this.prefix}switch/zone/c/set`, this.setSwitchZone.bind(this))
      .set(`${this.prefix}switch/zone/d/set`, this.setSwitchZone.bind(this))
      .set(`${this.prefix}switch/heat/set`, this.setSwitchMode.bind(this))
      .set(`${this.prefix}switch/cool/set`, this.setSwitchMode.bind(this))
      .set(`${this.prefix}switch/evap/set`, this.setSwitchMode.bind(this))
      .set(`${this.prefix}switch/fan/set`, this.setSwitchFan.bind(this))
      .set(`${this.prefix}switch/manual/set`, this.setSwitchManual.bind(this))
      .set(`${this.prefix}switch/manual/a/set`, this.setSwitchManual.bind(this))
      .set(`${this.prefix}switch/manual/b/set`, this.setSwitchManual.bind(this))
      .set(`${this.prefix}switch/manual/c/set`, this.setSwitchManual.bind(this))
      .set(`${this.prefix}switch/manual/d/set`, this.setSwitchManual.bind(this));

    // Publish on status change
    if (this.platform.settings.mqtt.publishStatusChanged) {
      this.platform.service.on('updated', () => {
        this.publishTopics();
      });
    }
  }

  get subscriptionTopics(): string[] {
    return [...this.subTopics.keys()];
  }

  process(topic: string, payload: string): void {
    this.platform.log.debug(this.constructor.name, 'process', topic, payload);

    try {
      const setValue = this.subTopics.get(topic);
      if (setValue) {
        setValue(topic, payload);
      }
    } catch(error) {
      this.platform.log.error(error);
    }
  }

  private async setHvacFanMode(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanMode', topic, payload);

    try {
      let fanSpeed: number;
      switch(payload) {
        case 'low':
          fanSpeed = 5;
          break;
        case 'medium':
          fanSpeed = 10;
          break;
        case 'high':
          fanSpeed = 15;
          break;
        default:
          this.platform.log.warn(`MQTT: Invalid fan mode '${payload}' in payload`);
          return;
      }
  
      await this.platform.service.setFanSpeed(fanSpeed);
    } catch(error) {
      this.platform.log.error(error);
    }
  }

  private async setHvacMode(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setMode', topic, payload);

    try {
      switch (payload) {
        case 'fan_only':
          await this.platform.service.setState(false);
          await this.platform.service.setFanState(true);
          break;
        case 'off':
          await this.platform.service.setState(false);
          await this.platform.service.setFanState(false);
          break;
        case 'heat':
          await this.platform.service.setFanState(false);
          await this.platform.service.setMode(Modes.HEAT);
          await this.platform.service.setState(true);
          break;
        case 'cool':
          await this.platform.service.setFanState(false);
          await this.platform.service.setMode(this.platform.service.hasEvaporative ? Modes.EVAP : Modes.COOL);
          await this.platform.service.setState(true);
          break;
        default:
          this.platform.log.warn(`MQTT: Invalid mode '${payload}' in payload`);
          return;
      }  
    } catch(error) {
      this.platform.log.error(error);
    }
  }

  private async setHvacTemperature(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setTemperature', topic, payload);

    try {
      const json: Record<string, number> | number = JSON.parse(payload);
      if (typeof json === 'object') {
        for (const zone in json) {
          if (this.isValidTemperature(json[zone])) {
            await this.platform.service.setTargetTemperature(json[zone], zone);
          }
        }
      } else {
        if (this.isValidTemperature(json)) {
          await this.platform.service.setTargetTemperature(json);
        }
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private isValidTemperature(temp: number): boolean {
    this.platform.log.debug(this.constructor.name, 'isValidTemperature', temp);

    const value = parseInt(`${temp}`);
    if (isNaN(value)) {
      this.platform.log.warn(`MQTT: Invalid temperature specified: ${temp}`);
      return false;
    }
    if (value < 8 || value > 30) {
      this.platform.log.warn(`MQTT: Temperature ${temp} not between 8 and 30`);
      return false;
    }
    return true;
  }

  private async setSwitchZone(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setZoneSwitch', topic, payload);

    try {
      const zone = this.getTopicComponent(topic, -2).toUpperCase();
      const value = payload.toLowerCase() === 'on';
      await this.platform.service.setUserEnabled(value, zone);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private async setSwitchMode(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setModeSwitch', topic, payload);

    try {
      const mode: Modes = Modes[this.getTopicComponent(topic, -2).toUpperCase()];
      const state: boolean = payload.toLowerCase() === 'on';

      if (this.platform.service.getFanState()) {
        await this.platform.service.setFanState(false);
      }

      if (state) {
        await this.platform.service.setMode(mode);
        await this.platform.service.setState(true);
      } else {
        await this.platform.service.setState(false);
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private async setSwitchFan(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanState', topic, payload);

    try {
      const state: boolean = payload.toLowerCase() === 'on';

      if (state && this.platform.service.getState()) {
        await this.platform.service.setState(false);
      }

      await this.platform.service.setFanState(state);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private async setSwitchManual(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setControlMode', topic, payload);

    try {
      let zone: string = this.getTopicComponent(topic, -2).toUpperCase();
      zone = zone.length !== 1 ? 'U' : zone;
      const state: ControlModes = payload.toLowerCase() === 'on'
        ? ControlModes.MANUAL
        : ControlModes.SCHEDULE;

      this.platform.service.setControlMode(state, zone);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private getTopicComponent(topic: string, index: number): string {
    const components = topic.split('/');
    if (index >= 0) {
      return components[index];
    }
    return components[components.length + index];
  }

  async publishTopics(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'publishTopics');

    try {
      this.publishHvacAction();
      this.publishHvacCurrentTemperature();
      this.publishHvacFanMode();
      this.publishHvacMode();
      this.publishHvacTemperature();
      this.publishSwitchZone();
      this.publishSwitchMode();
      this.publishSwitchFan();
      this.publishSwitchManual();

    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private publishHvacAction() {
    this.platform.log.debug(this.constructor.name, 'publishHvacAction');

    const payload: Record<string, string> = {};
    for(const zone of this.platform.service.zones) {
      if (!this.platform.service.getUserEnabled(zone)) {
        payload[zone] = 'off';
        continue;
      }
      if (this.platform.service.getFanState()) {
        payload[zone] = 'fan';
        continue;
      }
      if (!this.platform.service.getState()) {
        payload[zone] = 'off';
        continue;
      }
      if (!this.platform.service.getAutoEnabled(zone)) {
        payload[zone] = 'idle';
        continue;
      }
      payload[zone] = this.platform.service.mode === Modes.HEAT
        ? 'heating'
        : 'cooling';
    }
    this.publish('hvac/action/get', JSON.stringify(payload));
  }

  private publishHvacCurrentTemperature() {
    this.platform.log.debug(this.constructor.name, 'publishHvacCurrentTemperature');

    const payload: Record<string, number> = {};
    for(const zone of this.platform.service.zones) {
      if (this.platform.service.getCurrentTemperature(zone)) {
        payload[zone] = this.platform.service.getCurrentTemperature(zone);
      }
    }
    this.publish('hvac/current_temperature/get', JSON.stringify(payload));
  }

  private publishHvacFanMode() {
    this.platform.log.debug(this.constructor.name, 'publishHvacFanMode');

    const fanSpeed: number = this.platform.service.getFanSpeed();

    let payload = 'low';
    if (fanSpeed > 5) {
      payload = 'medium';
    }
    if (fanSpeed > 10) {
      payload = 'high';
    }

    this.publish('hvac/fan_mode/get', payload);
  }

  private publishHvacMode() {
    this.platform.log.debug(this.constructor.name, 'publishHvacMode');

    let payload: string;
    if (this.platform.service.getFanState()) {
      payload = 'fan_only';
    } else if (!this.platform.service.getState()) {
      payload = 'off';
    } else if (this.platform.service.mode === Modes.HEAT) {
      payload = 'heat';
    } else {
      payload = 'cool';

    }
    this.publish('hvac/mode/get', payload);
  }

  private publishHvacTemperature() {
    this.platform.log.debug(this.constructor.name, 'publishHvacTemperature');

    let payload: Record<string, number> | number;
    if (this.platform.service.hasMultiSetPoint) {
      payload = {};
      for (const zone of this.platform.service.controllers) {
        if (this.platform.service.getTargetTemperature(zone) !== undefined) {
          payload[zone] = this.platform.service.getTargetTemperature(zone);
        }
      }
    } else {
      payload = this.platform.service.getTargetTemperature();
    }

    this.publish('hvac/temperature/get', JSON.stringify(payload));
  }

  private publishSwitchZone() {
    this.platform.log.debug(this.constructor.name, 'publishSwitchZone');

    for (const zone of ['A', 'B', 'C', 'D']) {
      if (this.platform.service.zones.includes(zone)) {
        const payload: string = this.platform.service.getUserEnabled(zone) ? 'on' : 'off';
        this.publish(`switch/zone/${zone.toLowerCase()}/get`, payload);
      }
    }
  }

  private publishSwitchMode() {
    this.platform.log.debug(this.constructor.name, 'publishSwitchMode');

    let payload: string;
    for (const mode of ['heat', 'cool', 'evap']) {
      if (this.platform.service.getState()) {
        payload = this.platform.service.mode === Modes[mode.toUpperCase()] ? 'on' : 'off';
      } else {
        payload = 'off';
      }
      this.publish(`switch/${mode}/get`, payload);
    }
  }

  private publishSwitchFan() {
    this.platform.log.debug(this.constructor.name, 'publishSwitchFan');

    const payload: string = this.platform.service.getFanState() ? 'on' : 'off';
    this.publish('switch/fan/get', payload);
  }

  private publishSwitchManual() {
    this.platform.log.debug(this.constructor.name, 'publishSwitchManual');

    if (this.platform.service.hasMultiSetPoint) {
      for (const zone of this.platform.service.controllers) {
        if (this.platform.service.getControlMode(zone)) {
          const payload: string = this.platform.service.getControlMode(zone) === ControlModes.MANUAL ? 'on' : 'off';
          this.publish(`switch/manual/${zone.toLowerCase()}/get`, payload);
        }
      }
    } else {
      const payload: string = this.platform.service.getControlMode() === ControlModes.MANUAL ? 'on' : 'off';
      this.publish('switch/manual/get', payload);
    }
  }

  private async publish(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'publish', topic, payload);

    try {
      if (payload === this.topicPayloads.get(topic)) {
        return;
      }
      this.topicPayloads.set(topic, payload);
      await this.client.publish(`${this.prefix}${topic}`, payload, {retain: true});
      this.platform.log.info(`MQTT: Publish: ${this.prefix}${topic}, Payload: ${payload}`);
    } catch (error) {
      this.platform.log.error(error);
    }
  }
}