'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { selectKit, checkEnvironment } = require('../tools/check-kit');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'jam-kit-'));
try {
    const root = path.join(folder, 'car');
    const metadata = path.join(root, 'var/opt/mgu-deploy/current');
    fs.mkdirSync(metadata, { recursive: true });
    fs.writeFileSync(path.join(metadata, 'component.json'), JSON.stringify({ id: 'mgu-deploy', version: '0.7.17' }));
    function entry(id) {
        const app = { id, version: '1.0.0-ko.1', bundle: id + '@1.0.0-ko.1.mgu', start_type: id === 'cluster_redline' ? 'autostart' : 'manually' };
        fs.writeFileSync(path.join(folder, app.bundle), id);
        app.sha256 = crypto.createHash('sha256').update(id).digest('hex');
        return app;
    }
    const circuit = entry('idrive_circuit'), cluster = entry('cluster_redline');
    function write(apps) { fs.writeFileSync(path.join(folder, 'kit.json'), JSON.stringify({ schema_version: 1, language: 'ko', apps })); }
    // An obsolete or unrelated bundle alongside a selected kit is never installed.
    fs.writeFileSync(path.join(folder, 'unrelated@0.1.0.mgu'), 'old');
    write([circuit, cluster]);
    assert.deepStrictEqual(selectKit(folder).map((a) => a.id), ['idrive_circuit', 'cluster_redline']);
    assert(checkEnvironment(selectKit(folder), root).some((check) => !check.ok));
    write([circuit]);
    assert.deepStrictEqual(selectKit(folder).map((a) => a.id), ['idrive_circuit']);
    assert(checkEnvironment(selectKit(folder), root).every((check) => check.ok), 'Circuit alone must not need cluster-render');
    write([circuit, circuit]); assert.throws(() => selectKit(folder), /duplicate/);
    write([Object.assign({}, circuit, { bundle: '../other.mgu' })]); assert.throws(() => selectKit(folder), /identity/);
    write([Object.assign({}, circuit, { start_type: 'autostart' })]); assert.throws(() => selectKit(folder), /start type/);
    write([circuit, cluster]);
    fs.writeFileSync(path.join(folder, cluster.bundle), 'tampered');
    assert.throws(() => selectKit(folder), /checksum/, 'Reject the whole kit when any artifact was changed');
    fs.unlinkSync(path.join(folder, cluster.bundle)); assert.throws(() => selectKit(folder));
    console.log('PASS: combined and single selection, no stray packages, per-app prerequisites, identity/start-type checks and whole-kit tamper rejection');
} finally { fs.rmSync(folder, { recursive: true, force: true }); }
