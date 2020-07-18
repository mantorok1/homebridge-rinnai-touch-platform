import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { AccessoryBase } from './AccessoryBase';

export class ZoneSwitch extends AccessoryBase {
  constructor(
    platform: RinnaiTouchPlatform,
    platformAccessory: PlatformAccessory,   
  ) {
    super(platform, platformAccessory);

    this.service = this.platformAccessory.getService(this.platform.Service.Switch) ??
      this.platformAccessory.addService(this.platform.Service.Switch, this.serviceName);

    this.setEventHandlers();
  }

  get serviceName(): string {
    return this.platform.service.getZoneName(this.platformAccessory.context.zone);
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');
    
    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.getCharacteristicValue.bind(this, this.getZoneSwitchOn.bind(this), 'On'))
      .on('set', this.setCharacteristicValue.bind(this, this.setZoneSwitchOn.bind(this), 'On'));
  }

  getZoneSwitchOn(): boolean {
    this.platform.log.debug(this.constructor.name, 'getZoneSwitchOn');

    return this.platform.service.getUserEnabled(this.platformAccessory.context.zone);
  }

  async setZoneSwitchOn(value: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setZoneSwitchOn', value);

    await this.platform.service.setUserEnabled(value, this.platformAccessory.context.zone);
  }

  updateValues(): void {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .updateValue(this.getZoneSwitchOn());
  }
}