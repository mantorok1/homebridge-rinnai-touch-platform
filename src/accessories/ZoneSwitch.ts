import { CharacteristicValue, PlatformAccessory } from 'homebridge';
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
      this.platformAccessory.addService(this.platform.Service.Switch, platformAccessory.displayName);

    this.setEventHandlers();
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');
    
    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getCharacteristicValue.bind(this, this.getZoneSwitchOn.bind(this), 'On'))
      .onSet(this.setCharacteristicValue.bind(this, this.setZoneSwitchOn.bind(this), 'On'));
  }

  getZoneSwitchOn(): CharacteristicValue {
    this.platform.log.debug(this.constructor.name, 'getZoneSwitchOn');

    if (this.platformAccessory.context.mode !== 'F') {
      if (this.platform.settings.seperateFanZoneSwitches && this.platform.service.getFanState()) {
        return false;
      }
    }

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

  async setZoneSwitchOn(value: CharacteristicValue): Promise<void> {
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

      if (!this.platform.service.getZoneInstalled(this.platformAccessory.context.zone)) {
        const zoneName = this.platform.service.getZoneName(this.platformAccessory.context.zone);
        this.platform.log.warn(`'${zoneName}' cannot be turned on as it's not installed`);
        setTimeout(this.updateValues.bind(this), 1000);
        return;
      }

      if (this.platformAccessory.context.mode === 'F') {
        if (this.platform.service.getOperatingMode() === OperatingModes.EVAPORATIVE_COOLING) {
          this.platform.log.warn('Fan Zone Switch is not supported for Evaporative Cooling');
          setTimeout(this.updateValues.bind(this), 1000);
          return;
        }
        await this.platform.service.setPowerState(false);
        await this.platform.service.setFanState(true);
      } else {
        if (this.platform.settings.seperateFanZoneSwitches && this.platform.service.getFanState()) {
          await this.platform.service.setFanState(false);
          await this.platform.service.setPowerState(true);
        } else {
          if (!this.platform.service.getFanState() && !this.platform.service.getPowerState()) {
            await this.platform.service.setPowerState(true);
          }
        }
      }
    }

    await this.platform.service.setUserEnabled(value as boolean, this.platformAccessory.context.zone);
  }

  updateValues(): void {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .updateValue(this.getZoneSwitchOn());
  }
}