import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { ControlModes } from '../rinnai/RinnaiService';
import { AccessoryBase } from './AccessoryBase';
import { OperatingModes } from '../rinnai/RinnaiService';

export class ManualSwitch extends AccessoryBase {
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
      ? `Manual ${this.platformAccessory.context.zone}`
      : 'Manual';
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');
    
    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.getCharacteristicValue.bind(this, this.getManualSwitchOn.bind(this), 'On'))
      .on('set', this.setCharacteristicValue.bind(this, this.setManualSwitchOn.bind(this), 'On'));
  }

  getManualSwitchOn(): boolean {
    this.platform.log.debug(this.constructor.name, 'getManualSwitchOn');

    const state: ControlModes = this.platform.service.getControlMode(this.platformAccessory.context.zone);

    return state === ControlModes.MANUAL;
  }

  async setManualSwitchOn(value: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setManualSwitchOn', value);

    // For Evap the unit must be ON before setting control mode
    if (this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING) {
      await this.platform.service.setPowerState(true);
    }

    const state: ControlModes = value
      ? ControlModes.MANUAL
      : ControlModes.AUTO;

    await this.platform.service.setControlMode(state, this.platformAccessory.context.zone);
  }

  updateValues() {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .updateValue(this.getManualSwitchOn());
  }
}