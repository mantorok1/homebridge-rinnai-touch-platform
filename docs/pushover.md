# Pushover Notifications

This plugin supports sending Push notifications to your iPhone (or other devices) when certain events occur. To do this you'll need to create a [Pushover](https://pushover.net/signup) account and install the Pushover app. Note that there is a [one-time purchase](https://pushover.net/pricing) cost for doing this.

## Configuration

It is recommended to use the Homebridge UI to configure the Pushover Notifications which can be found in the "Pushover Notifications" section within the Homebridge UI. You can also manually configure it in the JSON config file using the following keys:

|Key|Required|Type|Description|Default Value (if not supplied)|
|-|-|-|-|-|
|`token`|Yes|string|Application API Token supplied by Pushover||
|`users`|Yes|array|One or more User Keys supplied by Pushover. Each user will receive a push notification||
|`minTemperatureThreshold`|No|number|Notification sent when temperature falls below this value||
|`maxTemperatureThreshold`|No|number|Notification sent when temperature rises above this value||
|`connectionError`|No|boolean|Notification sent when connection error occurs|`false`||
|`faultDetected`|No|boolean|Notification sent when fault detected|`false`||
|`dayIncorrect`|No|boolean|Notification sent when controller and system day's are different|`false`||
|`timeIncorrect`|No|boolean|Notification sent when controller and system time differ by more than 3 minutes|`false`|

### Example:
```
  "pushover": {
    "token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "users": [
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "cccccccccccccccccccccccccccccc"
    ],
    "minTemperatureThreshold": 15,
    "maxTemperatureThreshold": 27,
    "connectionError": true,
    "faultDetected": true,
    "dayIncorrect": false,
    "timeIncorrect": false
  },
```