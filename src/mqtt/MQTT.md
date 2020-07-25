# MQTT Client

The plugin is able to operate as an MQTT client. It publishes various topics containing status information which other clients can subscribe to. It also subscribes to topics allowing other clients to send commands to the Rinnai Touch module.

The following formats are supported:
* Native Rinnai Touch
* Home Assistant
* Module Connection
* Current Temperature Subscription

## Native Rinnai Touch

|Topic|Type|Payload|
|-|-|-|
|`native/get`|Publish|Full status that is received from the module|
|`native/set`|Subscribe|Command in the format `{"Group1": {"Group2": {"Command": "value"}}}`|

See the [Rinnai Touch Module WiFi API](https://hvac-api-docs.s3.us-east-2.amazonaws.com/NBW2API_Iss1.3.pdf) for more details on the content of the status and allowed commands.

## Home Assistant

|Topic|Payload|Supports Zones|
|-|-|-|
|`hvac/action/get`|Gets current state of HVAC. Values can be "off", "idle", "heating", "cooling", "fan"|Yes|
|`hvac/current_temperature/get`|Gets current temperature|Yes|
|`hvac/fan_mode/get`<br/>`hvac/fan_mode/set`|Gets or set fan speed. Values can be "low", "medium", "high"|No|
|`hvac/mode/get`<br/>`hvac/mode/set`|Gets or sets mode of HVAC. Values can be “off”, “cool”, “heat”, “fan_only”|No|
|`hvac/temperature/get`<br/>`hvac/temperature/set`|Gets or sets target temperature. Values are between 8 and 30 inclusive|Yes|
|`switch/zone/{zone}/get`<br/>`switch/zone/{zone}/set`|Gets or sets the zone state. Values can be "on" or "off". `{zone}` can be a, b, c or d|No|
|`switch/heat/get`<br/>`switch/heat/set`|Gets or sets the heater state. Values can be "on" or "off"|No|
|`switch/cool/get`<br/>`switch/cool/set`|Gets or sets the cooler state. Values can be "on" or "off"|No|
|`switch/evap/get`<br/>`switch/evap/set`|Gets or sets the evaporative cooler state. Values can be "on" or "off"|No|
|`switch/fan/get`<br/>`switch/fan/set`|Gets or sets the circulation fan state. Values can be "on" or "off"|No|
|`switch/manual/get`<br/>`switch/manual/set`|Gets or sets the manual state. Values can be "on" or "off". Used for systems with single controller|No|
|`switch/manual/{zone}/get`<br/>`switch/manual/{zone}/set`|Gets or sets the manual state. Values can be "on" or "off". Used for systems with mutliple controllers. `{zone}` can be a, b, c or d|No|

The `/get` topics are published and the `/set` topics are subscribed to. 

The payload is either a single value or a JSON object containing values for each zone (if the payload supports zones). The JSON object has the following format:

    {U: "value1", A: "value2", B: "value3", ... }

where U is the common zone (if applicable)

## Module Connection

|Topic|Type|Payload|
|-|-|-|
|`connection/status/get`|Publish|Current TCP Connection status to the WiFi module. States can be `ok` or `error`|

## Current Temperature Subscription

This allows the plugin to receive the current temperature from external sources such as 3rd party temperature sensors via MQTT. Each zone can have their own temperature topic subscription. This can be useful when the WiFi module doesn't include the temperature in its status information or only reports a single temeprature for all zones.

NOTE: The Topic Prefix is not used for these topics.

## MQTT Settings

This section describes the configuration options for the plugin to operate as an MQTT client. The following is a sample config:

    "mqtt": {
        "host": "mqtt://localhost",
        "port": 1883,
        "username": "mantorok",
        "password": "password",
        "topicPrefix": "rinnai",
        "formatNative": false,
        "formatHomeAssistant": true,
        "publishStatusChanged": false,
        "publishIntervals": true,
        "publishFrequency": 60,
        "subscribeTemperature": {
            "U": "temp/u",
            "A": "temp/a",
            "B": "temp/b",
            "C": "temp/c",
            "D": "temp/d"
        }
    },

|Option|Description|Default Value (if not supplied)|
|-|-|-|
|`host`|MQTT Broker host name||
|`port`|MQTT Broker port|`1883`|
|`username`|Credentials for MQTT Broker||
|`password`|||
|`topicPrefix`|Optional text to prefix to each topic name||
|`formatNative`|Enable Native Rinnai Touch message format|`false`|
|`formatHomeAssistant`|Enable Home Assistant message format|`false`|
|`publishStatusChanged`|Publish when status has changed|`false`|
|`publishIntervals`|Publish at regular intervals|`false`|
|`publishFrequency`|Publish frequency (secs)|`60`|
|`subscribeTemperature`|Defines the topics the plugin subscribes to for receiving temeprature payloads||

#### subscriptTemeprature settings:

|Option|Description|
|-|-|
|`U`|Topic for Zone U's temperature (ie. Common zone)|
|`A`|Topic for Zone A's temperature|
|`B`|Topic for Zone B's temperature|
|`C`|Topic for Zone C's temperature|
|`D`|Topic for Zone D's temperature|