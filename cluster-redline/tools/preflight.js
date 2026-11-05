'use strict';
// Run on the MGU as root or a user that can read the deployment metadata.
// This command reads files only; it never changes coding or starts an app.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FES = 'de.bmw.infotainment.drivingexcitement.FES';
const CDS = 'de.bmw.infotainment.vehicle.CDS';
function versionAtLeast(v, minimum) {
    const parts = String(v || '').split('.').map(Number);
    if (parts.length !== 3 || !parts.every((n) => isFinite(n) && n >= 0)) return false;
    for (let i = 0; i < 3; i++) { if (parts[i] > minimum[i]) return true; if (parts[i] < minimum[i]) return false; }
    return true;
}
function check(root) {
    root = root || '/';
    const results = [], file = (n) => path.join(root, n);
    function test(name, fn) {
        try { const detail = fn(); results.push({ name: name, ok: true, detail: detail }); }
        catch (e) { results.push({ name: name, ok: false, detail: e.message }); }
    }
    test('cluster-render', () => {
        const c = JSON.parse(fs.readFileSync(file('var/opt/cluster-render/current/component.json'), 'utf8'));
        if (c.id !== 'cluster-render' || !versionAtLeast(c.version, [0, 3, 10])) throw new Error('cluster-render 0.3.10+ required');
        return c.version;
    });
    test('mgu-deploy autostart', () => {
        const paths = ['var/opt/mgu-deploy/current/component.json', 'var/opt/mgu-deploy/component.json'];
        let c;
        paths.some((p) => { try { c = JSON.parse(fs.readFileSync(file(p), 'utf8')); return true; } catch (e) { return false; } });
        if (!c || c.id !== 'mgu-deploy' || !versionAtLeast(c.version, [0, 7, 17])) throw new Error('Update mgu-deploy to 0.7.17+; older installers may ignore autostart');
        return c.version;
    });
    test('live RPM and drive mode getters', () => {
        const db = JSON.parse(fs.readFileSync(file('etc/oap/someip/someip-interfaces.json'), 'utf8'));
        [[CDS, 'statusEngineSpeed2'], [FES, 'statusFESVehicleDynamicSwitchHMI']].forEach((p) => {
            const f = db.interfaces && db.interfaces[p[0]] && db.interfaces[p[0]].fields && db.interfaces[p[0]].fields[p[1]];
            if (!f || !f.getter) throw new Error('Missing getter: ' + p.join('.'));
        });
        return 'Required read-only fields are in this firmware catalog';
    });
    return results;
}
function selectBundle(folder) {
    const release = JSON.parse(fs.readFileSync(path.join(folder, 'release.json'), 'utf8'));
    if (release.app_id !== 'cluster_redline' || !/^cluster_redline@\d+\.\d+\.\d+-ko\.\d+\.mgu$/.test(release.bundle || '')) {
        throw new Error('Invalid release.json bundle identity');
    }
    const file = path.resolve(folder, release.bundle);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (hash !== release.sha256) throw new Error('Install bundle checksum mismatch');
    return file;
}
if (require.main === module) {
    try {
        if (process.argv[2] === '--package' && process.argv[3]) console.log(selectBundle(process.argv[3]));
        else {
            const result = check(); console.log(JSON.stringify(result, null, 2));
            process.exitCode = result.every((r) => r.ok) ? 0 : 1;
        }
    } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { check, versionAtLeast, selectBundle };
