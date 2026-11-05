'use strict';
// Run on the MGU as root or a user that can read the deployment metadata.
// This command reads files only; it never changes coding or starts an app.
const fs = require('fs');
const path = require('path');
const renderer = require('../apps/cluster_redline/renderer');
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
        const info = renderer.inspect(root);
        if (!info.compatible) throw new Error(info.reason);
        return info.version + ' (' + info.metadata + ')';
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
if (require.main === module) {
    try {
        const result = check(); console.log(JSON.stringify(result, null, 2));
        process.exitCode = result.every((r) => r.ok) ? 0 : 1;
    } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { check, versionAtLeast };
