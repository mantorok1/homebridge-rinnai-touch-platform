import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { AccessoryBase } from './AccessoryBase';
import { OperatingModes, ControlModes } from '../rinnai/RinnaiService';
import { debounce } from 'debounce';

export class Fan extends AccessoryBase {

  constructor(
    platform: RinnaiTouchPlatform,
    platformAccessory: PlatformAccessory,
  ) {
    super(platform, platformAccessory);

    this.service = this.platformAccessory.getService(this.platform.Service.Fan) ??
      this.platformAccessory.addService(this.platform.Service.Fan, platformAccessory.displayName);

    this.setEventHandlers();
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');
    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getCharacteristicValue.bind(this, this.getFanOn.bind(this), 'On'))
      .onSet(debounce(this.setCharacteristicValue.bind(this, this.setFanOn.bind(this), 'On'), 1000));

    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getCharacteristicValue.bind(this, this.getFanRotationSpeed.bind(this), 'RotationSpeed'))
      .onSet(debounce(this.setCharacteristicValue.bind(this, this.setFanRotationSpeed.bind(this), 'RotationSpeed'), 1000));
  }

  getFanOn(): CharacteristicValue {
    this.platform.log.debug(this.constructor.name, 'getFanOn');

    return this.platform.service.getFanState();
  }

  getFanRotationSpeed(): CharacteristicValue {
    this.platform.log.debug(this.constructor.name, 'getFanRotationSpeed');

    return this.platform.service.getFanSpeed() / 16.0 * 100.0;
  }

  async setFanOn(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanOn', value);

    // If turning fan on then ensure HEAT/COOL is off or EVAP is on
    if (value) {
      if (this.platform.service.getOperatingMode() !== OperatingModes.EVAPORATIVE_COOLING) {
        await this.platform.service.setPowerState(false);
      } else {
        await this.platform.service.setPowerState(true);
        await this.platform.service.setControlMode(ControlModes.MANUAL);
      }
    }

    await this.platform.service.setFanState(value as boolean);
  }

  async setFanRotationSpeed(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanRotationSpeed', value);

    const speed = Math.round((value as number) / 100.0 * 16.0);

    await this.setFanOn(true);
    await this.platform.service.setFanSpeed(speed);
  }

  updateValues(): void {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .updateValue(this.getFanOn());

    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .updateValue(this.getFanRotationSpeed());

    this.service
      .getCharacteristic(this.platform.Characteristic.RotationDirection)
      .updateValue(this.platform.Characteristic.RotationDirection.CLOCKWISE);
  }
}