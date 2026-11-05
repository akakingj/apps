'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { settings } = require('../../apps/cluster_redline/policy');
const project = path.resolve(process.argv[2] || '');
const stage = path.resolve(process.argv[3] || path.join(__dirname, '../../dist/cluster_redline'));
if (!process.argv[2]) throw new Error('Pass the original idrive7-apps project path');
const { headUnit } = require(path.join(project, 'kit/tools/hu-stub'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cluster-profile-'));
// Simulate a 0.1.x owner with manual petrol limits. Upgrading must retain them.
fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ shiftRpm: 6200, redlineRpm: 6800, maxRpm: 8000 }));
const hu = headUnit(stage, { dataDir: dir, image: async () => {}, log: { info() {}, warn() {}, error() {} } });
function effective() {
    const raw = {};
    ['autoSport', 'engineProfile', 'shiftRpm', 'redlineRpm', 'maxRpm', 'frameRate', 'displayTarget', 'widgetScale', 'gearPrefix', 'torqueScale', 'powerScale'].forEach((k) => { raw[k] = hu.settings.get(k); });
    return settings(raw);
}
(async () => {
    try {
        hu.start();
        await new Promise((r) => setTimeout(r, 30));
        assert.strictEqual(effective().engineProfile, 'petrol');
        assert.strictEqual(effective().shiftRpm, 6200);
        assert.strictEqual(effective().redlineRpm, 6800);
        assert.strictEqual(effective().displayTarget, 'panel');
        assert.strictEqual(effective().widgetScale, 75);
        hu.settings.set('widgetScale', 65); assert.strictEqual(effective().widgetScale, 65);
        hu.settings.set('gearPrefix', 'S'); assert.strictEqual(effective().gearPrefix, 'S');
        for (const rate of [12, 30, 60]) {
            hu.settings.set('frameRate', rate); assert.strictEqual(effective().frameRate, rate);
        }
        hu.settings.set('displayTarget', 'map'); assert.strictEqual(effective().displayTarget, 'map');
        hu.settings.set('shiftRpm', 2000);
        assert.strictEqual(effective().shiftRpm, 2000, 'real settings UI must preserve a selected 2000 rpm threshold');
        hu.settings.set('engineProfile', 'diesel');
        for (const k of ['shiftRpm', 'redlineRpm', 'maxRpm']) assert.strictEqual(hu.settings.get(k), 0);
        assert.strictEqual(effective().shiftRpm, 4200); assert.strictEqual(effective().maxRpm, 6000);
        hu.settings.set('shiftRpm', 4500); assert.strictEqual(effective().shiftRpm, 4500);
        hu.settings.set('engineProfile', 'hybrid');
        assert.strictEqual(effective().shiftRpm, 6500);
        const saved = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json')));
        assert.strictEqual(saved.engineProfile, 'hybrid'); assert.strictEqual(saved.shiftRpm, 0);
        console.log('PASS: actual settings UI preserves old petrol choices, resets limits on profile switch and persists the new profile');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    process.exit(0); // demo/background timers belong to this one-shot test process
})().catch((e) => { console.error(e); fs.rmSync(dir, { recursive: true, force: true }); process.exit(1); });
