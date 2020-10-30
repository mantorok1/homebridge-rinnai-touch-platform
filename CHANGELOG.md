# Change Log

All notable changes to this project will be documented in this file.

## NEXT

* New option to show Rinnai Touch module's status in logs & other minor improvements
* JSONPath option to extract temperature from JSON payload for MQTT Current Temperature Subscription

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

* [FIX] Current State and Zones not working for mutli-controller setups

## 1.0.0 (2020-03-15)

* Add single accessory with Heater Cooler & Zone Switch services
