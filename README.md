# Rinnai Touch Platform

[![npm](https://badgen.net/npm/v/homebridge-rinnai-touch-platform?icon=npm&label)](https://www.npmjs.com/package/homebridge-rinnai-touch-platform)
[![npm](https://badgen.net/npm/dt/homebridge-rinnai-touch-platform)](https://www.npmjs.com/package/homebridge-rinnai-touch-platform)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![npm](https://badgen.net/badge/paypal/mantorok1/yellow)](https://paypal.me/Mantorok1)
[![npm](https://badgen.net/discord/online-members/8fpZA4S?icon=discord&label=discord)](https://discord.com/channels/432663330281226270/922725212879982633)

This Homebridge Plugin allows you to control a Rinnai/Brivis HVAC system via a Rinnai/Brivis Touch WiFi Module. It supports the following configurations:
- Single Temperature Set Point (ie. one controller with 1 to 5 zones including the Common zone)
- Multi Temperature Set Point (ie. one controller per zone, up to 4)

Functions available:
- Displaying the current state (eg. idle, heating, cooling)
- Switching to Off, Heating or Cooling modes
- Displaying the current temperature (depends on controller model)
- Setting the desired temperature or temperature range (`AUTO` mode)
- Switching zones On and Off
- Switching the circulation fan On and Off as well as setting rotation speed
- Turning the water pump On and Off (for Evaporative Cooling only)
- Advancing to the next period of the Programme Schedule. (eg. Leave -> Return)
- Switching between Manual and Schedule control modes
- Pushover Notifications when certain events occur
- MQTT client

For further details see:
- [Setup](./docs/setup.md)
- [Accessories](./docs/accessories.md)
- [Pushover Notifications](./docs/pushover.md)
- [MQTT](./docs/mqtt.md)
- [Version History](./CHANGELOG.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [License](./LICENSE)
