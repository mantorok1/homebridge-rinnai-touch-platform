import { RinnaiTouchPlatform } from '../platform';
import { Status } from './QueueService';

export class StateService {
  private systemPaths: Record<string, string> = {
    HasMultiSP: 'SYST.CFG.MTSP',
    TempUnits: 'SYST.CFG.TU',
    ZoneName: 'SYST.CFG.Z{zone}',
    HasHeater: 'SYST.AVM.HG',
    HasCooler: 'SYST.AVM.CG',
    HasEvap: 'SYST.AVM.EC',
    Mode: 'SYST.OSS.MD',
  };

  private heatCoolPaths: Record<string, string> = {
    State: '{mode}.OOP.ST',    // oN, ofF
    FanState: '{mode}.OOP.ST',    // ofF, fanZ
    FanSpeed: '{mode}.OOP.FL',    // nn 01 - 16

    ControlMode: '{mode}.{gz}O.OP',  // Auto, Manual
    TargetTemp: '{mode}.{gz}O.SP',  // nn (08 - 30)
    ScheduleOverride: '{mode}.{gz}O.AO',  // None, Advance, Operation

    SystemActive: '{mode}.GSS.{m}C',  // Y,N
    SchedulePeriod: '{mode}.{gz}S.AT',  // Wake, Leave, Return, Presleep, Sleep  

    CurrentTemp: '{mode}.Z{zone}S.MT',   // nnn
    AutoEnabled: '{mode}.Z{zone}S.AE',   // Y,N (is heating/cooling)
    UserEnabled: '{mode}.Z{zone}O.UE',   // Y,N (Zone switch)

    ZoneInstalled: '{mode}.CFG.Z{zone}IS',   // Y,N      
  };

  private evapPaths: Record<string, string> = {
    State: 'ECOM.GSO.SW',  // oN, ofF
    FanState: 'ECOM.GSO.FS',  // oN, ofF	
    FanSpeed: 'ECOM.GSO.FL',  // nn 01 - 16

    ControlMode: 'ECOM.GSO.OP',  // Auto, Manual
    TargetTemp: 'ECOM.GSO.SP',  // nn (19 - 34) - comfort level

    SystemActive: 'ECOM.GSS.BY',  // Y,N
    CurrentTemp: 'ECOM.GSS.MT',  // nnn
    AutoEnabled: 'ECOM.GSS.Z{zone}AE',   // Y,N (is cooling)

    UserEnabled: 'ECOM.GSO.Z{zone}UE',	// Y,N (Zone switch)

    ZoneInstalled: 'ECOM.CFG.Z{zone}IS',   // Y,N

    PumpState: 'ECOM.GSO.PS',   // oN, ofF
  };

  constructor(
    private readonly platform: RinnaiTouchPlatform,
  ) {
    this.hasMtsp = false;
  }

  hasMtsp: boolean;

  getState(state: string, status: Status, zone = ''): string | undefined {
    this.platform.log.debug(this.constructor.name, 'getState', state, 'status', zone);

    if (this.hasMtsp === undefined) {
      this.hasMtsp = false;
      this.hasMtsp = this.getState('HasMultiSP', status) === 'Y';
    }

    const mode: string = Object.keys(status[1])[0];
    const path: string | undefined = this.getPath(state, mode, zone);
    if (path === undefined) {
      return;
    }

    const [group1, group2, cmd]: string[] = path.split('.');
    const item: number = group1 === 'SYST' ? 0 : 1;

    if (status[item][group1] && status[item][group1][group2] && status[item][group1][group2][cmd]) {
      return status[item][group1][group2][cmd];
    }
  }

  getPath(state: string, mode = '', zone = ''): string | undefined {
    this.platform.log.debug(this.constructor.name, 'getPath', state, mode, zone);

    let path: string = this.systemPaths[state];
    if (path === undefined) {
      path = mode !== 'ECOM'
        ? this.heatCoolPaths[state]
        : this.evapPaths[state];
    }

    if (path === undefined) {
      return;
    }

    path = path
      .replace('{mode}', mode)
      .replace('{m}', mode ? mode.substr(0, 1) : '')
      .replace('{gz}', this.hasMtsp ? 'Z{zone}' : 'GS')
      .replace('{zone}', zone);

    return path;
  }
}