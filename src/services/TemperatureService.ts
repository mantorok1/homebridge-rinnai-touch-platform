import events = require('events');
import { RinnaiTouchPlatform } from '../platform';

export class TemperatureService extends events.EventEmitter {
  private readonly temperatures: Record<string, number | undefined> = {};
  private readonly override: Record<string, boolean> = {}

  constructor(private readonly platform: RinnaiTouchPlatform) {
    super();
    this.setMaxListeners(15);
    for(const zone of this.platform.service.AllZones) {
      this.temperatures[zone] = undefined;
      this.override[zone] = false;
    }

    this.platform.service.session.on('status', () => {
      let temperatureChanged = false;
      for(const zone of this.platform.service.AllZones) {
        const temperature = this.platform.service.getMeasuredTemperature(zone);
        if (temperature !== undefined && temperature !== this.temperatures[zone] && !this.override[zone] ) {
          this.temperatures[zone] = temperature;
          temperatureChanged = true;
        }
      }
      if (temperatureChanged) {
        this.emit('temperature_change', this.getTemperatures());
      }
    });
  }

  getTemperature(zone = 'U'): number | undefined {
    return this.temperatures[zone];
  }

  getTemperatures(): Record<string, number | undefined> {
    return this.temperatures;
  }

  setTemperature(zone: string, temperature: number): void {
    if (temperature !== this.temperatures[zone]) {
      this.temperatures[zone] = temperature;
      this.override[zone] = true;
      this.emit('temperature_change', this.getTemperatures());
    }
  }
}