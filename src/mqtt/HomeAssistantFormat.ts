import mqtt = require('async-mqtt');

import { RinnaiTouchPlatform } from '../platform';
import { IMqttFormat } from './MqttService';
import { OperatingModes, ControlModes } from '../rinnai/RinnaiService';

export class HomeAssistantFormat implements IMqttFormat {
  private readonly subTopics: Map<string, (topic: string, payload: string) => Promise<void>> = new Map();
  private readonly topicPayloads: Map<string, string> = new Map();
  private readonly prefix: string;
  private readonly modeMap: Record<string, OperatingModes> = {
    'heat': OperatingModes.HEATING,
    'cool': OperatingModes.COOLING,
    'evap': OperatingModes.EVAPORATIVE_COOLING,
  };

  constructor(
    private readonly platform: RinnaiTouchPlatform,
    private readonly client: mqtt.AsyncMqttClient,
  ) {
    this.prefix = this.platform.settings.mqtt!.topicPrefix
      ? `${this.platform.settings.mqtt!.topicPrefix}/`
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
    if (this.platform.settings.mqtt!.publishStatusChanged) {
      this.platform.service.session.on('status', () => {
        this.publishTopics();
      });
      this.platform.temperatureService.on('temperature_change', () => {
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
      if (!this.platform.service.getFanState()) {
        this.platform.log.warn('MQTT: Setting fan mode only supported for "fan_only" mode');
        await this.publishTopics();
        return;
      }

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
          await this.publishTopics();
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
          await this.platform.service.setPowerState(false);
          await this.platform.service.setFanState(true);
          break;
        case 'off':
          await this.platform.service.setPowerState(false);
          await this.platform.service.setFanState(false);
          break;
        case 'heat':
          await this.platform.service.setFanState(false);
          await this.platform.service.setOperatingMode(OperatingModes.HEATING);
          await this.platform.service.setPowerState(true);
          break;
        case 'cool':
          await this.platform.service.setFanState(false);
          await this.platform.service.setOperatingMode(this.platform.service.getHasEvaporative()
            ? OperatingModes.EVAPORATIVE_COOLING
            : OperatingModes.COOLING);
          await this.platform.service.setPowerState(true);
          break;
        default:
          this.platform.log.warn(`MQTT: Invalid mode '${payload}' in payload`);
          await this.publishTopics();
          return;
      }  
    } catch(error) {
      this.platform.log.error(error);
    }
  }

  private async setHvacTemperature(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setTemperature', topic, payload);

    try {
      if (!this.platform.service.getPowerState() || this.platform.service.getFanState()) {
        this.platform.log.warn('MQTT: Setting temperature only supported for "heat" and "cool" modes');
        await this.publishTopics();
        return;
      }

      const json: Record<string, number> | number = JSON.parse(payload);
      if (typeof json === 'object') {
        for (const zone in json) {
          if (this.isValidTemperature(json[zone])) {
            await this.platform.service.setSetPointTemperature(json[zone], zone);
          } else {
            await this.publishTopics();
          }
        }
      } else {
        if (this.isValidTemperature(json)) {
          await this.platform.service.setSetPointTemperature(json);
        } else {
          await this.publishTopics();
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
      const mode = this.getTopicComponent(topic, -2).toLowerCase();
      const operatingMode: OperatingModes = this.modeMap[mode];
      const state: boolean = payload.toLowerCase() === 'on';

      if (this.platform.service.getFanState()) {
        await this.platform.service.setFanState(false);
      }

      if (state) {
        await this.platform.service.setOperatingMode(operatingMode);
        await this.platform.service.setPowerState(true);
      } else {
        await this.platform.service.setPowerState(false);
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private async setSwitchFan(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanState', topic, payload);

    try {
      const state: boolean = payload.toLowerCase() === 'on';

      // TODO: This won't work for evap which must be on for fan to work ???
      if (state && this.platform.service.getPowerState()) {
        await this.platform.service.setPowerState(false);
      }

      await this.platform.service.setFanState(state);
    } catch (error) {
      this.platform.log.error(error);
    }
  }

  private async setSwitchManual(topic: string, payload: string): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setSwitchManual', topic, payload);

    try {
      if (!this.platform.service.getPowerState() && !this.platform.service.getFanState()) {
        this.platform.log.warn('MQTT: Setting manual operation not supported for "off" mode');
        await this.publishTopics();
        return;
      }

      let zone: string = this.getTopicComponent(topic, -2).toUpperCase();
      zone = zone.length !== 1 ? 'U' : zone;
      const state: ControlModes = payload.toLowerCase() === 'on'
        ? ControlModes.MANUAL
        : ControlModes.AUTO;

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
      // this.platform.service.updateStates();

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
    for(const zone of this.platform.service.getZonesInstalled()) {
      if (!this.platform.service.getUserEnabled(zone)) {
        payload[zone] = 'off';
        continue;
      }
      if (this.platform.service.getFanState()) {
        payload[zone] = 'fan';
        continue;
      }
      if (!this.platform.service.getPowerState()) {
        payload[zone] = 'off';
        continue;
      }
      if (!this.platform.service.getAutoEnabled(zone)) {
        payload[zone] = 'idle';
        continue;
      }
      payload[zone] = this.platform.service.getOperatingMode() === OperatingModes.HEATING
        ? 'heating'
        : 'cooling';
    }
    this.publish('hvac/action/get', JSON.stringify(payload));
  }

  private publishHvacCurrentTemperature() {
    this.platform.log.debug(this.constructor.name, 'publishHvacCurrentTemperature');

    const payload: Record<string, number> = {};
    for(const zone of this.platform.service.getZonesInstalled()) {
      const temperature = this.platform.temperatureService.getTemperature(zone);
      if (temperature !== undefined) {
        payload[zone] = temperature;
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
    } else if (!this.platform.service.getPowerState()) {
      payload = 'off';
    } else if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
      payload = 'heat';
    } else {
      payload = 'cool';

    }
    this.publish('hvac/mode/get', payload);
  }

  private publishHvacTemperature() {
    this.platform.log.debug(this.constructor.name, 'publishHvacTemperature');

    let payload: Record<string, number> | number;
    if (this.platform.service.getHasMultiSetPoint()) {
      payload = {};
      for (const zone of this.platform.service.getZonesInstalled()) {
        if (this.platform.service.getSetPointTemperature(zone) !== undefined) {
          payload[zone] = this.platform.service.getSetPointTemperature(zone);
        }
      }
    } else {
      payload = this.platform.service.getSetPointTemperature();
    }

    this.publish('hvac/temperature/get', JSON.stringify(payload));
  }

  private publishSwitchZone() {
    this.platform.log.debug(this.constructor.name, 'publishSwitchZone');

    const zonesInstalled = this.platform.service.getZonesInstalled();
    for (const zone of ['A', 'B', 'C', 'D']) {
      if (zonesInstalled.includes(zone)) {
        const payload: string = this.platform.service.getUserEnabled(zone) ? 'on' : 'off';
        this.publish(`switch/zone/${zone.toLowerCase()}/get`, payload);
      } else {
        this.publish(`switch/zone/${zone.toLowerCase()}/get`, 'off');
      }
    }
  }

  private publishSwitchMode() {
    this.platform.log.debug(this.constructor.name, 'publishSwitchMode');

    let payload: string;
    for (const mode of ['heat', 'cool', 'evap']) {
      if (this.platform.service.getPowerState()) {
        payload = this.platform.service.getOperatingMode() === this.modeMap[mode] ? 'on' : 'off';
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

    if (this.platform.service.getHasMultiSetPoint()) {
      for (const zone of this.platform.service.getZonesInstalled()) {
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
      if (payload === this.topicPayloads.get(topic) && !this.platform.settings.mqtt!.publishAll) {
        return;
      }
      this.topicPayloads.set(topic, payload);
      await this.client.publish(`${this.prefix}${topic}`, payload, {retain: true});
      if (this.platform.settings.mqtt!.showMqttEvents) {
        this.platform.log.info(`MQTT: Publish: ${this.prefix}${topic}, Payload: ${payload}`);
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }
}