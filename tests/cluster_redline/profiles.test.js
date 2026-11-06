'use strict';
const assert = require('assert');
const { EventEmitter } = require('events');
const { Policy, PROFILES, settings } = require('../../apps/cluster_redline/policy');
const { Controller } = require('../../apps/cluster_redline/controller');
const expected = { petrol: [6500, 6000, 7000], diesel: [4200, 5000, 6000], hybrid: [6500, 7000, 8000], m: [7000, 7000, 9000] };
Object.keys(expected).forEach((profile) => {
    const low = settings({ engineProfile: profile, shiftRpm: 2000 });
    assert.strictEqual(low.shiftRpm, 2000, '2000 rpm offered by the UI must not silently become a profile default');
    const threshold = new Policy(); threshold.modeSample(1, 0); threshold.rpmSample(1990, 1000);
    assert.strictEqual(threshold.evaluate(1000, true, low).shift, false);
    threshold.rpmSample(2000, 1000); assert.strictEqual(threshold.evaluate(1000, true, low).shift, true);
    const cfg = settings({ engineProfile: profile, shiftRpm: 0, redlineRpm: 0, maxRpm: 0 });
    assert.deepStrictEqual([cfg.shiftRpm, cfg.redlineRpm, cfg.maxRpm], expected[profile]);
    assert.deepStrictEqual(settings(cfg), cfg, 'normalization must be idempotent');
    const p = new Policy();
    p.modeSample(1, 0); p.rpmSample(cfg.shiftRpm - 10, 1000);
    assert.strictEqual(p.evaluate(1000, true, cfg).show, true);
    assert.strictEqual(p.evaluate(1000, true, cfg).shift, false);
    p.rpmSample(cfg.shiftRpm, 1000); assert.strictEqual(p.evaluate(1000, true, cfg).shift, true);
    p.modeSample(4, 1100); assert.strictEqual(p.evaluate(1100, true, cfg).show, false);
    p.modeSample(1, 2000); p.rpmSample(0, 3000);
    const stopped = p.evaluate(3000, true, cfg);
    assert.strictEqual(stopped.show, false); assert.strictEqual(stopped.shift, false);
    assert.strictEqual(stopped.reason, profile === 'hybrid' ? 'hybrid_engine_stopped' : 'engine_stopped');
});
assert.strictEqual(settings({ engineProfile: 'diesel', shiftRpm: 6500 }).shiftRpm, 4200);
assert.strictEqual(settings({ engineProfile: 'diesel', shiftRpm: 4500 }).shiftRpm, 4500);
const g20 = settings({ engineProfile: 'petrol', shiftRpm: 6500, redlineRpm: 6000, maxRpm: 7000 });
assert.strictEqual(g20.redlineRpm, 6000, 'shift alert must not raise the requested red-zone start');
assert.strictEqual(g20.maxRpm, 7000);
assert.strictEqual(settings({ engineProfile: 'petrol', shiftRpm: 2000 }).shiftRpm, 2000);
const hybrid = new Policy(); hybrid.modeSample(1, 0); hybrid.rpmSample(0, 1000);
assert.strictEqual(hybrid.evaluate(1000, true, { engineProfile: 'hybrid' }).reason, 'hybrid_engine_stopped');
hybrid.rpmSample(3500, 1200);
assert.strictEqual(hybrid.evaluate(1200, true, { engineProfile: 'hybrid' }).show, true, 'fresh engine restart resumes RPM output');
hybrid.rpmSample(null, 1300);
assert.strictEqual(hybrid.evaluate(1300, true, { engineProfile: 'hybrid' }).reason, 'rpm_unknown', 'missing RPM is distinct from normal engine-off');
const unknown = new Policy(); unknown.modeSample(1, 0); unknown.rpmSample(4200, 1000);
assert.strictEqual(unknown.evaluate(1000, true, { engineProfile: 'typo' }).reason, 'profile_unknown');

class Client extends EventEmitter {
    constructor() { super(); this.ready = true; this.targets = 'map:1088x480,panel:1920x720'; this.made = []; this.dropped = []; this.next = 0; }
    image(o) { this.made.push(o); return ++this.next; }
    pixels() {} set() {} close() {}
    drop(id) { this.dropped.push(id); }
}
const client = new Client(), painter = { W: 1088, H: 480, draw: () => ({ d: Buffer.alloc(4) }), difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
const c = new Controller(client, painter);
c.policy.modeSample(1, 0); c.policy.rpmSample(4200, 1000);
c.tick(1000, { engineProfile: 'petrol' }); assert.strictEqual(client.made.length, 1);
// Changing engine profile cannot replay old live samples under a new RPM scale.
const switched = c.tick(1100, { engineProfile: 'diesel' });
assert.strictEqual(switched.show, false); assert.deepStrictEqual(client.dropped, [1]);
c.policy.modeSample(1, 1200); c.policy.rpmSample(4200, 2200);
const diesel = c.tick(2200, { engineProfile: 'diesel' });
assert.strictEqual(diesel.show, true); assert.strictEqual(diesel.shift, true); assert.strictEqual(diesel.config.maxRpm, 6000);
c.tick(2300, { engineProfile: 'diesel', frameRate: 4 });
assert.strictEqual(client.made[client.made.length - 1].fps, 20, 'legacy frame-rate choices must not override the fixed ceiling');
c.close();
console.log('PASS: one app / four presets, per-profile presets, custom ranges, hybrid engine-off hide, unknown-profile hide and live profile-switch cleanup');
