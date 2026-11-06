'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { settings } = require('../../apps/cluster_redline/policy');
const project = path.resolve(process.argv[2] || '');
const stage = path.resolve(process.argv[3] || path.join(project, 'dist/cluster_redline'));
if (!process.argv[2]) throw new Error('Pass the original idrive7-apps project path');
const { headUnit } = require(path.join(project, 'kit/tools/hu-stub'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cluster-profile-'));
// Saved shift threshold survives; retired scales/prefixes must no longer override presets.
fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ shiftRpm: 6200, redlineRpm: 6800, maxRpm: 8000, gearPrefix: 'S', torqueScale: 1500, autoSport: false, frameRate: 60 }));
let frames = 0;
const hu = headUnit(stage, { dataDir: dir, image: async () => { frames++; }, log: { info() {}, warn() {}, error() {} } });
function effective() {
    const raw = {}; hu.spec.settings.forEach((s) => { raw[s.key] = hu.settings.get(s.key); }); return settings(raw);
}
(async () => {
    try {
        hu.start(); await new Promise((r) => setTimeout(r, 30));
        assert(frames > 0, 'actual app entry must draw settings on startup');
        assert.strictEqual(effective().appEnabled, false, 'legacy OFF must survive upgrade');
        const listeners = process.listenerCount('exit');
        hu.settings.set('appEnabled', true); assert.strictEqual(process.listenerCount('exit'), listeners + 1);
        hu.settings.set('appEnabled', false); assert.strictEqual(process.listenerCount('exit'), listeners, 'OFF must stop its worker and remove the shutdown listener');
        assert.strictEqual(effective().shiftRpm, 6200);
        assert.strictEqual(effective().frameRate, 20, 'saved 60fps must not override the fixed ceiling');
        assert.strictEqual(effective().redlineRpm, 6000); assert.strictEqual(effective().maxRpm, 7000);
        assert.strictEqual(effective().gearPrefix, undefined); assert.strictEqual(effective().torqueScale, 500);
        assert.strictEqual(effective().displayTarget, 'panel'); assert.strictEqual(effective().widgetScale, 80);
        hu.handlers.BTN_NEXT(); hu.handlers.BTN_VALUE_UP(); // petrol -> diesel
        assert.strictEqual(effective().engineProfile, 'diesel'); assert.strictEqual(hu.settings.get('shiftRpm'), 0);
        assert.strictEqual(effective().shiftRpm, 4200); assert.strictEqual(effective().torqueScale, 700);
        hu.handlers.BTN_NEXT(); hu.handlers.BTN_VALUE_UP(); assert.strictEqual(effective().displayMode, 'all');
        hu.handlers.BTN_NEXT(); hu.handlers.BTN_VALUE_UP(); assert.strictEqual(effective().powerUnit, 'kW');
        hu.handlers.BTN_NEXT(); hu.handlers.BTN_VALUE_UP(); assert.strictEqual(effective().torqueUnit, 'kgfm');
        hu.handlers.BTN_ADVANCED(); hu.handlers.BTN_VALUE_UP(); assert.strictEqual(effective().shiftRpm, 2000);
        hu.handlers.BTN_NEXT(); hu.handlers.BTN_VALUE_UP(); assert.strictEqual(effective().displayTarget, 'map');
        hu.handlers.BTN_VALUE_UP(); assert.strictEqual(effective().displayTarget, 'hud', 'HUD must be selectable through the actual app controls');
        hu.handlers.BTN_NEXT(); hu.handlers.BTN_VALUE_DOWN(); assert.strictEqual(effective().widgetScale, 75);
        const saved = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json')));
        for (const key of ['appEnabled', 'engineProfile', 'displayMode', 'powerUnit', 'torqueUnit', 'shiftRpm', 'displayTarget', 'widgetScale']) assert.strictEqual(saved[key], hu.settings.get(key), 'persisted setting '+key);
        assert(!hu.spec.settings.some(s => ['gearPrefix','redlineRpm','maxRpm','torqueScale','powerScale','autoSport','frameRate'].includes(s.key)));
        console.log('PASS: actual bilingual-ready entry/UI, legacy OFF and fixed 20fps migration, preset reset, both tabs, all eight controls and persistence');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    process.exit(0);
})().catch((e) => { console.error(e); fs.rmSync(dir, { recursive: true, force: true }); process.exit(1); });
