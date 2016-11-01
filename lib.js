"use strict";

let SerialPort = require("serialport"),
    util       = require("util"),
    events     = require('events');

function DevialetExpert() {
    this.seq = 0;
}

util.inherits(DevialetExpert, events.EventEmitter);

let _processw = function() {
    if (!this._port) return;
    if (this._woutstanding) return;
    if (this._qw.length == 0) return;

    this._woutstanding = true;
    console.log("Rotel RS232: Writing", this._qw[0]);

    this._port.write(this._qw[0],
                    (err) => {
                        if (err) return;
                        this._qw.shift();
                        this._woutstanding = false;
                        setTimeout(() => { _processw.call(this); }, 50);
                    });
}
let _query = function(name, cb) {
	var nicename = name;
	if (name == "source"){var nicename = "get_current_source"};
	if (name == "power"){var nicename = "get_current_power"};
	if (name == "volume"){var nicename = "get_volume"};
	if (name == "mute"){var nicename = "get_mute_status"};
    this._qw.push(nicename + "!");
    if (cb) this._qr.push({ cb: cb, name: name });
    _processw.call(this);
};

let _send = function(name, val, cb) {
	var nicename = name;
	var seperator = "_";
    if (nicename == "source" && val.length > 3 ) {nicename = ""; seperator = "";};
    if (val == "standby" ) {val = "off";};
    if (name == "mute" && val == "toggle" ) {val = ""; seperator = "";};
    this._qw.push(nicename + seperator + val + "!");
    _processw.call(this);
    console.log("Callback: ",cb);
    if (cb)
        this._qr.push({ cb: cb, name: name, ack: false });
};

DevialetExpert.prototype.set_volume          = function(val, cb) { _send.call(this, "volume",          Number(val), cb); };
DevialetExpert.prototype.set_power           = function(val, cb) { _send.call(this, "power",           val,  cb); };
DevialetExpert.prototype.set_source          = function(val, cb) { _send.call(this, "source",          val, cb); };
DevialetExpert.prototype.set_mute            = function(val, cb) { _send.call(this, "mute",            val,  cb); };

DevialetExpert.prototype.init = function(port, baud, cb) {
    let self = this;

    this._qw = [];
    this._qr = [];
    this._woutstanding = false;

    this.properties = {};

    this._port = new SerialPort(port, {
        baudRate: baud,
        parser:   SerialPort.parsers.readline("!")
    });

    this._port.on('data', data => {
        if (data.substr(0,3) == "00:") {data = data.substr(3)};
        console.log("Rotel RS232: read", data);
        var re = /([^:=]+)[:=]([^\]]+)/.exec(data);
        if (!re) {
            console.error("Rotel RS232: unexpected data from serial port %s: %s", port, data);
            return;
        }

        var d = {
            name: re[1],
            prop: re[1].toLowerCase(),
            val:  re[2]
        };

        if (d.val != "standby") {
            if      (d.prop == "volume"         ) d.val = Number(d.val) ;
            else if (d.prop == "power"          ) d.val = d.val == "on" ;
            else if (d.prop == "mute"           ) d.val = d.val == "on" ;
            else if (d.prop == "freq"           ) d.val = Number(d.val) ;

            this.properties[d.prop] = d.val;
            this.emit("changed", d.prop, this.properties[d.prop]);
        }

        if (this._qr.length > 0) {
            var r = this._qr[0];
            if (r.name == d.name) {
                r.cb(false, d.val);
                this._qr.shift();
            }
        }
    });


    let opened = function() {
        if (!self._port) return;

        if (self.properties.power) {
            _processw.call(this);
            self.emit('status', "connected");
            _query.call(self, "volume", (err, val) => {
                _query.call(self, "source", val => {
                    _query.call(self, "mute", (err, val) => {
                        self.emit('status', "connected");
                    });
                });
            });
        } else {
            _query.call(self, "power");
            _query.call(self, "power_on");
            setTimeout(opened, 1000);
        }
    };


    this._port.on('open', err => {
        _processw.call(this);
        this.emit('status', "initializing");
        opened();
    });

    this._port.on('close',      ()  => { this._port.close(() => { this._port = undefined; if (cb) { var cb2 = cb; cb = undefined; cb2('close');      } }) });
    this._port.on('error',      err => { this._port.close(() => { this._port = undefined; if (cb) { var cb2 = cb; cb = undefined; cb2('error');      } }) });
    this._port.on('disconnect', ()  => { this._port.close(() => { this._port = undefined; if (cb) { var cb2 = cb; cb = undefined; cb2('disconnect'); } }) });
};

DevialetExpert.prototype.start = function(port, baud) {
    this.seq++;

    let closecb = (why) => {
        this.emit('status', 'disconnected');
        if (why != 'close') {
            var seq = ++this.seq;
            setTimeout(() => {
                if (seq != this.seq) return;
                this.start(port, baud);
            }, 1000);
        }
    };

    if (this._port) {
        this._port.close(() => {
            this.init(port, baud, closecb);
        });
    } else {
        this.init(port, baud, closecb);
    }
};

DevialetExpert.prototype.stop = function() {
    this.seq++;
    if (this._port)
        this._port.close(() => {});
};

exports = module.exports = DevialetExpert;
