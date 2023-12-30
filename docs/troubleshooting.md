# Troubleshooting
* The Rinnai Touch module appears to only allow a single client to connect to it at one time via TCP/IP. As the plugin only supports a TCP/IP connection to the module no other connections from other clients (such as the TouchApp by Rinnai) can be active at the time the plugin starts. Once a connection is established the plugin will keep it open to prevent other clients connecting to it via TCP/IP. NOTE: Once the plugin has started you can then use the TouchApp as it will connect to the module via the cloud.
* The module will disconnect if it has not received any requests after 5 minutes. To prevent this the plugin will send a blank command every minute.
* The module is also very temperamental about the TCP/IP connection. If it is not not closed properly or re-opened too quickly then a "Connection Refused" error may occur which prevents the plugin from connecting to the module. This may happen if Homebridge is not shutdown gracefully (eg. a crash). If it does happen try restarting Homebridge, the Rinnai Touch module or your Access Point/Router. If you have multiple Access Points try restarting all of them.
* The module may start disconnecting and reconnecting after a number of days of use. Normally the module will automatically reboot itself on a daily basis but the plugin's continuous connection prevents this so I think it becomes unstable after being connected for long periods of time. To (hopefully) prevent this you can force the module to reboot at a specified time in the plugin's settings (see `bootTime` and `bootPassword`).
* Multi controller and Evaporative cooling configurations were not able to be tested so may not function properly.
* Due to the lag between sending a command to the module and it correctly reflecting that command in its status there may be a short delay of a few seconds before the Home app shows the correct values. eg. When switching from `HEAT` to `COOL` mode some details such as the desired temperature will take a few seconds before the current value is shown.
* If the WiFi module does not supply a current temperature then the temperature will display as zero in the Thermostat/Heater Cooler accessory. I would have prefered it showed as blank but couldn't find a way to do it. This appears to be a limitation of the service within Homebridge.

## Multiple Modules

The plugin only supports connection to a single WiFi module, however, it is possible to have multiple instances of the plugin running by using [Child Bridges](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

The plugin is not able to use the network auto discovery when there is more than 1 module. To workaround this you'll need to specify the IP address of each module in the config. This means you'll need to ensure the modules have static IP addresses.

For the plugin to work properly with Child Bridges you'll also need to specify a unique `name`, `_bridge.username` and `_bridge.port` for each. Here's an example config:

```
    {
      "name": "Module1",
      "address": "192.168.1.60",
      "_bridge": {
        "username": "A1:B2:C3:D4:E5:F0",
        "port": 42150
      },
      "platform": "RinnaiTouchPlatform"
    },
    {
      "name": "Module2",
      "address": "192.168.1.61",
      "_bridge": {
        "username": "A1:B2:C3:D4:E5:F1",
        "port": 42151
      },
      "platform": "RinnaiTouchPlatform"
    }
```