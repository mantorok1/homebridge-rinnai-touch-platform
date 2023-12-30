# Accessories

This is a platform plugin that will register HomeKit accessories and their services with the bridge provided by Homebridge. The plugin will attempt to discover your Rinnai/Brivis system's capabilities automatically and create equivalent HomeKit accessories.

|Accessory|Description|
|-|-|
|Thermostat / Heater&nbsp;Cooler|Displays the current temperature, units (Celsius or Fahrenheit) and mode of the HVAC system. It allows you to set the desired temperature and change the mode. Modes are:<ul><li>`OFF` - No heating or cooling</li><li>`HEAT` - Heat to the set temperature</li><li>`COOL` - Cool to the set temperature</li><li>`AUTO` -  Maintain the temperature between the set range (see "Notes about AUTO mode" below)</li></ul>NOTES:<ul><li>One accessory will be added for each controller</li><li>Temperature units in the accessory do not determine which unit to use when displaying temperatures in the Home app. This is controlled by your phone's settings</li></ul>|
|Zone Switch|Shows if the zone is currently On or Off and allows you to change it. Zone Switches are shown if the operation mode is 'Single Temperature Set Point' and at least one zone is enabled (excluding the Common zone)<br/>NOTE: The 'Heater Cooler' accessory can be used as a zone switch which has the advantage of showing the zone's temperature|
|Fan|Displays the current state and speed setting of the circulation fan. Allows you to turn it Off or set the rotation speed<br/>NOTE: The fan can only be used when the Thermostat is in the `OFF` mode or `COOL` mode for Evaporative Cooling|
|Advance Period Switch|Shows if the Period of the Programme Schedule has been advanced and allows you to change it|
|Manual Switch|Shows if the Manual mode is On or Off and allows you to change it|
|Pump|Displays the current state of the pump if you have Evaporative Cooling. Allows you to turn it On or Off<br/>NOTE: The pump can only be used when the Thermostat is in `COOL` mode.|

### Multi Temperature Set Point (MTSP)

For MTSP when in Heat and Cool modes the zones are turned off by setting the temperature to less than 8 degrees. The zone switches will not work except when in fan mode.

### AUTO mode

This is an experimental feature so may be a little "buggy".

The HomeKit Thermostat/Heater Cooler accessory's `AUTO` mode is used to set a temperature range which the HVAC will attempt to keep your home's temperature within. The module does not support this type of operation so this plugin attempts to simulate this behaviour by checking the current temperature with the temperature limits set in `AUTO` mode. It will switch mode between Heating & Cooling where necessary to maintain the temperature within the specified range. The module does have its own concept of an AUTO mode (aka Schedule mode) but this is for setting temperatures for different periods of the day (or setting a Comfort Level for Evaporative Cooling). For the accessory's `AUTO` mode to work the module's `AUTO` mode cannot be used.

Requirements for `AUTO` mode to function correctly:
* `showAuto` configuration option set to `true`
* The HVAC must remain in `MANUAL` operation
* The HVAC must have Heating and Add-on Cooling. Evaporative cooling is not supported
* The controller(s) must supply the current temperature to the module. Not all controllers support this. Alternatively you can supply the current temperature from 3rd party temperature sensors using MQTT, however, I'm not sure how well this will work.