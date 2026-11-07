'use strict';
// Run the real worker, output coordinator and guidance policy. Only transport,
// vehicle bindings, filesystem and monotonic scheduling are replaced.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { EventEmitter } = require('events');
const { Outputs } = require('../../apps/cluster_redline/outputs');
const policy = require('../../apps/cluster_redline/policy');
const guidance = require('../../apps/cluster_redline/guidance');
const source = fs.readFileSync(path.join(__dirname, '../../apps/cluster_redline/worker.js'), 'utf8');
const CDS = 'de.bmw.infotainment.vehicle.CDS', FES = 'de.bmw.infotainment.drivingexcitement.FES';
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function harness(options) {
    const opt = options || {}, files = {}, feeds = {}, subscriptions = {}, watches = [], loads = [], polls = [], events = [];
    const app = new EventEmitter(), proc = new EventEmitter(), lateSubscriptions = [];
    const config = policy.settings({ displayMode: 'all', allClusterOutput: 'redline', allHudOutput: 'redline' });
    let time = 0, timer = null, client, writeCount = 0, pollThrow = null;
    class FakeClient extends EventEmitter {
        constructor() {
            super(); client = this; this.ready = false; this.backend = 'id7';
            this.targets = 'map:1088x480,hud:800x480'; this.next = 0; this.active = new Map();
        }
        connect() { this.ready = true; events.push(['connect']); this.emit('ready'); }
        image(value) { const ref = ++this.next; this.active.set(ref, value); events.push(['image', ref, value.target]); return ref; }
        pixels(ref) { assert(this.active.has(ref)); events.push(['pixels', ref]); }
        showWhenSent(ref) { assert(this.active.has(ref)); events.push(['visible', ref]); }
        set(ref, value) { assert(this.active.has(ref)); events.push(['set', ref, value]); }
        drop(ref) { assert(this.active.has(ref)); this.active.delete(ref); events.push(['drop', ref]); }
        close() { this.ready = false; events.push(['close']); }
    }
    const painter = { W: 1088, H: 480, draw: () => ({ d: Buffer.alloc(4) }), difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
    const box = { module: { exports: {} }, require(name) {
        if (name === 'fs') return {
            readFileSync(file) { assert.strictEqual(file, '/run/cluster-render/status.txt'); return 'backend=id7\n'; },
            writeFileSync(file, value) { files[file] = value; writeCount++; },
            renameSync(from, to) { files[to] = files[from]; delete files[from]; },
        };
        if (name === 'path') return path;
        if (name === './outputs') return { Outputs };
        if (name === './cluster_render_client') return { ClusterRender: FakeClient };
        if (name === './draw') return painter;
        if (name === './hud-draw') return Object.assign({}, painter, { W: 800, H: 240 });
        if (name === './policy') return policy;
        if (name === './guidance') return guidance;
        if (name === './gear') return require('../../apps/cluster_redline/gear');
        if (name === './renderer') return { inspect: () => ({ compatible: true, version: '0.4.0', hudGuidanceSafe: true }) };
        throw new Error('Unexpected dependency ' + name);
    }, process: {
        hrtime: () => [Math.floor(time / 1000), Math.round((time % 1000) * 1000000)],
        once: proc.once.bind(proc), removeListener: proc.removeListener.bind(proc),
    }, setTimeout(fn, ms) { assert.strictEqual(ms, 50); assert.strictEqual(timer, null, 'worker owns only one timer'); timer = fn; return 1; },
    clearTimeout() { timer = null; }, console };
    vm.runInNewContext(source, box, { filename: 'worker.js' });
    const signals = {
        hasNative: () => true,
        loadConfig(iface) {
            loads.push(iface);
            if (iface === guidance.INTERFACE) {
                if (opt.missing) throw new Error('guidance absent');
                return { fields: { guidanceState: opt.definition === undefined ? { getter: { id: 3 } } : opt.definition } };
            }
            throw new Error('optional MDrive absent');
        },
        watch(iface, instance, handlers, log, flags) {
            watches.push({ iface, instance, handlers, flags }); feeds[iface] = handlers;
            const sub = { available: true, shutdowns: 0, shutdown() { this.shutdowns++; } };
            if (iface === guidance.INTERFACE) {
                assert.strictEqual(iface, 'de.bmw.infotainment.navigation.guiding.Guidance');
                assert.strictEqual(instance, 'Main_Instance');
                assert.deepStrictEqual(Object.keys(handlers), ['guidanceState']);
                assert.strictEqual(Object.keys(flags).length, 0, 'guidance polling belongs to the worker timer');
                sub.proxy = { getValue(field, timeout) {
                    assert.strictEqual(field, 'guidanceState'); assert.strictEqual(timeout, 1000);
                    if (pollThrow) throw pollThrow;
                    const read = deferred(); polls.push(Object.assign(read, { field, timeout, at: time })); return read.promise;
                }, setValue() { throw new Error('worker must not write native guidance'); }, callMethod() { throw new Error('worker must not control routing'); } };
            } else {
                assert.strictEqual(instance, '1'); assert.strictEqual(flags.pollMs, 1000);
            }
            subscriptions[iface] = sub;
            if (opt.lateSubscriptions) { const later = deferred(); lateSubscriptions.push({ later, sub }); return later.promise; }
            return Promise.resolve(sub);
        },
    };
    const worker = box.module.exports.start({ dataDir: '/data', app, signals, settings: { get: key => config[key] }, log: { warn() {} } });
    function vehicle() {
        feeds[CDS].statusEngineSpeed2({ actualValueRPMEngineCrankshaft: 16000 });
        feeds[FES].statusFESVehicleDynamicSwitchHMI({ actualValueModeDrivingExperience: 'SPORT_DYNAMIC' });
    }
    function tick(at) {
        assert(at >= time); time = at; vehicle(); assert(timer, 'a live worker must schedule its next tick');
        const fn = timer; timer = null; fn();
    }
    function navigate(value, at) { if (at !== undefined) { assert(at >= time); time = at; } feeds[guidance.INTERFACE].guidanceState(value); }
    function both() { assert(worker.controller.cluster.ref, 'cluster remains requested'); assert(worker.controller.hud.ref, 'fresh inactive guidance permits a HUD layer request'); }
    function onlyCluster(reason) {
        assert(worker.controller.cluster.ref, 'guidance must never suppress cluster output'); assert.strictEqual(worker.controller.hud.ref, 0);
        if (reason) assert.strictEqual(worker.controller.hudBlockReason, reason);
    }
    function stopped() {
        assert.strictEqual(timer, null); assert.strictEqual(client.active.size, 0);
        assert.strictEqual(proc.listenerCount('exit'), 0); assert.strictEqual(app.listenerCount('shutdown'), 0);
        for (const sub of Object.values(subscriptions)) assert.strictEqual(sub.shutdowns, 1);
    }
    return { worker, client, app, proc, files, feeds, loads, subscriptions, watches, polls, events, lateSubscriptions,
        tick, navigate, both, onlyCluster, stopped, setPollThrow: value => { pollThrow = value; },
        get writes() { return writeCount; }, get pendingTimer() { return timer; } };
}
async function eventYield() {
    for (const [value, reason] of [['ACTIVE', 'guidance_active'], ['CALCULATING_ROUTE', 'guidance_calculating'], [null, 'guidance_unknown'], [{}, 'guidance_unknown'], ['INACTVE', 'guidance_unknown']]) {
        const h = harness();
        try {
            await flush(); h.navigate('INACTIVE'); h.tick(1000); h.both();
            const cluster = h.worker.controller.cluster.ref, hud = h.worker.controller.hud.ref;
            h.navigate(value, 1100);
            assert.strictEqual(h.worker.controller.hud.ref, 0, 'guidance events drop HUD before the next worker tick');
            assert.strictEqual(h.worker.controller.cluster.ref, cluster); assert(h.events.some(e => e[0] === 'drop' && e[1] === hud));
            h.tick(1150); h.onlyCluster(reason);
            h.navigate('INACTIVE', 1200); h.client.emit('target', 'hud', 'idle', '', '', false); h.tick(1250); h.both();
            assert.strictEqual(h.worker.controller.cluster.ref, cluster, 'HUD yield/recovery must not churn cluster acquisition');
            assert.strictEqual(h.loads.filter(x => x === guidance.INTERFACE).length, 1);
            const watch = h.watches.find(x => x.iface === guidance.INTERFACE); assert.strictEqual(watch.instance, 'Main_Instance');
        } finally { h.worker.stop(); h.stopped(); }
    }
}
async function optionalReadSafety() {
    for (const options of [{ missing: true }, { definition: { setter: { id: 5 } } }, { definition: { notifier: { id: 32769 } } }, { definition: null }]) {
        const h = harness(options);
        try {
            await flush(); h.tick(1000); h.onlyCluster('guidance_unavailable');
            assert(!h.watches.some(w => w.iface === guidance.INTERFACE), 'only a declared readable getter enables guidance integration');
            assert.strictEqual(h.polls.length, 0);
        } finally { h.worker.stop(); h.stopped(); }
    }
    const h = harness();
    try {
        await flush(); h.tick(1000); h.onlyCluster('guidance_unknown');
        h.navigate('INACTIVE', 1050); h.tick(1100); h.both();
        h.tick(6100); h.onlyCluster('guidance_stale');
        h.navigate('INACTIVE', 6150); h.tick(6200); h.both();
        h.subscriptions[guidance.INTERFACE].available = false; h.tick(6250); h.onlyCluster('guidance_unavailable');
        h.subscriptions[guidance.INTERFACE].available = true; h.tick(6300); h.onlyCluster('guidance_unknown');
        h.navigate('INACTIVE', 6350); h.tick(6400); h.both();
        h.subscriptions[guidance.INTERFACE].error = new Error('provider failed'); h.tick(6450); h.onlyCluster('guidance_unavailable');
    } finally { h.worker.stop(); h.stopped(); }
}
async function pollingAndRaces() {
    const h = harness();
    try {
        await flush(); h.tick(1000); h.onlyCluster('guidance_unknown'); assert.strictEqual(h.polls.length, 1);
        h.polls[0].resolve('INACTIVE'); await flush(); h.tick(1050); h.both();
        h.tick(1999); assert.strictEqual(h.polls.length, 1, 'owned reads are limited to once a second');
        h.tick(2000); assert.strictEqual(h.polls.length, 2);
        h.tick(3000); h.tick(4000); assert.strictEqual(h.polls.length, 2, 'one unresolved getter must not spawn additional reads');
        h.navigate('ACTIVE', 4050); assert.strictEqual(h.worker.controller.hud.ref, 0);
        h.polls[1].resolve('INACTIVE'); await flush(); h.tick(4100); h.onlyCluster('guidance_active');
        assert.strictEqual(h.polls.length, 3, 'a completed old read frees the next poll without overwriting the newer event');
        h.polls[2].resolve('INACTIVE'); await flush(); h.tick(4150); h.both();
        h.tick(5100); assert.strictEqual(h.polls.length, 4);
        h.polls[3].reject(new Error('read failed')); await flush();
        assert.strictEqual(h.worker.controller.hud.ref, 0, 'a failed getter releases HUD immediately');
        h.tick(5150); h.onlyCluster('guidance_unknown');
        h.navigate('INACTIVE', 5200); h.tick(5250); h.both();
        h.setPollThrow(new Error('synchronous binding failure')); h.tick(6100); h.onlyCluster('guidance_unknown');
    } finally { h.worker.stop(); h.stopped(); }
}
async function providerReconnectRace() {
    const h = harness();
    try {
        await flush(); h.navigate('INACTIVE'); h.tick(1000); h.both();
        assert.strictEqual(h.polls.length, 1);
        h.subscriptions[guidance.INTERFACE].available = false; h.tick(1100); h.onlyCluster('guidance_unavailable');
        h.subscriptions[guidance.INTERFACE].available = true; h.tick(1200); h.onlyCluster('guidance_unknown');
        h.polls[0].resolve('INACTIVE'); await flush(); h.tick(1250); h.onlyCluster('guidance_unknown');
        assert.strictEqual(h.polls.length, 1, 'reconnection does not bypass the owned one-second polling interval');
        h.tick(2000); assert.strictEqual(h.polls.length, 2);
        h.polls[1].resolve('INACTIVE'); await flush(); h.tick(2050); h.both();
        // An error from a superseded read is equally unable to overwrite a
        // newer event, including a fresh native INACTIVE notification.
        h.tick(3000); assert.strictEqual(h.polls.length, 3);
        h.navigate('INACTIVE', 3050); h.polls[2].reject(new Error('old read failed')); await flush();
        h.tick(3100); h.both();
    } finally { h.worker.stop(); h.stopped(); }
}
async function lateReadsAndSubscriptions() {
    const h = harness();
    await flush(); h.navigate('INACTIVE'); h.tick(1000); h.both();
    const pending = h.polls[0];
    h.app.emit('shutdown'); h.stopped();
    const count = h.events.length, writes = h.writes;
    pending.resolve('ACTIVE'); await flush(); h.navigate('INACTIVE');
    assert.strictEqual(h.events.length, count, 'late getter/events cannot recreate or change a stopped output');
    assert.strictEqual(h.writes, writes); h.stopped(); h.worker.stop(); h.stopped();
    const early = harness({ lateSubscriptions: true });
    early.worker.stop();
    for (const entry of early.lateSubscriptions) entry.later.resolve(entry.sub);
    await flush(); early.stopped();
    assert.strictEqual(early.events.filter(e => e[0] === 'image').length, 0);
}
(async () => {
    await eventYield(); await optionalReadSafety(); await pollingAndRaces(); await providerReconnectRace(); await lateReadsAndSubscriptions();
    console.log('PASS: actual worker native-guidance getter gating/instance, immediate HUD-only yield, fresh recovery, optional/stale/provider safety, bounded polling, event/read/provider-reconnect races and complete late-work shutdown');
})().catch(error => { console.error(error); process.exitCode = 1; });
