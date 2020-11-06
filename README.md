# Rinnai Touch Platform

[![npm](https://badgen.net/npm/v/homebridge-rinnai-touch-platform) ![npm](https://badgen.net/npm/dt/homebridge-rinnai-touch-platform)](https://www.npmjs.com/package/homebridge-rinnai-touch-platform) [![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

This Homebridge Plugin allows you to control a Brivis HVAC system via a Rinnai Touch WiFi Module. It supports the following operation modes:
* Single Temperature Set Point (ie. one controller with 1 to 5 zones including the Common zone)
* Multi Temperature Set Point (ie. one controller per zone, up to 4)

Functions available:
* Displaying the current state (eg. idle, heating, cooling)
* Switching to Off, Heating or Cooling modes
* Displaying the current temperature (depends on controller model)
* Setting the desired temperature
* Switching zones On and Off
* Switching the circulation fan On and Off as well as setting rotation speed
* Turning the water pump On and Off (for Evaporative Cooling only)
* Advancing to the next period of the Programme Schedule. (eg. Leave -> Return)
* Switching between Manual and Schedule control modes
* MQTT client. See [MQTT.md](src/mqtt/MQTT.md) for details.
* Push Notifications. See "Pushover Notification Configuration" section

## Accessories

This plugin will add one or more accessories to the Home app depending on the status received from the Rinnai Touch module. Accessories are discovered automatically. The following table describes each type of accessory.

|Accessory|Description|
|-|-|
|Thermostat / Heater&nbsp;Cooler|Displays the current temperature, units (Celsius or Fahrenheit) and mode of the Brivis HVAC system. It allows you to set the desired temperature and change the mode. Modes are:<ul><li>`OFF` - System is off</li><li>`HEAT` - System is in heating mode</li><li>`COOL` - System is in cooling mode</li><li>`AUTO` - Returns system into Auto mode and the current period of the programme schedule (this option can be hidden with the `showAuto` config option). It will return to the `HEAT` or `COOL` mode when complete</li></ul>NOTES:<ul><li>One accessory will be added for each controller</li><li>Temperature units in the accessory do not determine which unit to use when displaying temperatures in the Home app. This is controlled by your phone's settings</li></ul>|
|Zone Switch|Shows if the zone is currently On or Off and allows you to change it. Zone Switches are shown if the operation mode is 'Single Temperature Set Point' and at least one zone is enabled (excluding the Common zone)<br/>NOTE: The 'Heater Cooler' accessory can be used as a zone switch|
|Fan|Displays the current state and speed setting of the circulation fan. Allows you to turn it Off or set the rotation speed<br/>NOTE: The fan can only be used when the Thermostat is in the `OFF` mode or `COOL` mode for Evaporative Cooling|
|Advance Period Switch|Shows if the Period of the Programme Schedule has been advanced and allows you to change it|
|Manual Switch|Shows if the Manual mode is On or Off and allows you to change it|
|Pump|Displays the current state of the pump if you have Evaporative Cooling. Allows you to turn it On or Off<br/>NOTE: The pump can only be used when the Thermostat is in `COOL` mode.|

## Installation
Note: This plugin requires [Homebridge](https://homebridge.io) (version 1.0.0 or above) to be installed first.

It is highly recommended that you use [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x) to install and configure the plugin. Alternatively you can install from the command line as follows:

    npm install -g homebridge-rinnai-touch-platform

## Migration from homebridge-rinnai-touch-plugin

If you currently use the old plugin (ie. `homebridge-rinnai-touch-plugin`) you must uninstall it first before installing this plugin. To uninstall from the command line:

    npm uninstall -g homebridge-rinnai-touch-plugin

Once uninstalled restart Homebridge which should clear the accessories. If this doesn't work you can delete the `cachedAccessories` file from the `.homebridge/accessories` folder.

## Configuration

This is a platform plugin that will register accessories and their services with the bridge provided by Homebridge. The plugin will attempt to discover your Rinnai Touch accessories automatically thus requiring minimal configuration to the `config.json` file.

If you find the default config is not correct for your system or not to your liking there are some overrides you can define in the `config.json` file.

|Option|Required|Type|Description|Default Value (if not supplied)|
|-|-|-|-|-|
|`platform`|Yes|string|Must be `"RinnaiTouchPlatform"`. This is the only mandatory configuration setting.||
|`name`|Yes|string|The name of the platform|`"Rinnai Touch"`|
|`address`|No|string|IP Address of the WiFi module<br/>NOTE: leave blank for auto discovery||
|`port`|No|number|Port to use for the WiFI module<br/>NOTE: leave blank for auto discovery|`27847`|
|`controllerType`|No|string|The type of accessory to use for the controller(s). Options are:<br/>`T` for Thermostat<br/>`H` for Heater Cooler|`T`|
|`zoneType`|No|string|The type of accessory to use for controlling zones (only applicable for Single Temperature Set Point). Options are:<br>`N` for None (ie. don't show any accessory for zones<br/>`S` for Switch<br/>`H` for Heater Cooler|`S`|
|`showFan`|No|boolean|Show the fan accessory in the Home app|`true`|
|`showAuto`|No|boolean|Show the `AUTO` option in the Thermostat menu|`true`|
|`showAdvanceSwitches`|No|boolean|Show the Advance Period switch accessory in the Home app|`true`|
|`showManualSwitches`|No|boolean|Show the Manual switch accessory in the Home app|`true`|
|`showHomebridgeEvents`|No|boolean|Include the homebridge events such as getting and setting characterics in the logs|`true`|
|`showModuleEvents`|No|boolean|Include the module's events (eg. commands sent) in the logs|`true`|
|`showModuleStatus`|No|boolean|Include the module's status in the logs|`false`|
|`clearCache`|No|boolean|Clear all the plugin's cached accessories from homebridge to force full discovery of accessories on restart|`false`|
|`mqtt`|No|object|See [MQTT.md](src/mqtt/MQTT.md) for details||
|`pushover`|No|object|See "Pushover Notification Configuration" for details||


#### Example: Bare mimimum

    "platforms": [
      {
        "platform": "RinnaiTouchPlatform"
      }
    ],


#### Example: Use the 'Heater Cooler' accessory

    "platforms": [
      {
        "platform": "RinnaiTouchPlatform",
        "name": "Rinnai Touch",
        "controllerType": "H"
      }
    ],

#### Example: No Auto option, Advance Period & Manual switches
This is useful if you only use Manual Control of your HVAC (ie. no programme schedules).

    "platforms": [
      {
        "platform": "RinnaiTouchPlatform",
        "name": "Rinnai Touch",
        "showAuto": false,
        "showAdvanceSwitches": false,
        "showManualSwitches": false
      }
    ],

#### Example: Showing all available options except for MQTT

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
        "showHomebridgeEvents": true,
        "showModuleEvents": true,
        "clearCache": false
      }
    ],

### Pushover Notification Configuration
This plugin can be configured to send Push notifications to your phone when certain events occur. To do this you'll need a [Pushover](https://pushover.net) account. The following describes the configuration options available:

|Option|Required|Type|Description|Default Value (if not supplied)|
|-|-|-|-|-|
|`token`|Yes|string|Application API Token supplied by Pushover||
|`users`|Yes|array|One or more User Keys supplied by Pushover. Each user will receive a push notification||
|`minTemperatureThreshold`|No|number|Notification sent when temperature falls below this value||
|`maxTemperatureThreshold`|No|number|Notification sent when temperature rises above this value||
|`connectionError`|No|boolean|Notification sent when connection error occurs|`false`||
|`faultDetected`|No|boolean|Notification sent when fault detected|`false`||
|`dayIncorrect`|No|boolean|Notification sent when controller and system day's are different|`false`||
|`timeIncorrect`|No|boolean|Notification sent when controller and system time differ by more than 3 minutes|`false`|

#### Example: Pushover notifications

    "pushover": {
      "token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "users": [
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      ],
      "minTemperatureThreshold": 15,
      "maxTemperatureThreshold": 27,
      "connectionError": true,
      "faultDetected": true,
      "dayIncorrect": false,
      "timeIncorrect": false
    },

## Version History

See [Change Log](CHANGELOG.md).

## Known Limitations / Troubleshooting
* The Rinnai Touch module appears to only allow a single client to connect to it at one time via TCP/IP. As the plugin only supports a TCP/IP connection to the module no other connections from other clients (such as the TouchApp by Rinnai) can be active at the time the plugin starts. Once a connection is established the plugin will keep it open to prevent other clients connecting to it via TCP/IP. NOTE: Once the plugin has started you can then use the TouchApp as it will connect to the module via the cloud.
* The module will disconnect if it has not received any requests after 5 minutes. To prevent this the plugin will send a blank command every minute.
* The module is also very temperamental about the TCP/IP connection. If it is not not closed properly or re-opened too quickly then a "Connection Refused" error may occur which prevents the plugin from connecting to the module. This may happen if Homebridge is not shutdown gracefully (eg. a crash). If it does happen try restarting Homebridge, the Rinnai Touch module or your router.
* Multi controller and Evaporative cooling configurations were not able to be tested so may not function properly.
* Due to the lag between sending a command to the module and it correctly reflecting that command in it's status there may be a short delay of a few seconds before the Home app shows the correct values. eg. When switching from `HEAT` to `COOL` mode some details such as the desired temperature will take a few seconds before the current value is shown.
* If the number of zones is different between the `HEAT` and `COOL` modes the Zone Switches are dynamically added or removed as necessary. The downside of this is that you will loose any changes you made to the accessory (eg. name).
* If the WiFi module does not supply a current temperature then the temperature will display as zero in the Thermostat/Heater Cooler accessory. I would have prefered it showed as blank but couldn't find a way to do it. This appears to be a limitation of the service within Homebridge.
* The 'Heater Cooler' accessory is not currently supported by Home Assistant. See https://github.com/home-assistant/core/issues/30384
