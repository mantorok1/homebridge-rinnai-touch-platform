import { CharacteristicValue, PlatformAccessory } from 'homebridge';
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
      this.platformAccessory.addService(this.platform.Service.Switch, platformAccessory.displayName);

    this.setEventHandlers();
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');

    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getCharacteristicValue.bind(this, this.getAdvanceSwitchOn.bind(this), 'On'))
      .onSet(this.setCharacteristicValue.bind(this, this.setAdvanceSwitchOn.bind(this), 'On'));
  }

  getAdvanceSwitchOn(): CharacteristicValue {
    this.platform.log.debug(this.constructor.name, 'getAdvanceSwitchOn');

    let state: ScheduleOverrideModes = ScheduleOverrideModes.NONE;

    switch(this.platformAccessory.context.mode) {
      case 'A':
        state = this.platform.service.getScheduleOverride(this.platformAccessory.context.zone);
        break;
      case 'H':
        if (this.platform.service.getOperatingMode() === OperatingModes.HEATING) {
          state = this.platform.service.getScheduleOverride(this.platformAccessory.context.zone);
        }
        break;
      case 'C':
        if (this.platform.service.getOperatingMode() === OperatingModes.COOLING) {
          state = this.platform.service.getScheduleOverride(this.platformAccessory.context.zone);
        }
        break;
    }

    return state === ScheduleOverrideModes.ADVANCE;
  }

  async setAdvanceSwitchOn(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setAdvanceSwitchOn', value);

    if (this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING) {
      return;
    }

    if (value) {
      switch(this.platformAccessory.context.mode) {
        case 'H':
          await this.platform.service.setOperatingMode(OperatingModes.HEATING);
          break;
        case 'C':
          await this.platform.service.setOperatingMode(OperatingModes.COOLING);
          break;
      }

      if (!this.platform.service.getPowerState()) {
        await this.platform.service.setFanState(false);
        await this.platform.service.setPowerState(true);
      }
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