import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { AccessoryBase } from './AccessoryBase';
import { OperatingModes, ControlModes } from '../rinnai/RinnaiService';

export class Pump extends AccessoryBase {
  constructor(
    platform: RinnaiTouchPlatform,
    platformAccessory: PlatformAccessory,  
  ) {
    super(platform, platformAccessory);

    this.service = this.platformAccessory.getService(this.platform.Service.Valve) ??
      this.platformAccessory.addService(this.platform.Service.Valve, platformAccessory.displayName);

    this.setEventHandlers();
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');

    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getCharacteristicValue.bind(this, this.getPumpActive.bind(this), 'Active'))
      .onSet(this.setCharacteristicValue.bind(this, this.setPumpActive.bind(this), 'Active'));

    this.service
      .getCharacteristic(this.platform.Characteristic.InUse)
      .onGet(this.getCharacteristicValue.bind(this, this.getPumpInUse.bind(this), 'InUse'));
  }

  getPumpActive(): CharacteristicValue {
    this.platform.log.debug(this.constructor.name, 'getPumpActive');

    const state: boolean = this.platform.service.getPumpState();

    return state
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;
  }

  getPumpInUse(): CharacteristicValue {
    this.platform.log.debug(this.constructor.name, 'getPumpInUse');

    const state: boolean = this.platform.service.getPumpState();

    return state
      ? this.platform.Characteristic.InUse.IN_USE
      : this.platform.Characteristic.InUse.NOT_IN_USE;
  }

  async setPumpActive(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setPumpActive', value);

    const state: boolean = value === this.platform.Characteristic.Active.ACTIVE;

    if (value) {
      await this.platform.service.setOperatingMode(OperatingModes.EVAPORATIVE_COOLING);
      await this.platform.service.setPowerState(true);
      await this.platform.service.setControlMode(ControlModes.MANUAL);
    }

    await this.platform.service.setPumpState(state);
  }

  updateValues(): void {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .updateValue(this.getPumpActive());

    this.service
      .getCharacteristic(this.platform.Characteristic.InUse)
      .updateValue(this.getPumpInUse());

    this.service
      .getCharacteristic(this.platform.Characteristic.ValveType)
      .updateValue(this.platform.Characteristic.ValveType.GENERIC_VALVE);
  }
}