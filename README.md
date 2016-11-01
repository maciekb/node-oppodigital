# Rotel Amp Line Device Control via RS232

Configure your Expert:

* Link speed: 115200
* Identifier: Rotel

Initialization:

```javascript
var RotelAmp = require("node-rotel");
var d = new RotelAmp();
```

Listening to events:

```javascript
d.on('status', function(status) { });
d.on('changed', function(property, value) { });
```

`status` can be one of the following:

* `'connecting'`
* `'initializing'`
* `'connected'`
* `'disconnected'`

`property` can be one of the following:

* `'power'`
* `'volume'`
* `'source'`
* `'mute'`

Starting/Stopping the connection to your Rotel Amp:

```javascript
d.start(port, baud);
```

* `port` should be like `'/dev/cu.usbserial'` or something similar on MacOS or Linux, or `'COM3'` on Windows
* `baud` should be like `115200`, or whatever you configured your Rotel to be (see above)



```javascript
d.stop();
```
