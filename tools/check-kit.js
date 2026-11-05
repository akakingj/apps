'use strict';
// Vehicle-side read-only validation. No SOME/IP connection or vehicle writes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cluster = require('./cluster-redline-preflight');
function selectKit(folder) {
    const kit = JSON.parse(fs.readFileSync(path.join(folder, 'kit.json'), 'utf8'));
    if (kit.schema_version !== 1 || kit.language !== 'ko' || !Array.isArray(kit.apps) || !kit.apps.length || kit.apps.length > 2) throw new Error('Invalid Korean kit manifest');
    const ids = [];
    return kit.apps.map((app) => {
        if (['idrive_circuit', 'cluster_redline'].indexOf(app.id) < 0 || ids.indexOf(app.id) >= 0) throw new Error('Unknown or duplicate app');
        ids.push(app.id);
        if (!/^\d+\.\d+\.\d+-ko\.\d+$/.test(app.version || '') || app.bundle !== app.id + '@' + app.version + '.mgu') throw new Error('Invalid bundle identity');
        if (app.start_type !== (app.id === 'cluster_redline' ? 'autostart' : 'manually')) throw new Error('Invalid app start type');
        const file = path.resolve(folder, app.bundle);
        const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        if (hash !== app.sha256) throw new Error('Bundle checksum mismatch: ' + app.id);
        return { id: app.id, file: file };
    });
}
function checkEnvironment(apps, root) {
    if (apps.some((app) => app.id === 'cluster_redline')) return cluster.check(root);
    root = root || '/';
    try {
        let component;
        ['var/opt/mgu-deploy/current/component.json', 'var/opt/mgu-deploy/component.json'].some((name) => {
            try { component = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')); return true; } catch (e) { return false; }
        });
        if (!component || component.id !== 'mgu-deploy' || !cluster.versionAtLeast(component.version, [0, 7, 17])) throw new Error('mgu-deploy 0.7.17+ required');
        return [{ name: 'mgu-deploy', ok: true, detail: component.version }];
    } catch (e) { return [{ name: 'mgu-deploy', ok: false, detail: e.message }]; }
}
if (require.main === module) {
    try {
        const only = process.argv[2] === '--verify-only';
        const apps = selectKit(path.resolve(process.argv[only ? 3 : 2] || '.'));
        if (!only) {
            const checks = checkEnvironment(apps);
            console.error(JSON.stringify(checks, null, 2));
            if (!checks.every((r) => r.ok)) throw new Error('Required vehicle dependencies are missing');
        }
        apps.forEach((app) => console.log(app.file));
    } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { selectKit, checkEnvironment };
