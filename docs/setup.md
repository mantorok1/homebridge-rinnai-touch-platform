# Setup

This plugin requires [Homebridge](https://homebridge.io) (version 1.6 or above) to be installed first. It is highly recommended that you use the Homebridge UI to install and configure the plugin. Alternatively you can do it manually as described below.

## Installation

You can manually install from the command line as follows:

```
npm install -g homebridge-rinnai-touch-platform
```

## Configuration

To configue manually you will need some basic knowledge of JSON. The Homebridge configuration can be found in the `config.json` file.

The following describes each of the available keys for the plugin:

|Key|Required|Type|Description|Default Value (if not supplied)|
|-|-|-|-|-|
|`platform`|Yes|string|Must be `"RinnaiTouchPlatform"`. This is the only mandatory configuration setting.||
|`name`|Yes|string|The name of the platform|`"Rinnai Touch"`|
|`address`|No|string|IP Address of the WiFi module<br/>NOTE: leave blank for auto discovery||
|`port`|No|number|Port to use for the WiFI module<br/>NOTE: leave blank for auto discovery|`27847`|
|`controllerType`|No|string|The type of accessory to use for the controller(s). Options are:<br/>`T` for Thermostat<br/>`H` for Heater Cooler|`T`|
|`zoneType`|No|string|The type of accessory to use for controlling zones (only applicable for Single Temperature Set Point). Options are:<br>`N` for None (ie. hide accessory for zones)<br/>`S` for Switch<br/>`H` for Heater Cooler|`S`|
|`showFan`|No|boolean|Show the fan accessory in the Home app|`true`|
|`showAuto`|No|boolean|Show the `AUTO` option in the Thermostat menu|`true`|
|`showAdvanceSwitches`|No|boolean|Show the Advance Period switch accessory in the Home app|`true`|
|`showManualSwitches`|No|boolean|Show the Manual switch accessory in the Home app|`true`|
|`seperateModeAccessories`|No|boolean|Seperate accessories (eg. Zone switches) for each mode (heat & cool)<br/>NOTE: Only applicable for systems that have both heating and cooling. If `zoneType` is set to `H` (HeaterCooler) then zone switches are not shown|`false`|
|`seperateFanZoneSwitches`|No|boolean|Seperate zone switches for circulation fan<br/>NOTE: Not applicable for Evaporative Cooling|`false`|
|`invertComfortLevel`|No|boolean|Invert the Comfort Level when setting temperature (ie. Increasing temperature on Thermostat will decrease the Comfort Level)<br/>NOTE: Only applicable for Evaporative Cooling|`true`|
|`setAutoOperatingState`|No|boolean|Set Operating state to `AUTO` when setting temperature<br/>NOTE: Only applicable for Evaporative Cooling|`true`|
|`showHomebridgeEvents`|No|boolean|Include the homebridge events such as getting and setting characterics in the logs|`true`|
|`showModuleEvents`|No|boolean|Include the module's events (eg. commands sent) in the logs|`true`|
|`showModuleStatus`|No|boolean|Include the module's status in the logs|`false`|
|`clearCache`|No|boolean|Clear all the plugin's cached accessories from homebridge to force re-creation of HomeKit accessories on restart<br/>This is equivalent to deleting the `cachedAccessories` file|`false`|
|`forceAutoDiscovery`|No|boolean|Force auto-discovery of HVAC config on restart<br/>This is equivalent to deleting the `RinnaiTouchPlatform.json` file|`false`|
|`bootTime`|No|string|Time to boot the module in hh:mm 24 hour format (eg. 02:00 for 2am or 23:30 for 11:30pm)<br/>NOTE: leave blank to prevent booting module||
|`bootPassword`|No|string|The module's Default Security Key (WPA). This can be found on the QR Code sticker that came with the module or on the Touch app's "Current Connection Information" screen<br/>NOTE: This is only required for booting the module||
|`mqtt`|No|object|See [MQTT Configuration](./mqtt.md#configuration)||
|`pushover`|No|object|See [Pushover Notification Configuration](./pushover.md#configuration)||

### Example Configurations 

#### Bare mimimum
```
    "platforms": [
      {
        "platform": "RinnaiTouchPlatform"
      }
    ],
```

#### Use the 'Heater Cooler' accessory
```
    "platforms": [
      {
        "platform": "RinnaiTouchPlatform",
        "name": "Rinnai Touch",
        "controllerType": "H"
      }
    ],
```

#### No Auto option, Advance Period & Manual switches
This is useful if you only use Manual Control of your HVAC (ie. no programme schedules).
```
    "platforms": [
      {
        "platform": "RinnaiTouchPlatform",
        "name": "Rinnai Touch",
        "showAuto": false,
        "showAdvanceSwitches": false,
        "showManualSwitches": false
      }
    ],
```

#### All available options except for MQTT & Pushover Notifications
```
    "platforms": [
      {
        "platform": "RinnaiTouchPlatform",
        "name": "Rinnai Touch",
        "controllerType": "H",
        "zoneType": "S",
        "showFan": true,
        "showAuto": true,
        "showAdvanceSwitches": true,
        "showManualSwitches": true,
        "seperateModeAccessories": true,
        "seperateFanZoneSwitches": true,
        "showHomebridgeEvents": true,
        "showModuleEvents": true,
        "clearCache": false,
        "forceAutoDiscovery": false,
        "bootTime": "02:00",
        "bootPassword": "AA00AAAA00"
      }
    ],
```