# Homebridge Plugin for the Rinnai Touch WiFi Module

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

## Accessories

This plugin will add one or more accessories to the Home app depending on your Rinnai Touch status. Accessories are discovered automatically without any need to modify the config.json file. The following table describes each type of accessory.

|Accessory|Description|
|-|-|
|Thermostat / Heater&nbsp;Cooler|Displays the current temperature, units (Celsius or Fahrenheit) and mode of the Brivis HVAC system. It allows you to set the desired temperature and change the mode. Modes are:<ul><li>`OFF` - System is off</li><li>`HEAT` - System is in heating mode</li><li>`COOL` - System is in cooling mode</li><li>`AUTO` - Returns system into Auto mode and the current period of the programme schedule (this option can be hidden with the `showAuto` config option). It will return to the `HEAT` or `COOL` mode when complete</li></ul>NOTES:<ul><li>One accessory will be added for each controller</li><li>Temperature units in the accessory do not determine which unit to use when displaying temperatures in the Home app. This is controlled by your phone's settings</li></ul>|
|Zone Switch|Shows if the zone is currently On or Off and allows you to change it. Zone Switches are shown if the operation mode is 'Single Temperature Set Point' and at least one zone is enabled (excluding the Common zone)<br/>NOTE: The 'Heater Cooler' accessory can be used as a zone switch|
|Fan|Displays the current state and speed setting of the circulation fan. Allows you to turn it Off or set the rotation speed<br/>NOTE: The fan can only be used when the Thermostat is in the `OFF` mode or `COOL` mode for Evaporative Cooling|
|Advance Period Switch|Shows if the Period of the Programme Schedule has been advanced and allows you to change it|
|Manual Switch|Shows if the Manual mode is On or Off and allows you to change it|
|Pump|Displays the current state of the pump if you have Evaporative Cooling. Allows you to turn it On or Off<br/>NOTE: The pump can only be used when the Thermostat is in `COOL` mode.|

## Installation
Note: This plugin requires homebridge (version 1.0.0 or above) to be installed first.

To install or upgrade to the latest version of this plugin:

    npm install -g homebridge-rinnai-touch-platform

## Migration from homebridge-rinnai-touch-plugin

If you currently use the old plugin (ie. `homebridge-rinnai-touch-plugin`) you must uninstall it first before installing this plugin. To uninstall from the command line:

    npm uninstall -g homebridge-rinnai-touch-plugin

It is also recommended that you remove the `cachedAccessories` file from the `.homebridge/accessories` folder.

## Configuration

This is a platform plugin that will register accessories and their services with the Bridge provided by homebridge. The plugin will attempt to discover your Rinnai Touch accessories automatically thus requiring minimal configuration to the config.json file.

If you find the auto config is not correct for your system or some defaults are not to your liking there are some overrides you can define in the config.json file.

|Option|Description|Default Value (if not supplied)|
|-|-|-|
|`platform`|Must be `"RinnaiTouchPlatform"`. This is the only mandatory configuration setting.||
|`name`|The name of the platform|`"Rinnai Touch"`|
|`address`|IP Address of the WiFi module<br/>NOTE: leave blank for auto discovery||
|`port`|Port to use for the WiFI module<br/>NOTE: leave blank for auto discovery|`27847`|
|`controllerType`|The type of accessory to use for the controller(s). Options are:<br/>`T` for Thermostat<br/>`H` for Heater Cooler|`T`|
|`zoneType`|The type of accessory to use for controlling zones (only applicable for Single Temperature Set Point). Options are:<br>`N` for None (ie. don't show any accessory for zones<br/>`S` for Switch<br/>`H` for Heater Cooler|`S`|
|`showFan`|Show the fan accessory in the Home app|`true`|
|`showAuto`|Show the `AUTO` option in the Thermostat menu|`true`|
|`showAdvanceSwitches`|Show the Advance Period switch accessory in the Home app|`true`|
|`showManualSwitches`|Show the Manual switch accessory in the Home app|`true`|
|`closeConnectionDelay`|The time (ms) to wait for the TCP connection to fully close. Increasing this may reduce `Connection Refused` errors from occuring|`1100`|
|`connectionTimeout`|The time (ms) to wait to close the TCP connection after the last request. Set to `-1` to keep the connection open indefinitely, or `0` to close immediately|`5000`|
|`clearCache`|Clear all the plugin's cached accessories from homebridge to force full discovery of accessories on restart|`false`|
|`mqtt`|See [MQTT.md](src/mqtt/MQTT.md) for details|`{}`|


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

## Version History

See [Change Log](CHANGELOG.md).

## Known Limitations
* The plugin only supports a TCP connection over a LAN so no other connections can be active at the time. This would typically be the TouchApp by Rinnai.
* If the TCP connection is not closed properly then no further connections can be made to the module. I've tried to mitigate this as best I can by keeping TCP connections as short as possible and only allowing one request at a time. If it does happen I find rebooting my router clears it but rebooting the module itself should work also.
* Multi controller and Evaporative cooling configurations were not able to be tested so may not function properly.
* Due to the lag between sending a command to the module and it correctly reflecting that command in it's status there may be a short delay of a few seconds before the Home app shows the correct values. eg. When switching from HEAT to COOL mode some details such as the desired temperature will take a few seconds before the current value is shown.
* If the number of zones is different between the `Heat` and `Cool` modes the Zone Switches are dynamically added or removed as necessary. The downside of this is that you will loose any changes you made to the accessory (eg. name).
* If the WiFi module does not supply a current temperature then the temperature will display as zero in the Thermostat/Heater Cooler accessory. I would have prefered it showed as blank but couldn't find a way to do it. This appears to be a limitation of the service within Homebridge.
* The WiFi module will close the TCP connection after 5 minutes of inactivity. If the connection timeout is set to never (ie. `-1`) the plugin will attempt to automatically reconnect.
* The 'Heater Cooler' accessory is not currently supported by Home Assistant. See https://github.com/home-assistant/core/issues/30384
