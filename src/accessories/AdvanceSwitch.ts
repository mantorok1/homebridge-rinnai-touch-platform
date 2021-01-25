import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { OperatingModes, ControlModes, ScheduleOverrideModes } from '../rinnai/RinnaiService';
import { AccessoryBase } from './AccessoryBase';

export class AdvanceSwitch extends AccessoryBase {
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
    return this.platform.service.getHasMultiSetPoint()
      ? `Advance Period ${this.platformAccessory.context.zone}`
      : 'Advance Period';
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');

    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.getCharacteristicValue.bind(this, this.getAdvanceSwitchOn.bind(this), 'On'))
      .on('set', this.setCharacteristicValue.bind(this, this.setAdvanceSwitchOn.bind(this), 'On'));
  }

  getAdvanceSwitchOn(): boolean {
    this.platform.log.debug(this.constructor.name, 'getAdvanceSwitchOn');

    const state: ScheduleOverrideModes = this.platform.service.getScheduleOverride(this.platformAccessory.context.zone);

    return state === ScheduleOverrideModes.ADVANCE;
  }

  async setAdvanceSwitchOn(value: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setAdvanceSwitchOn', value);

    if (this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING) {
      return;
    }

    const state: ScheduleOverrideModes = value
      ? ScheduleOverrideModes.ADVANCE
      : ScheduleOverrideModes.NONE;

    await this.platform.service.setControlMode(ControlModes.AUTO, this.platformAccessory.context.zone);
    await this.platform.service.setScheduleOverride(state, this.platformAccessory.context.zone);
  }

  updateValues(): void {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .updateValue(this.getAdvanceSwitchOn());
  }
}