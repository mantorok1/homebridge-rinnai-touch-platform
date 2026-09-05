# Matter Accessories (BETA)

This plugin now supports registering Matter accessories with the bridge provided by Homebridge. This will allow you to use non-Apple home automation controllers such as Google Home & Amazon Alexa. The plugin will attempt to discover your Rinnai/Brivis system's capabilities automatically and create equivalent Matter accessories.

See [Enabling Matter](https://github.com/homebridge-plugins/homebridge-matter/wiki/Enabling-Matter) for details on how to set it up.

**NOTES:**
 - Matter support is still in Beta and does not currently offer the same functionality as HomeKit.
 - I am not able to test all the capabilities on my own system. If you encounter a bug please [raise an issue](https://github.com/mantorok1/homebridge-rinnai-touch-platform/issues) on GitHub.

|Accessory|Description|
|-|-|
|Thermostat|Displays the current temperature, units (Celsius or Fahrenheit) and mode of the HVAC system. It allows you to set the desired temperature and change the mode. Modes are:<ul><li>`OFF` - No heating or cooling</li><li>`HEAT` - Heat to the set temperature</li><li>`COOL` - Cool to the set temperature</li><li>`AUTO` -  Not supported</li></ul>NOTES:<ul><li>One accessory will be added for each controller</li><li>Temperature units (Celcius/Fahrenheit) in the accessory do not determine which unit to use when displaying temperatures in the Home app. This is controlled by your phone's settings</li><li>Matter does not have a `Heater Cooler` accessory type so `Thermostat` will be used instead</li></ul>|
|Zone Switch|Shows if the zone is currently On or Off and allows you to change it. Zone Switches are shown if the operation mode is 'Single Temperature Set Point' and at least one zone is enabled (excluding the Common zone)<br/>NOTE: Matter does not have a `Heater Cooler` accessory type so zones are only represented by `Switch` types|
|Fan|Displays the current state and speed setting of the circulation fan. Allows you to turn it Off or set the rotation speed<br/>NOTE: The fan can only be used when the Thermostat is in the `OFF` mode or `COOL` mode for Evaporative Cooling|
|Advance Period Switch|Shows if the Period of the Programme Schedule has been advanced and allows you to change it|
|Manual Switch|Shows if the Manual mode is On or Off and allows you to change it|
|Pump|Not currently supported|