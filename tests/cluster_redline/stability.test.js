'use strict';
const assert = require('assert');
const { EventEmitter } = require('events');
const { UploadPacer } = require('../../apps/cluster_redline/upload');
const { GearState, display, gearbox } = require('../../apps/cluster_redline/gear');
const { Controller } = require('../../apps/cluster_redline/controller');
const p = new UploadPacer();
p.allow(2088960, 0, true);
let bytes = 0, accepted = 0;
for (let now = 250; now < 10250; now += 1000 / 60) {
    if (p.ready(now) && p.allow(100000, now, false)) { bytes += 100000; accepted++; }
}
assert(bytes <= p.rate * 10.25 && accepted < 120, '60Hz input cannot flood the compositor with 6MB/s of deltas');
const large = new UploadPacer(); large.allow(2088960, 0, true);
let sent = false;
for (let now = 250; now <= 2000; now += 50) if (large.ready(now) && large.allow(600000, now, false)) { sent = true; break; }
assert(sent, 'a large changed area cannot wait forever');
p.budget(2000); assert(p.rate <= 2000 * 1024 * 0.3);
const g = new GearState();
g.sample('gearbox', { statusActualGearDrive: 'G1', statusActualStageDrive: 'D' });
g.sample('selection', {}); assert.strictEqual(display(g.gear, g.mode, 'auto'), 'D1');
g.sample('programme', { displayProgramGearbox: 'S_MINUS_PROGRAMM' });
assert.strictEqual(display(g.gear, g.programMode || g.mode, 'auto'), 'S1');
g.sample('programme', { displayProgramGearbox: 2 });
assert.strictEqual(display(g.gear, g.programMode || g.mode, 'auto'), 'M1');
g.sample('selection', { statusGearSelectionDrive: 'D' });
assert.strictEqual(g.gear, '1', 'a selector-only event must not wipe a known engaged gear');
g.sample('programme', { displayProgramGearbox: 255 }); assert.strictEqual(g.programMode, null);
for (const text of ['M1', 'S1', 'D1']) {
    const direct = new GearState(); direct.sample('selection', { statusGearSelectionDrive: text });
    assert.strictEqual(display(direct.gear, direct.mode, 'auto'), text);
}
assert.strictEqual(gearbox({ statusActualStageDrive: 'P', statusActualGearDrive: 'S1' }), 'P');
g.sample('selection', { statusGearSelectionDrive: 'P' }); assert.strictEqual(g.gear, 'P');
g.sample('selection', { statusGearSelectionDrive: 'D' }); assert.strictEqual(g.gear, 'D', 'do not replay a pre-Park gear');
g.sample('selection', { statusGearSelectionDrive: 'D1' });
g.sample('selection', { statusGearSelectionDrive: 'NP' });
assert.strictEqual(g.gear, '--', 'a real N/P report is distinct from an absent field');
g.clear(); assert.strictEqual(g.gear, '--');
class Client extends EventEmitter {
    constructor() { super(); this.ready = true; this.targets = 'panel:1920x720,map:1088x480'; this.next = 0; this.made = []; this.dropped = []; }
    image(o) { this.made.push(o); return ++this.next; }
    drop(ref) { this.dropped.push(ref); } pixels() {} set() {} close() {}
}
const client = new Client(), painter = { W: 4, H: 4, draw: () => ({ d: Buffer.alloc(64) }), difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
const c = new Controller(client, painter);
c.policy.modeSample(1, 0); c.policy.rpmSample(4200, 1000); c.tick(1000);
assert.strictEqual(client.made[0].exclusive, true, 'atomic image recovery retains the last full frame');
assert.strictEqual(client.made[0].contend, true, 'default map output requests stock-map takeover');
assert.strictEqual(c.tick(2901).requested, false, 'stale RPM still releases immediately');
c.policy.modeSample(1, 3000); c.policy.rpmSample(4200, 3000);
assert.strictEqual(c.tick(3000).reason, 'recovering');
assert.strictEqual(c.tick(3500).requested, false);
c.policy.modeSample(1, 4800); c.policy.rpmSample(4200, 4900);
assert.strictEqual(c.tick(4901).requested, true);
assert.strictEqual(client.made.length, 2, 'data recovery cannot rapidly churn layer requests');
c.policy.modeSample(4, 5000); assert.strictEqual(c.tick(5000).requested, false);
console.log('PASS: bounded 60Hz traffic, large-frame recovery, gear-source fusion and S/M programme, atomic image flag, immediate stale release and stable reacquisition');
