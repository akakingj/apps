'use strict';
const assert = require('assert');
const { EventEmitter } = require('events');
const { Policy, PROFILES } = require('../../apps/cluster_redline/policy');
const { Outputs } = require('../../apps/cluster_redline/outputs');

class Client extends EventEmitter {
    constructor() {
        super(); this.ready = true; this.targets = 'map:1088x480,hud:800x480';
        this.next = 0; this.active = new Map(); this.events = [];
    }
    image(options) { const ref = ++this.next; this.active.set(ref, options); this.events.push(['image', ref]); return ref; }
    pixels(ref, rects, pixels) { this.events.push(['pixels', ref, Buffer.from(pixels)]); }
    showWhenSent(ref) { assert(this.events.some((e) => e[0] === 'pixels' && e[1] === ref)); this.events.push(['show', ref]); }
    set(ref, options) { Object.assign(this.active.get(ref), options); this.events.push(['set', ref]); }
    drop(ref) { this.active.delete(ref); this.events.push(['drop', ref]); }
    close() { this.ready = false; }
}
function painter() {
    return { W: 4, H: 4,
        draw(state) { const d = Buffer.alloc(64); d.writeUInt32LE(Math.round(state.rpm), 0); return { d }; },
        difference(previous, next) {
            return previous.equals(next) ? { rects: [], pixels: Buffer.alloc(0) } :
                { rects: [{ x: 0, y: 0, w: 4, h: 4 }], pixels: next };
        } };
}
function sample(policy, at, rpm, mode) { policy.modeSample(mode === undefined ? 1 : mode, at); policy.rpmSample(rpm, at); }
function zeroState(state) {
    for (const name of ['cluster', 'hud']) {
        assert.strictEqual(state.outputs[name].requested, true, name + ' remains requested during a fresh automatic stop');
        assert.strictEqual(state.outputs[name].rpm, 0, 'show the received zero, not the last running RPM');
        assert.strictEqual(state.outputs[name].shift, false, 'zero RPM cannot retain the old shift alert');
    }
}

for (const profile of Object.keys(PROFILES)) {
    const cfg = { engineProfile: profile, sportHudOutput: 'redline' };
    const policy = new Policy(); sample(policy, 0, 0); sample(policy, 1000, 0);
    assert.strictEqual(policy.evaluate(1000, true, cfg).show, false, profile + ': cold boot at zero remains hidden');
    sample(policy, 1100, 1500); assert.strictEqual(policy.evaluate(1100, true, cfg).show, true);
    sample(policy, 1200, 0); let state = policy.evaluate(1200, true, cfg);
    assert.strictEqual(state.show, true); assert.strictEqual(state.rpm, 0); assert.strictEqual(state.shift, false);
    for (let at = 2200; at <= 61200; at += 1000) {
        sample(policy, at, 0); state = policy.evaluate(at, true, cfg);
        assert.strictEqual(state.show, true, profile + ': zero must not turn into a timeout while both feeds remain fresh');
        assert.strictEqual(state.rpm, 0);
    }
    // It is explicit zero plus fresh live feeds that permits showing. Missing
    // updates, an invalid sample or a reset are not evidence of an auto stop.
    policy.modeSample(1, 63201);
    assert.strictEqual(policy.evaluate(63201, true, cfg).reason, 'rpm_unknown');
    sample(policy, 64000, null); assert.strictEqual(policy.evaluate(64000, true, cfg).show, false);
    sample(policy, 65000, 0); assert.strictEqual(policy.evaluate(65000, true, cfg).show, false, 'invalid RPM clears the previous-running latch');
    sample(policy, 66000, 1600); assert.strictEqual(policy.evaluate(66000, true, cfg).show, true);
    sample(policy, 67000, NaN); sample(policy, 68000, 0);
    assert.strictEqual(policy.evaluate(68000, true, cfg).show, false);
    sample(policy, 69000, 1600); sample(policy, 70000, 0);
    policy.reset(); sample(policy, 71000, 0); sample(policy, 72000, 0);
    assert.strictEqual(policy.evaluate(72000, true, cfg).show, false, 'renderer/process reset waits for a running engine again');
}

// Exercise the real two-output coordinator: stop/start is a pixel update, not
// a native scene drop/reacquisition or a replay of the last non-zero reading.
{
    const client = new Client(), outputs = new Outputs(client, painter(), painter());
    const cfg = { sportHudOutput: 'redline' };
    sample(outputs.policy, 0, 1500); sample(outputs.policy, 1000, 1500);
    let state = outputs.tick(1000, cfg); outputs.tick(1250, cfg);
    assert(state.outputs.cluster.requested && state.outputs.hud.requested);
    const clusterRef = outputs.cluster.ref, hudRef = outputs.hud.ref;
    assert(clusterRef && hudRef && clusterRef !== hudRef);
    for (let at = 2000; at <= 62000; at += 1000) {
        sample(outputs.policy, at, 0); state = outputs.tick(at, cfg); zeroState(state);
        assert.strictEqual(outputs.cluster.ref, clusterRef); assert.strictEqual(outputs.hud.ref, hudRef);
    }
    assert.strictEqual(client.events.filter((e) => e[0] === 'image').length, 2, 'a minute of engine auto-stop must not create replacement layers');
    assert.strictEqual(client.events.filter((e) => e[0] === 'drop').length, 0);
    for (const ref of [clusterRef, hudRef]) {
        const sent = client.events.filter((e) => e[0] === 'pixels' && e[1] === ref);
        assert(sent.length >= 2); assert.strictEqual(sent[sent.length - 1][2].readUInt32LE(0), 0);
    }
    sample(outputs.policy, 63000, 900); state = outputs.tick(63000, cfg);
    assert.strictEqual(state.outputs.cluster.rpm, 900); assert.strictEqual(state.outputs.hud.rpm, 900);
    assert.strictEqual(outputs.cluster.ref, clusterRef); assert.strictEqual(outputs.hud.ref, hudRef);
    sample(outputs.policy, 64000, 0); outputs.tick(64000, cfg);
    outputs.policy.modeSample(1, 66001); state = outputs.tick(66001, cfg);
    assert.strictEqual(state.requested, false, 'a stale zero-RPM feed still releases both outputs');
    assert.strictEqual(client.active.size, 0);
    outputs.close();
}

// Retaining zero never bypasses normal selection, OFF, freshness or renderer
// availability rules. All-mode owners get the same stop/start behavior.
for (const displayMode of ['sport', 'all']) {
    const cfg={displayMode,sportHudOutput:'redline',allHudOutput:displayMode==='all'?'redline':'stock'};
    const client = new Client(), outputs = new Outputs(client, painter(), painter());
    sample(outputs.policy, 0, 1000); sample(outputs.policy, 1000, 1000); outputs.tick(1000, cfg);
    sample(outputs.policy, 2000, 0); zeroState(outputs.tick(2000, cfg));
    assert.strictEqual(outputs.tick(2050, Object.assign({}, cfg, { appEnabled: false })).requested, false);
    assert.strictEqual(client.active.size, 0);
    sample(outputs.policy, 3000, 0, 4);
    const state = outputs.tick(3000, cfg);
    assert.strictEqual(state.requested, displayMode === 'all', 'Sport exit remains an immediate release only in Sport mode');
    sample(outputs.policy, 4000, 0); outputs.tick(4000, cfg);
    outputs.policy.rpmSample(0, 8000);
    assert.strictEqual(outputs.tick(8000, cfg).requested, false, 'stale drive mode must hide despite fresh zero RPM');
    sample(outputs.policy, 9000, 1200); outputs.tick(9000, cfg);
    client.ready = false; client.emit('disconnected');
    assert.strictEqual(client.active.size, 0);
    client.ready = true; client.emit('ready');
    sample(outputs.policy, 10000, 0); sample(outputs.policy, 11000, 0);
    assert.strictEqual(outputs.tick(11000, cfg).requested, false, 'connection reset cannot retain the engine-running latch');
    outputs.close();
}
console.log('PASS: four-profile warm stop/start retains fresh zero RPM and both native layers for 60s, with restart continuity, no stale-value replay, cold-boot/reset/invalid gates, OFF/mode/freshness release');
