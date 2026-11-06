'use strict';
const assert = require('assert');
const { EventEmitter } = require('events');
const { Policy, settings, modeOf } = require('../../apps/cluster_redline/policy');
const { Controller } = require('../../apps/cluster_redline/controller');

// The policy must stay hidden before any signal, including renderer reconnects.
for (const ready of [false, true]) assert.strictEqual(new Policy().evaluate(10000, ready).show, false);
for (const mode of [1, 2, 3, 'SPORT_DYNAMIC', 'SPORT_EXPERT', 'SPORT_INDIVIDUAL']) {
    const p = new Policy(); p.modeSample(mode, 0); p.rpmSample(4200, 0);
    assert.strictEqual(p.evaluate(999, true).show, false);
    assert.strictEqual(p.evaluate(1000, true).show, true);
    assert.strictEqual(p.evaluate(1000, false).show, false);
    assert.strictEqual(p.evaluate(1000, true, { autoSport: false }).show, false);
    p.modeSample(4, 1100); assert.strictEqual(p.evaluate(1100, true).show, false);
}
for (const mode of [0, 4, 5, 6, 7, 8, 9, 10, 61, 62, 63, null, undefined, true, 'sport', 'SPORT_ECO', 'COMFORT']) {
    const p = new Policy(); p.modeSample(mode, 0); p.rpmSample(6500, 1000);
    assert.strictEqual(p.evaluate(1000, true).show, false, 'unexpected mode allowed: ' + mode);
}
const p = new Policy(); p.modeSample(1, 0); p.rpmSample(6500, 1000);
assert.strictEqual(p.evaluate(1000, true).shift, true);
p.rpmSample(6400, 1000); assert.strictEqual(p.evaluate(1000, true).shift, false);
p.rpmSample(0, 1000); assert.strictEqual(p.evaluate(1000, true).show, false);
p.rpmSample(NaN, 1000); assert.strictEqual(p.evaluate(1000, true).show, false);
p.rpmSample(4200, 1000); assert.strictEqual(p.evaluate(3000, true).show, false, 'stale RPM must hide');
p.rpmSample(4200, 4000); assert.strictEqual(p.evaluate(4000, true).show, false, 'stale mode must hide');
assert.strictEqual(modeOf('invalid'), null);
assert.strictEqual(settings({ shiftRpm: 'bad' }).shiftRpm, settings().shiftRpm);
assert.strictEqual(settings({ appEnabled: false }).appEnabled, false);
assert.strictEqual(modeOf({ toString: () => '1' }), null);
const stale = new Policy(); stale.modeSample(1, 0); stale.rpmSample(4200, 4000);
stale.modeSample(1, 4000); assert.strictEqual(stale.evaluate(4000, true).show, false, 'resuming a stale mode needs confirmation again');

class FakeClient extends EventEmitter {
    constructor() { super(); this.ready = true; this.targets = 'map:1088x480,panel:1920x720'; this.calls = []; this.layers = new Map(); this.next = 0; }
    image(opts) { const id = ++this.next; this.layers.set(id, opts); this.calls.push(['image', id, opts]); return id; }
    pixels(ref, rects, data) { this.calls.push(['pixels', ref, rects, data.length]); }
    set(ref, values) { this.calls.push(['set', ref, values]); }
    drop(ref) { this.calls.push(['drop', ref]); this.layers.delete(ref); }
    close() { this.ready = false; this.calls.push(['close']); }
}
const paint = { W: 4, H: 4, draw: () => ({ d: Buffer.alloc(64) }), difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
const client = new FakeClient(), c = new Controller(client, paint);
c.tick(0); assert.strictEqual(client.calls.length, 0, 'boot must not create a hidden slot reservation');
c.policy.modeSample(1, 0); c.policy.rpmSample(4200, 1000); c.tick(1000);
const layer = client.calls[0][2];
assert.strictEqual(layer.target, 'map'); assert.strictEqual(layer.visible, false);
assert.strictEqual(layer.prewarm, false); assert.strictEqual(layer.exclusive, true);
assert.strictEqual(layer.z, 100); assert.strictEqual(layer.contend, true);
assert.strictEqual(layer.guide_hold, true); assert.strictEqual(layer.klass, 'content');
assert.deepStrictEqual(client.calls.map((x) => x[0]), ['image', 'pixels', 'set']);
c.policy.modeSample(7, 1100); c.tick(1100);
assert.strictEqual(client.layers.size, 0); assert.strictEqual(client.calls[3][0], 'drop');
c.policy.modeSample(1, 2000); c.policy.rpmSample(4200, 3000); c.tick(3000);
client.ready = false; client.emit('disconnected');
assert.strictEqual(client.layers.size, 0, 'disconnect must remove cached visible layers before replay');
client.ready = true; client.emit('ready'); c.tick(4000);
assert.strictEqual(client.layers.size, 0, 'reconnect must wait for new live signals');
c.policy.modeSample(1, 4000); c.policy.rpmSample(6500, 5000); c.tick(5000);
client.emit('refused', 'layer', c.ref, 'not supported'); c.tick(5100);
assert.strictEqual(client.layers.size, 0, 'renderer refusal must stay hidden');
c.close(); assert.strictEqual(client.layers.size, 0);
console.log('PASS: boot hidden, strict sport modes, debounce, normal/eco release, fresh signals, reconnect, renderer refusal and shutdown');
