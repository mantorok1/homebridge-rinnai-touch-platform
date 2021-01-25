import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { AccessoryBase } from './AccessoryBase';
import { OperatingModes, ControlModes } from '../rinnai/RinnaiService';

export class Fan extends AccessoryBase {

  constructor(
    platform: RinnaiTouchPlatform,
    platformAccessory: PlatformAccessory,
  ) {
    super(platform, platformAccessory);

    this.service = this.platformAccessory.getService(this.platform.Service.Fan) ??
      this.platformAccessory.addService(this.platform.Service.Fan, this.serviceName);

    this.setEventHandlers();
  }

  get serviceName(): string {
    return 'Circulation Fan';
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');
    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.getCharacteristicValue.bind(this, this.getFanOn.bind(this), 'On'))
      .on('set', this.setCharacteristicValue.bind(this, this.setFanOn.bind(this), 'On'));

    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .on('get', this.getCharacteristicValue.bind(this, this.getFanRotationSpeed.bind(this), 'RotationSpeed'))
      .on('set', this.setCharacteristicValue.bind(this, this.setFanRotationSpeed.bind(this), 'RotationSpeed'));
  }

  getFanOn(): boolean {
    this.platform.log.debug(this.constructor.name, 'getFanOn');

    return this.platform.service.getFanState();
  }

  getFanRotationSpeed(): number {
    this.platform.log.debug(this.constructor.name, 'getFanRotationSpeed');

    return this.platform.service.getFanSpeed() / 16.0 * 100.0;
  }

  async setFanOn(value: boolean): Promise<void> {
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

    await this.platform.service.setFanState(value);
  }

  async setFanRotationSpeed(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setFanRotationSpeed', value);

    const speed = Math.round(value / 100.0 * 16.0);

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