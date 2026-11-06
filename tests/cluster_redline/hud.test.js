'use strict';
const assert = require('assert'), path = require('path'), fs = require('fs');
const { EventEmitter } = require('events');
const { Controller } = require('../../apps/cluster_redline/controller');
const { settings } = require('../../apps/cluster_redline/policy');
const stage = path.resolve(process.argv[2]);
const dir = path.join(stage, 'source/javascript');
const hud = require(path.join(dir, 'hud-draw')), cluster = require(path.join(dir, 'draw'));
class Client extends EventEmitter {
    constructor(targets) { super(); this.targets = targets; this.ready = true; this.next = 0; this.events = []; this.active = new Set(); }
    image(o) { assert.strictEqual(this.active.size, 0, 'drop the previous target before requesting a new one'); const id = ++this.next; this.active.add(id); this.events.push(['image', id, o]); return id; }
    pixels(id, rects, pixels) { this.events.push(['pixels', id, rects, Buffer.from(pixels)]); }
    showWhenSent(id) { assert(this.events.some(e => e[0] === 'pixels' && e[1] === id)); this.events.push(['show', id]); }
    drop(id) { this.events.push(['drop', id]); this.active.delete(id); }
    close() {}
}
const client = new Client('map:1088x480,panel:1920x720,hud:800x480');
const c = new Controller(client, cluster, hud);
c.policy.modeSample(1, 0); c.policy.rpmSample(1990, 1000); c.gear = '4'; c.gearMode = 'M';
assert.strictEqual(c.tick(1000).requested, true);
const config = { displayTarget: 'hud', shiftRpm: 2000 };
let state = c.tick(1050, config);
assert.strictEqual(state.requested, true); assert.strictEqual(state.gear, 'M4'); assert.strictEqual(state.shift, false);
const image = client.events.filter(e => e[0] === 'image').pop()[2];
assert.deepStrictEqual([image.target, image.iw, image.ih, image.x, image.y, image.w, image.h], ['hud', 800, 480, 80, 48, 640, 384]);
assert.strictEqual(image.contend, false); assert.strictEqual(image.guide_hold, false);
assert.strictEqual(image.visible, false); assert.strictEqual(image.prewarm, false);
client.emit('target', 'hud', 'parked', 'stock', 'guidance');
state = c.tick(1100, config); assert.strictEqual(state.targetState, 'parked'); assert.strictEqual(state.targetHolder, 'stock');
c.policy.rpmSample(2000, 1300); state = c.tick(1300, config); assert.strictEqual(state.shift, true);
for (const mode of ['D', 'S', 'M']) { c.gearMode = mode; assert.strictEqual(c.tick(1350, config).gear, mode + '4'); }
c.policy.rpmSample(2000, 1900); c.tick(1900, { displayTarget: 'map' });
assert.strictEqual(client.events.filter(e => e[0] === 'image').pop()[2].target, 'map');
c.tick(1950, config); c.policy.modeSample(4, 2000);
assert.strictEqual(c.tick(2000, config).requested, false); assert.strictEqual(client.active.size, 0);
for (const reason of ['stale', 'engine_off', 'disabled']) {
    const x = new Controller(new Client(client.targets), cluster, hud);
    x.policy.modeSample(1, 0); x.policy.rpmSample(3000, 1000); assert(x.tick(1000, config).requested);
    if (reason === 'engine_off') x.policy.rpmSample(0, 1100);
    const out = x.tick(reason === 'stale' ? 3000 : 1100, Object.assign({}, config, reason === 'disabled' ? { appEnabled: false } : {}));
    assert.strictEqual(out.requested, false); assert.strictEqual(x.client.active.size, 0);
}
for (const targets of ['map:1088x480,panel:1920x720', 'hud:353x203', 'hud:801x480', '']) {
    const x = new Controller(new Client(targets), cluster, hud); x.policy.modeSample(1, 0); x.policy.rpmSample(3000, 1000);
    assert.strictEqual(x.tick(1000, config).reason, 'target_unavailable'); assert.strictEqual(x.client.next, 0);
}
const cfg = settings(config), base = { rpm: 1990, gear: 'D4', shift: false, config: cfg };
const normal = hud.draw(base), alert = hud.draw(Object.assign({}, base, { rpm: 2000, gear: 'S4', shift: true }));
function px(cv, x, y) { return Array.from(cv.d.slice((y * hud.W + x) * 4, (y * hud.W + x) * 4 + 4)); }
for (let y = 300; y < hud.H; y++) for (let x = 0; x < hud.W; x++) assert.strictEqual(normal.d[(y * hud.W + x) * 4 + 3], 0, 'leave the lower HUD transparent');
assert.deepStrictEqual(px(hud.draw(Object.assign({}, base, { rpm: 700 })), 130, 40), [0, 0, 0, 255]);
assert.deepStrictEqual(px(alert, 660, 40), [255, 42, 42, 255]);
let red = 0;
for (let y = 150; y < 275; y++) for (let x = 120; x < 470; x++) if (px(alert,x,y)[0] > 220 && px(alert,x,y)[1] < 80) red++;
assert(red > 300, 'RPM digits turn red at the configured threshold');
for (const pair of [[normal,alert], [alert,normal], [normal,hud.draw(Object.assign({}, base, { rpm: 6500, gear: 'M10' }))]]) {
    const a = Buffer.from(pair[0].d), b = Buffer.from(pair[1].d), copy = Buffer.from(a), d = hud.difference(a,b);
    let off = 0;
    d.rects.forEach(r => { for (let y = r.y; y < r.y+r.h; y++) { const n = r.w*4; d.pixels.copy(copy,(y*hud.W+r.x)*4,off,off+n); off += n; } });
    assert(copy.equals(b), 'delta updates must clear old glyphs and restore exact transparent pixels');
    assert.strictEqual(off,d.pixels.length); assert(d.pixels.length < a.length/2, 'bound HUD traffic with cropped dirty regions');
}
assert.strictEqual(hud.difference(Buffer.from(normal.d),Buffer.from(normal.d)).rects.length,0);
const outDir = process.argv[3];
if (outDir) { fs.mkdirSync(outDir,{recursive:true}); fs.writeFileSync(path.join(outDir,'hud-rpm.png'),normal.png()); fs.writeFileSync(path.join(outDir,'hud-shift.png'),alert.png()); }
console.log('PASS: exclusive cluster/HUD switching, exact ID7 HUD geometry, factory-guidance yield, first-frame ordering, live gear/shift gates, transparent HUD and exact cropped deltas');
