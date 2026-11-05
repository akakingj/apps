'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { settings } = require('../../apps/cluster_redline/policy');
const { Controller } = require('../../apps/cluster_redline/controller');
const source = fs.readFileSync(path.join(__dirname, '../../apps/cluster_redline/worker.js'), 'utf8');

async function scenario(live, version, backend) {
    backend = backend || 'id7';
    let time = 0, timer, client, watches = 0, shutdowns = 0;
    const files = {}, feeds = {}, subscriptions = {}, config = settings(), app = new EventEmitter();
    const calls = [];
    class FakeClient extends EventEmitter {
        constructor() { super(); client = this; this.ready = false; this.backend = backend; this.targets = 'map:1088x480,panel:1920x720,hud:800x480'; this.next = 0; }
        connect() { calls.push('connect'); this.ready = true; this.emit('ready'); }
        image(o) { calls.push(['image', o]); return ++this.next; }
        pixels() { calls.push('pixels'); }
        set() { calls.push('visible'); }
        drop() { calls.push('drop'); }
        close() { calls.push('close'); this.ready = false; }
    }
    const painter = { W: 1088, H: 480, draw: () => ({ d: Buffer.alloc(4) }), difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
    const fakeFs = {
        readFileSync: () => JSON.stringify({ id: 'cluster-render', version: version }),
        writeFileSync: (p, v) => { files[p] = v; },
        renameSync: (a, b) => { files[b] = files[a]; delete files[a]; },
    };
    const box = { module: { exports: {} }, require: (name) => {
        if (name === 'fs') return fakeFs;
        if (name === 'path') return path;
        if (name === './cluster_render_client') return { ClusterRender: FakeClient };
        if (name === './controller') return { Controller };
        if (name === './draw') return painter;
        if (name === './policy') return require('../../apps/cluster_redline/policy');
        if (name === './renderer') return require('../../apps/cluster_redline/renderer');
        if (name === './gear') return require('../../apps/cluster_redline/gear');
        throw new Error('Unexpected dependency ' + name);
    }, process: { hrtime: () => [Math.floor(time / 1000), Math.floor((time % 1000) * 1000000)], once() {} },
    setTimeout: (fn) => { timer = fn; return 1; }, clearTimeout: () => { timer = null; }, console };
    vm.runInNewContext(source, box, { filename: 'worker.js' });
    const worker = box.module.exports.start({
        dataDir: '/data', app: app,
        settings: { get: (k) => config[k] }, log: { warn() {} },
        signals: { hasNative: () => live, watch: (iface, instance, handlers, log, options) => {
            assert.strictEqual(instance, '1'); assert.strictEqual(options.pollMs, 1000);
            feeds[iface] = handlers; watches++;
            const sub = { available: true, shutdown() { shutdowns++; } }; subscriptions[iface] = sub;
            return Promise.resolve(sub);
        } },
    });
    await Promise.resolve();
    const status = () => JSON.parse(files[path.join('/data', 'cluster-redline-status.json')]);
    const tick = (at) => { time = at; assert(timer); const fn = timer; timer = null; fn(); };
    assert.strictEqual(status().requested, false);
    if (!live) {
        assert.strictEqual(watches, 0); assert.strictEqual(calls.indexOf('connect'), -1);
        tick(1000); assert.strictEqual(status().source, 'offline-disabled');
    } else {
        assert.strictEqual(watches, 3);
        const rpm = feeds['de.bmw.infotainment.vehicle.CDS'].statusEngineSpeed2;
        const mode = feeds['de.bmw.infotainment.drivingexcitement.FES'].statusFESVehicleDynamicSwitchHMI;
        assert.strictEqual(typeof rpm, 'function'); assert.strictEqual(typeof mode, 'function');
        rpm({ actualValueRPMEngineCrankshaft: 26000 }); mode({ actualValueModeDrivingExperience: 'SPORT_DYNAMIC' });
        tick(1000);
        if (['0.3.10', '0.4.0'].includes(version) && backend === 'id7') {
            assert.strictEqual(status().requested, true); assert.strictEqual(status().rpm, 6500);
            assert.strictEqual(status().shift, true);
            const gear = feeds['de.bmw.infrastructure.VehicleInformation'];
            gear.statusGearboxDrive({ statusActualGearDrive: 'G4', statusActualStageDrive: 'D' });
            config.shiftRpm = 2000; rpm({ actualValueRPMEngineCrankshaft: 8400 }); tick(1500);
            assert.strictEqual(status().config.shiftRpm, 2000); assert.strictEqual(status().shift, true); assert.strictEqual(status().gear, 'D4');
            feeds['de.bmw.infotainment.drivingexcitement.FES'].statusActualValueTorque2({ actualValueTorqueCrankshaft: 2807 });
            config.shiftRpm = 3000; tick(2000);
            assert.strictEqual(status().shift, false); assert.strictEqual(status().gear, 'D4', 'change-only gear stays known while provider is live');
            assert.strictEqual(status().torqueNm, 380); assert(status().powerPS > 100);
            assert.deepStrictEqual(calls.filter((c) => Array.isArray(c)).map((c) => c[1].target), ['panel']);
            assert.strictEqual(status().targetName, 'panel');
            // The settings UI is never opened in this test. Its visibility is irrelevant.
            mode({ actualValueModeDrivingExperience: 4 }); tick(2500);
            assert.strictEqual(status().requested, false); assert(calls.includes('drop'));
            subscriptions['de.bmw.infrastructure.VehicleInformation'].available = false;
            mode({ actualValueModeDrivingExperience: 1 }); rpm({ actualValueRPMEngineCrankshaft: 24000 }); tick(3600);
            assert.strictEqual(status().gear, '--', 'provider loss must clear the last gear');
            config.autoSport = false; tick(4200); assert.strictEqual(status().requested, false);
        } else {
            assert.strictEqual(status().requested, false);
            if (!['0.3.10', '0.4.0'].includes(version)) assert.strictEqual(calls.indexOf('connect'), -1);
            assert.strictEqual(calls.filter((c) => Array.isArray(c) && c[0] === 'image').length, 0);
        }
    }
    app.emit('shutdown'); assert.strictEqual(timer, null); assert.strictEqual(shutdowns, watches);
    worker.stop(); // idempotent
}
(async () => {
    await scenario(true, '0.3.10');
    await scenario(true, '0.3.9');
    await scenario(true, '0.3.1');
    await scenario(true, '0.4.0');
    await scenario(true, '0.3.10', 'id8');
    await scenario(false, '0.3.10');
    console.log('PASS: real worker live-field adapters, raw RPM scale, background sport-only output, master OFF, old-renderer refusal, offline no-connect and platform shutdown');
})().catch((e) => { console.error(e); process.exit(1); });
