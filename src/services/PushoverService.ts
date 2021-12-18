import Pushover = require('pushover-notifications');

import { RinnaiTouchPlatform } from '../platform';
import { Fault } from '../models/Fault';
import { Status, States } from '../models/Status';

export class PushoverService {
  private pushover;
  private readonly token?: string;
  private readonly users: string[] = [];
  private readonly days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  private zones: string[] = ['U'];
  private minTemperatureThreshold?: number;
  private maxTemperatureThreshold?: number;
  private connectionError = false;
  private faultDetected = false;
  private dayIncorrect = false;
  private timeIncorrect = false;

  private readonly minTemperatureThresholdSent: Map<string, boolean> = new Map();
  private readonly maxTemperatureThresholdSent: Map<string, boolean> = new Map();
  private connectionErrorSent = false;
  private faultMessageSent = '';
  private dayMessageSent = false;
  private timeMessageSent = false;

  constructor(private readonly platform: RinnaiTouchPlatform) {
    if (this.platform.settings.pushover === undefined) {
      return;
    }

    if (this.platform.settings.pushover.token === undefined) {
      return;
    }

    if (this.platform.settings.pushover.users === undefined) {
      return;
    }

    if (!Array.isArray(this.platform.settings.pushover.users)) {
      return;
    }

    this.token = this.platform.settings.pushover.token;
    this.users = this.platform.settings.pushover.users;
  }
  
  init() {
    this.platform.log.debug(this.constructor.name, 'init');

    if (this.token === undefined || this.users.length === 0) {
      return;
    }

    this.pushover = new Pushover({
      token: this.token,
    });

    this.minTemperatureThreshold = this.platform.settings.pushover?.minTemperatureThreshold;
    this.maxTemperatureThreshold = this.platform.settings.pushover?.maxTemperatureThreshold;
    this.connectionError = this.platform.settings.pushover?.connectionError ?? false;
    this.faultDetected = this.platform.settings.pushover?.faultDetected ?? false;
    this.dayIncorrect = this.platform.settings.pushover?.dayIncorrect ?? false;
    this.timeIncorrect = this.platform.settings.pushover?.timeIncorrect ?? false;

    this.platform.temperatureService.on('temperature_change', this.handleTemperatureChange.bind(this));
    this.platform.service.session.on('connection', this.handleConnection.bind(this));
    this.platform.service.on('fault', this.handleFault.bind(this));
    this.platform.service.session.on('status', this.handleStatus.bind(this));
  }

  private handleTemperatureChange(temperatures: Record<string, number | undefined>): void {
    this.platform.log.debug(this.constructor.name, 'handleTemperatureChange', temperatures);

    if (this.minTemperatureThreshold === undefined && this.maxTemperatureThreshold === undefined) {
      return;
    }

    const zones = this.platform.service.getHasMultiSetPoint()
      ? this.platform.service.getZonesInstalled()
      : ['U'];

    for(const zone of zones) {
      if (temperatures[zone] === undefined) {
        continue;
      }
      const zoneName = zone === 'U'
        ? ''
        : `[${this.platform.service.getZoneName(zone)}]`;
      
      // Min Temp Threshold
      if (this.minTemperatureThreshold !== undefined) {
        if (temperatures[zone]! < this.minTemperatureThreshold) {
          if (!(this.minTemperatureThresholdSent.get(zone) ?? false)) {
            this.sendMessage(`Temperature is below ${this.minTemperatureThreshold} degrees ${zoneName}`);
            this.minTemperatureThresholdSent.set(zone, true);
          }
        } else {
          if (temperatures[zone]! > this.minTemperatureThreshold + 1) {
            this.minTemperatureThresholdSent.set(zone, false);
          }
        }
      }

      // Max Temp Threshold
      if (this.maxTemperatureThreshold !== undefined) {
        if (temperatures[zone]! > this.maxTemperatureThreshold) {
          if (!(this.maxTemperatureThresholdSent.get(zone) ?? false)) {
            this.sendMessage(`Temperature is above ${this.maxTemperatureThreshold} degrees ${zoneName}`);
            this.maxTemperatureThresholdSent.set(zone, true);
          }
        } else {
          if (temperatures[zone]! < this.maxTemperatureThreshold - 1) {
            this.maxTemperatureThresholdSent.set(zone, false);
          }
        }
      }
    }
  }

  private handleConnection(): void {
    this.platform.log.debug(this.constructor.name, 'handleConnection');

    if (this.isBooting()) {
      return;
    }

    if (!this.connectionError) {
      return;
    }

    if (this.platform.service.session.hasConnectionError) {
      if (!this.connectionErrorSent) {
        this.sendMessage('TCP/IP Connection Error occured');
        this.connectionErrorSent = true;
      }
    } else {
      if (this.connectionErrorSent) {
        this.sendMessage('TCP/IP Connection restored');
        this.connectionErrorSent = false;
      }
    }
  }

  private handleFault(fault: Fault): void {
    this.platform.log.debug(this.constructor.name, 'handleFault', fault.toString());

    if (this.isBooting()) {
      return;
    }

    if (!this.faultDetected) {
      return;
    }

    if (fault.detected) {
      if (this.faultMessageSent !== fault.toString()) {
        this.sendMessage(fault.toString());
        this.faultMessageSent = fault.toString();
      }
    } else {
      this.faultMessageSent = '';
    }
  }

  private handleStatus(status: Status): void {
    this.platform.log.debug(this.constructor.name, 'handleStatus', status.toString());

    if (this.isBooting()) {
      return;
    }

    if (!this.dayIncorrect && !this.timeIncorrect) {
      return;
    }

    const now = new Date();
    const module_day = status.getState(States.Day);
    const module_time = status.getState(States.Time);

    if (module_day === undefined || module_time === undefined) {
      return;
    }

    const module_hours = Number(module_time.substring(0, 2));
    const module_minutes = Number(module_time.substring(3, 5));
    let day_offset = 0;
    if (now.getHours() === 0 && module_hours === 23) {
      day_offset = -1;
    } else if (now.getHours() === 23 && module_hours === 0) {
      day_offset = 1;
    }

    const module_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day_offset,
      module_hours, module_minutes, now.getSeconds());

    if (this.dayIncorrect && day_offset === 0) {
      const system_day = this.days[now.getDay()];
      if (system_day !== module_day) {
        if (!this.dayMessageSent) {
          this.sendMessage(`Controller's day (${module_day}) is different to system day (${system_day})`);
          this.dayMessageSent = true;
        }
      } else {
        this.dayMessageSent = false;
      }
    }

    if (this.timeIncorrect) {
      const timeDifference = Math.abs(now.getTime() - module_date.getTime());
     
      if (timeDifference > 180000) { // 3+ minutes out of sync
        if (!this.timeMessageSent) {
          this.sendMessage(`Controller's time (${module_time}) is more than 3 minutes out of sync with system time`);
          this.timeMessageSent = true;
        }
      } else {
        if (timeDifference < 120000) {
          this.timeMessageSent = false;
        }
      }
    }
  }

  private isBooting(): boolean {
    const bootTime = this.platform.settings.bootTime;
    if (bootTime === undefined) {
      return false;
    }

    const [bootHour, bootMinute] = bootTime.split(':').map(Number);
    const now = new Date();

    if (now.getHours() === bootHour && now.getMinutes() === bootMinute) {
      return true;
    }

    return false;
  }

  private sendMessage(message: string): void {
    this.platform.log.debug(this.constructor.name, 'sendMessage', message);

    try {
      const pushoverMessage = {
        title: this.platform.settings.name,
        message: message,
        sound: 'siren',
        priority: 0,
        user: '',
      };

      for (const user of this.users) {
        pushoverMessage.user = user;

        this.pushover.send(pushoverMessage, (error) => {
          if (error) {
            this.platform.log.warn('Pushover notification(s) failed:', error.message);
          }
        });
      }
    } catch(error) {
      if (error instanceof Error) {
        this.platform.log.warn('Pushover notification(s) failed:', error.message);
      }
    }
  }
}