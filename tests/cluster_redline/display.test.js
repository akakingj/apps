'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { Controller } = require('../../apps/cluster_redline/controller');
const { settings } = require('../../apps/cluster_redline/policy');
class Client extends EventEmitter {
    constructor(targets) { super(); this.targets = targets; this.ready = true; this.made = []; this.dropped = []; this.next = 0; }
    image(o) { this.made.push(o); return ++this.next; }
    pixels() {} set() {} close() {}
    drop(id) { this.dropped.push(id); }
}
const client = new Client('map:1088x480,panel:1920x720,hud:800x480');
let paints = 0;
const painter = { W: 1088, H: 480, draw: () => { paints++; return { d: Buffer.alloc(4) }; }, difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
function sport(c) { c.policy.modeSample(1, 0); c.policy.rpmSample(4200, 1000); }
const c = new Controller(client, painter); sport(c);
assert(c.tick(1000).requested);
const panel = client.made[0];
assert.deepStrictEqual([panel.target, panel.x, panel.y, panel.w, panel.h], ['panel', 416, 120, 1088, 480]);
assert.strictEqual(panel.klass, 'overlay'); assert.strictEqual(panel.exclusive, false);
assert.strictEqual(panel.contend, false, 'never take over a stock speech dialog on the panel');
assert(panel.x > 0 && panel.y > 0 && panel.x + panel.w < 1920 && panel.y + panel.h < 720, 'image is confined to center, not the entire panel');
const before = paints;
c.tick(1010); c.tick(1020);
assert.strictEqual(paints, before, 'unchanged live values do not need full canvas redraws');
client.emit('target', 'map', 'parked', 'stock', 'old map state');
client.emit('target', 'panel', 'shown', 'us', '');
assert.strictEqual(c.tick(1030).targetState, 'shown', 'status follows the selected target');
for (const rate of [12, 30, 60]) {
    assert.strictEqual(settings({ frameRate: rate }).frameRate, rate);
    const count = paints;
    c.tick(1040, { frameRate: rate });
    assert.strictEqual(client.made[client.made.length - 1].fps, rate);
    if (rate !== 12) assert(paints > count, 'new layers must receive a complete image even when values did not change');
}
for (const bad of [0, 61, Infinity, NaN, '60', 30.5]) assert.strictEqual(settings({ frameRate: bad }).frameRate, 12);
c.tick(1100, { displayTarget: 'map', frameRate: 30 });
const map = client.made[client.made.length - 1];
assert.deepStrictEqual([map.target, map.x, map.y, map.klass, map.exclusive, map.contend], ['map', 0, 0, 'content', true, true]);
c.tick(1200, { displayTarget: 'panel', frameRate: 60 });
assert.strictEqual(client.made[client.made.length - 1].target, 'panel');
const stale = c.tick(4000, { frameRate: 60 });
assert.strictEqual(stale.requested, false, 'cached image must not bypass stale signal release');
assert.strictEqual(c.ref, 0);
for (const targets of ['map:1088x480,hud:800x480', 'panel:2240x896', '']) {
    const missing = new Client(targets), hidden = new Controller(missing, painter); sport(hidden);
    assert.strictEqual(hidden.tick(1000).reason, 'target_unavailable');
    assert.strictEqual(missing.made.length, 0, 'missing panel never silently falls back to map, HUD or a guessed size');
}
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '../../apps/cluster_redline/app.json')));
assert.deepStrictEqual(spec.settings.find((s) => s.key === 'frameRate').steps.slice(-3), [12, 30, 60]);
assert.strictEqual(spec.settings.find((s) => s.key === 'displayTarget').default, 'panel');
console.log('PASS: front-center placement, nonexclusive panel, no stock takeover/HUD fallback, legacy switch, 12/30/60 requests, cache and stale-signal release');
