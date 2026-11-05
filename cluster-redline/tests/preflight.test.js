'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { check, versionAtLeast, selectBundle } = require('../tools/preflight');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cluster-redline-check-'));
function put(name, obj) { const f = path.join(root, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj)); }
try {
    assert(check(root).every((r) => !r.ok));
    put('var/opt/cluster-render/current/component.json', { id: 'cluster-render', version: '0.3.10' });
    put('var/opt/mgu-deploy/current/component.json', { id: 'mgu-deploy', version: '0.7.17' });
    put('etc/oap/someip/someip-interfaces.json', { interfaces: {
        'de.bmw.infotainment.vehicle.CDS': { fields: { statusEngineSpeed2: { getter: true } } },
        'de.bmw.infotainment.drivingexcitement.FES': { fields: { statusFESVehicleDynamicSwitchHMI: { getter: true } } },
    } });
    assert(check(root).every((r) => r.ok));
    put('var/opt/mgu-deploy/current/component.json', { id: 'mgu-deploy', version: '0.7.16' });
    assert.strictEqual(check(root)[1].ok, false);
    assert(!versionAtLeast('not-a-version', [0, 3, 10]));
    const name = 'cluster_redline@0.2.0-ko.1.mgu', bundle = Buffer.from('test bundle');
    fs.writeFileSync(path.join(root, name), bundle);
    fs.writeFileSync(path.join(root, 'cluster_redline@0.1.0-ko.1.mgu'), 'old bundle');
    put('release.json', { app_id: 'cluster_redline', bundle: name, sha256: crypto.createHash('sha256').update(bundle).digest('hex') });
    assert.strictEqual(selectBundle(root), path.join(root, name));
    fs.appendFileSync(path.join(root, name), 'tampered');
    assert.throws(() => selectBundle(root), /checksum mismatch/);
    console.log('PASS: read-only preflight rejects missing dependencies and older autostart installers');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
