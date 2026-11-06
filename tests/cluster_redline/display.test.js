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
function tick(now, raw) { return c.tick(now, Object.assign({ displayTarget: 'panel' }, raw)); }
assert(tick(1000).requested);
const panel = client.made[0];
assert.deepStrictEqual([panel.target, panel.x, panel.y, panel.w, panel.h], ['panel', 525, 168, 870, 384]);
assert.deepStrictEqual([panel.iw, panel.ih, panel.sampling], [1088, 480, 'bilinear']);
assert.strictEqual(panel.klass, 'overlay'); assert.strictEqual(panel.exclusive, true);
assert.strictEqual(panel.contend, false, 'never take over a stock speech dialog on the panel');
assert(panel.x > 0 && panel.y > 0 && panel.x + panel.w < 1920 && panel.y + panel.h < 720, 'image is confined to center, not the entire panel');
const before = paints;
tick(1010); tick(1020);
assert.strictEqual(paints, before, 'unchanged live values do not need full canvas redraws');
client.emit('target', 'map', 'parked', 'stock', 'old map state');
client.emit('target', 'panel', 'shown', 'us', '');
assert.strictEqual(tick(1030).targetState, 'shown', 'status follows the selected target');
for (const rate of [4, 12, 20, 30, 60]) {
    assert.strictEqual(settings({ frameRate: rate }).frameRate, 20);
    const count = client.made.length;
    tick(1040, { frameRate: rate });
    assert.strictEqual(client.made[client.made.length - 1].fps, 20);
    assert.strictEqual(client.made.length, count, 'retired frame-rate settings cannot churn the acquisition layer');
}
for (const bad of [0, 61, Infinity, NaN, '60', 30.5]) assert.strictEqual(settings({ frameRate: bad }).frameRate, 20);
tick(1100, { displayTarget: 'map', frameRate: 30 });
const map = client.made[client.made.length - 1];
assert.deepStrictEqual([map.target, map.x, map.y, map.klass, map.exclusive, map.contend], ['map', 109, 48, 'content', true, true]);
tick(1200, { displayTarget: 'panel', frameRate: 60 });
assert.strictEqual(client.made[client.made.length - 1].target, 'panel');
tick(1250, { widgetScale: 60 });
assert.strictEqual(client.made[client.made.length - 1].w, 653, 'owner can reduce the footprint further');
tick(1260, { widgetScale: 75 });
c.telemetry.sample(2807, 1270); const withTorque = tick(1270);
assert.strictEqual(withTorque.torqueNm, 380); assert(withTorque.powerPS > 220);
const unitPaints = paints;
tick(1530, { powerUnit: 'kW', torqueUnit: 'kgfm' });
assert(paints > unitPaints, 'unit changes redraw even with unchanged sensor readings');
const stale = tick(4000, { frameRate: 60 });
assert.strictEqual(stale.requested, false, 'cached image must not bypass stale signal release');
assert.strictEqual(c.ref, 0);
for (const targets of ['map:1088x480,hud:800x480', 'panel:2240x896', '']) {
    const missing = new Client(targets), hidden = new Controller(missing, painter); sport(hidden);
    assert.strictEqual(hidden.tick(1000, { displayTarget: 'panel' }).reason, 'target_unavailable');
    assert.strictEqual(missing.made.length, 0, 'missing panel never silently falls back to map, HUD or a guessed size');
}
const defaultClient = new Client(client.targets), defaultController = new Controller(defaultClient, painter); sport(defaultController);
assert(defaultController.tick(1000).requested);
assert.strictEqual(defaultClient.made[0].target, 'map');
assert.strictEqual(defaultClient.made[0].guide_hold, true);
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '../../apps/cluster_redline/app.json')));
assert(!spec.settings.some((s) => s.key === 'frameRate'));
assert.strictEqual(spec.settings.find((s) => s.key === 'displayTarget').default, 'map');
assert.strictEqual(spec.settings.find((s) => s.key === 'widgetScale').default, 80);
console.log('PASS: front-center placement, atomic image, no stock takeover/HUD fallback, fixed 20fps despite legacy choices, cache and stale-signal release');
