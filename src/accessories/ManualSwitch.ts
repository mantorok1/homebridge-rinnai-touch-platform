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
    let name = 'Manual';
    if (this.platform.service.getHasMultiSetPoint()) {
      name += ` ${this.platform.service.getZoneName(this.platformAccessory.context.zone)}`;
    }
    name += ` ${this.modeNames[this.platformAccessory.context.mode]}`;
    
    return name.trim();
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

    let state: ControlModes = ControlModes.AUTO;

    switch(this.platformAccessory.context.mode) {
      case 'A':
        state = this.platform.service.getControlMode(this.platformAccessory.context.zone);
        break;
      case 'H':
        if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
          state = this.platform.service.getControlMode(this.platformAccessory.context.zone);
        }
        break;
      case 'C':
        if (this.platform.service.getOperatingMode() === OperatingModes.COOLING) {
          state = this.platform.service.getControlMode(this.platformAccessory.context.zone);
        }
        break;
      case 'E':
        if (this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING) {
          state = this.platform.service.getControlMode(this.platformAccessory.context.zone);
        }
        break;
    }

    return state === ControlModes.MANUAL;
  }

  async setManualSwitchOn(value: boolean): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setManualSwitchOn', value);

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

      if (!this.platform.service.getPowerState()) {
        await this.platform.service.setFanState(false);
        await this.platform.service.setPowerState(true);
      }
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