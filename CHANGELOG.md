# Change Log

All notable changes to this project will be documented in this file.

## 3.4.12 (2024-07-20)

* Update dependencies, some of which had high severity vulnerabilities

## 3.4.11 (2024-02-25)

* Update dependencies

## 3.4.10 (2023-12-30)

* Improved documentation
* Update dependencies

## 3.4.9 (2023-11-19)

* Add UI configuration for multiple instances of plugin
* Support node 20.x and remove support for 14.x
* Update dependencies

## 3.4.8 (2023-04-10)

* Update dependencies, one of which had a high severity vulnerability

## 3.4.7 (2023-01-14)

* Update dependencies, one of which had a high severity vulnerability

## 3.4.6 (2022-11-13)

* Support node 18.x and remove support for 12.x
* Update dependencies

## 3.4.5 (2022-07-31)

* Update dependencies, some of which had moderate severity vulnerabilities

## 3.4.4 (2022-03-27)

* Update dependencies, one of which had a high severity vulnerability

## 3.4.3 (2022-01-09)

* Remove build on node 10.x
* Update dependencies

## 3.4.2 (2021-12-19)

* [FIX] MQTT topic `switch/manual/get` is incorrectly set as `switch/manual/u/get` for evap cooling when heater is "Multi Temperature Set Point"
* [FIX] Setting pump state causes `Set ScheduleOverride to ... is invalid due to module's current Status`

## 3.4.1 (2021-12-19)

* Add new MQTT topics for getting and setting the Evaporative Cooler's pump state (`switch/pump/get` & `switch/pump/set`) ([#8](https://github.com/mantorok1/homebridge-rinnai-touch-platform/issues/8))

## 3.4.0 (2021-12-18)

* Use newer promise-based characteristic getters and setters (onGet & onSet). Requires Homebridge version 1.3.0 or above.
* Add 1 second debounce to setting fan speed to prevent flooding module with commands
* Add new MQTT topics for finer control of fan speed (`hvac/fan_speed/get` & `hvac/fan_speed/set`) ([#8](https://github.com/mantorok1/homebridge-rinnai-touch-platform/issues/8))
* [FIX] ESLint warnings in error handlers
* Update dependencies, some of which had moderate severity vulnerabilities

## 3.3.8 (2021-07-11)

* [FIX] Pushover notifications occur when module rebooting

## 3.3.7 (2021-06-19)

* Add "Boot Module" option
* Allow setting temperature to zero
* Update dependencies, one of which had a high severity vulnerability

## 3.3.6 (2021-05-30)

* Update dependencies, one of which had a high severity vulnerability

## 3.3.5 (2021-05-02)

* [FIX] Prevent network auto discovery of module when IP address specified in settings
* [FIX] Wait for module connection before configuring cached accessories
* [FIX] Homebridge warning when heating/cooling threshold temperature exceed limits
* Improve support for running multiple instances of the plugin ([#5](https://github.com/mantorok1/homebridge-rinnai-touch-platform/issues/5))
* Add build on node 16.x

## 3.3.4 (2021-03-13)

* [FIX] Pushover notification may cause plugin to crash when internet connection is down

## 3.3.3 (2021-03-01)

* [FIX] Error occurs when cache file doesn't exist

## 3.3.2 (2021-02-28)

* [FIX] HeaterCooler intermittently turning on and setting to AUTO mode
* [FIX] Incorrect zones found during auto-discovery
* Cache discovered HVAC configuration for faster startup
* Improve support for Child Bridges (in Homebridge 1.3.x)

## 3.3.1 (2021-02-21)

* [FIX] Get Target Temperature causes warning when HVAC is off (in Homebridge 1.3.0)

## 3.3.0 (2021-02-14)

* Major code refactor to resolve commands at send time rather than request time
* Deprecate 'Native' MQTT format
* [FIX] Push notifications not being sent for TCP/IP connection errors
* New device discovery
* Add "Seperate Mode Accessories" setting
* Add "Seperate Fan Zone Switches" setting
* AUTO mode in Thermostat/HeaterCooler accessory sets temperature range

## 3.2.4 (2020-12-27)

* MQTT: Republish current state when command cannot be performed 

## 3.2.3 (2020-12-24)

* Update dependencies, one of which had a low severity vulnerability

## 3.2.2 (2020-12-05)

* Add build on node 14.x & issue templates
* Add "Invert Comfort Level" setting (for Evaporative Cooler)
* Add "Set AUTO operating state" setting (for Evaporative Cooler)

## 3.2.1 (2020-11-07)

* Minor tweaks to Pushover notification events
* [FIX] Plugin doesn't start properly when controller in Settings mode 

## 3.2.0 (2020-11-01)

* New option to show module's status in logs & other minor improvements
* JSONPath option to extract temperature from JSON payload for MQTT Current Temperature Subscription
* Show module's fault status in the log and publish to MQTT
* Pushover notifications for temperature exceeding thresholds, connection errors, faults & incorrrect day/time
* [FIX] Handle status when in "None" mode (ie. when controller is in Settings mode)

## 3.1.2 (2020-10-20)

* [FIX] Failed TCP/IP connection causes plugin to crash ([#2](https://github.com/mantorok1/homebridge-rinnai-touch-platform/issues/2))

## 3.1.1 (2020-10-17)

* [FIX] Some commands not working for Evaporative Cooling
* [FIX] MQTT publishing incorrect TCP/IP connection status
* Update dependencies

## 3.1.0 (2020-10-11)

* TCP/IP connection always open to improve performance and reliability
* New logging options in settings
* Remove some redundant settings
* Prevent some commands via MQTT when invalid
* [FIX] MQTT Native format not functioning correctly
* Update dependencies

## 3.0.9 (2020-09-20)

* Update dependencies, one of which had a high severity vulnerability

## 3.0.8 (2020-09-14)

* Retry MQTT broker connection until successful.
* Update dependencies

## 3.0.7 (2020-09-05)

* Add new MQTT option to publish topics even if the payload has not changed
* [FIX] Clearing accessory cache can cause MaxListenersExceededWarning
* Add badges to README
* Update dependencies

## 3.0.6 (2020-08-31)

* [FIX] TCP socket not closed after an exception or timeout occurs
* [FIX] Allow status which has a sequence number of 0
* Add funding attribute to package.json
* Update dependencies

## 3.0.5 (2020-08-23)

* Impoved handling of invalid status returned from module
* Minor code refactor

## 3.0.4 (2020-08-22)

* [FIX] Handle status with missing 2nd element
* Update dependencies

## 3.0.3 (2020-07-24)

* MQTT Connection format: combine `open` and `closed` states into single `ok` state
* Improved TCP connection handling
* Update dependencies

## 3.0.2 (2020-07-23)

* [FIX] Home Assistant Interval publishing not working
* Update dependencies

## 3.0.1 (2020-07-19)

* [FIX] Missing retain option for MQTT publish

## 3.0.0 (2020-07-19)

* New name: homebridge-rinnai-touch-platform
* Created from official homebridge-plugin-template
* Rewritten in Typescript
* Revamped MQTT service
* New "Module Connection" MQTT format
* Logging improvements
* Removal of Debug logging option from settings
* Update dependencies

## 2.5.2 (2020-07-03)

* [FIX] Initial MQTT publication may occur before connection to broker established

## 2.5.1 (2020-07-03)

* Simplify accessory settings
* Remove `AUTO` option from Zone 'Heater Cooler' accessory
* Additional INFO logging to show what caused the TCP connection to open

## 2.5.0 (2020-06-28)

* Allow 'Heater Cooler' accessory to be used as zone switches
* Add Current Temperature MQTT subscriptions for zones.
* [FIX] Fan does not switch off when set via MQTT hvac/mode/set topic
* [FIX] Handle case where status messages may be concatenated
* [FIX] Turning Zone Switch on while Thermostat & Fan are off throws error

## 2.4.4 (2020-06-21)

* [FIX] Setting mode via MQTT hvac/mode/set topic throws error

## 2.4.3 (2020-06-19)

* [FIX] Publish delay after processing command

## 2.4.2 (2020-06-18)

* Add 'retain' option to MQTT publish
* Improve time to detect command updates

## 2.4.1 (2020-06-17)

* New MQTT topics & status change publication event
* New config option for IP Address, Port & Connection Timeout
* Add support for Common zone
* Removal of Map Overrides

## 2.3.2 (2020-06-02)

* [FIX] Ignore decimal place when setting temperature via Home Assistant HVAC

## 2.3.1 (2020-06-02)

* Replace Simple MQTT format with Home Assistant HVAC specific one

## 2.3.0 (2020-05-26)

* MQTT support to publish status and subscribe to commands
* Add CHANGELOG file
* Further code cleanup
* Improved error handling and logging

## 2.2.0 (2020-05-17)

* Major code refactor
* New Manual Control switch
* Reintroduce Heater Cooler accessory as alternative to Thermostat accessory
* Show controller's temperature units in "Hardware Display Units" of Thermostat/Heater Cooler accessory
* Expose TCP close connection delay time as configuration option
* Add Config Schema file to allow configuration via Homebridge Config UI X

## 2.1.0 (2020-04-18)

* Set unique serial number for each accessory
* Set fan rotation direction
* Automatically switch fan off when switching HVAC on and vice versa
* Stability improvements when sending commands to WiFi module

## 2.0.0 (2020-04-11)

* New switch accessories for Fan, Pump & Advance Period
* Use Homebridge dynamic platform instead of single accessory
* Use Thermostat service instead of Heater Cooler
* Zero config option
* Better support for evaporative cooling
* Revamped mapping overrides

## 1.2.0 (2020-03-24)

* Better support for multiple controller setups

## 1.1.0 (2020-03-22)

* Automatic detection of HVAC options (add-on air con, evaporative cooling)
* Map overrides configuration
* Partial evaporative cooling support
* Retry TCP connection (useful when router is rebooted and IP address changes)
* Stability improvements

## 1.0.1 (2020-03-15)

* [FIX] Current State and Zones not working for multi-controller setups

## 1.0.0 (2020-03-15)

* Add single accessory with Heater Cooler & Zone Switch services
