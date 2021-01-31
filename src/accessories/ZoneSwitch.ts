import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { OperatingModes } from '../rinnai/RinnaiService';
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
    const name = this.platform.service.getZoneName(this.platformAccessory.context.zone) + ' ' +
      this.modeNames[this.platformAccessory.context.mode];
    return name.trim();
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

    switch(this.platformAccessory.context.mode) {
      case 'A':
        return this.platform.service.getUserEnabled(this.platformAccessory.context.zone);
      case 'H':
        return this.platform.service.getOperatingMode() === OperatingModes.HEATING
          ? this.platform.service.getUserEnabled(this.platformAccessory.context.zone)
          : false;
      case 'C':
        return this.platform.service.getOperatingMode() === OperatingModes.COOLING
          ? this.platform.service.getUserEnabled(this.platformAccessory.context.zone)
          : false;
      case 'E':
        return this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING
          ? this.platform.service.getUserEnabled(this.platformAccessory.context.zone)
          : false;
      case 'F':
        return this.platform.service.getFanState()
          ? this.platform.service.getUserEnabled(this.platformAccessory.context.zone)
          : false;
      default:
        return false;
    }
  }

  async setZoneSwitchOn(value: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setZoneSwitchOn', value);

    if (value) {
      switch(this.platformAccessory.context.mode) {
        case 'H':
          await this.platform.service.setOperatingMode(OperatingModes.HEATING);
          break;
        case 'C':
          await this.platform.service.setOperatingMode(OperatingModes.COOLING);
          break;
        case 'E':
          await this.platform.service.setOperatingMode(OperatingModes.EVAPORATIVE_COOLING);
          break;
      }

      if (this.platformAccessory.context.mode === 'F') {
        await this.platform.service.setPowerState(false);
        await this.platform.service.setFanState(true);
      } else {
        if (!this.platform.service.getFanState() && !this.platform.service.getPowerState()) {
          await this.platform.service.setPowerState(true);
        }
      }
    }

    await this.platform.service.setUserEnabled(value, this.platformAccessory.context.zone);
  }

  updateValues(): void {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .updateValue(this.getZoneSwitchOn());
  }
}