'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, versionAtLeast } = require('../../tools/cluster-redline-preflight');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cluster-redline-check-'));
function put(name, obj) { const f = path.join(root, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj)); }
try {
    assert(check(root).every((r) => !r.ok));
    put('var/opt/cluster-render/current/component.json', { id: 'cluster-render', version: '0.4.0' });
    put('etc/oap/someip/someip-interfaces.json', { interfaces: {
        'de.bmw.infotainment.vehicle.CDS': { fields: { statusEngineSpeed2: { getter: true } } },
        'de.bmw.infotainment.drivingexcitement.FES': { fields: { statusFESVehicleDynamicSwitchHMI: { getter: true } } },
    } });
    assert(check(root).every((r) => r.ok));
    put('var/opt/cluster-render/current/component.json', { id: 'cluster-render', version: '0.3.9' });
    assert.strictEqual(check(root)[0].ok, false);
    assert(!versionAtLeast('not-a-version', [0, 3, 10]));
    console.log('PASS: read-only preflight checks cluster renderer and live fields without requiring mgu-deploy');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
