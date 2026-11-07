'use strict';
// Exercise the upstream Store's actual dependency/queue methods without starting
// its daemon, connecting to a vehicle, or installing any program.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const upstream = process.env.MGU_STORE_UPDATER_JS;
if (!upstream) throw new Error('Set MGU_STORE_UPDATER_JS to native/mgu-updater/js in an upstream mgu-store checkout');
const catalogLib = require(path.join(upstream, 'catalog'));
const sources = require(path.join(upstream, 'sources'));
const updaterFile = path.join(upstream, 'updater.js');
const source = fs.readFileSync(updaterFile, 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('class Updater {');
if (start < 0) throw new Error('Upstream Updater class was not found');
const updater = source.slice(start);
const names = ['installedVersion', 'requirementMet', 'findRequirement', 'installPlan', 'incompatible', 'request', 'conflict', 'enqueue'];
const methods = names.map((name) => {
    const found = updater.match(new RegExp('^    ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?^    \\}', 'm'));
    if (!found) throw new Error('Upstream method layout changed: ' + name);
    return found[0];
});
// Use verbatim method bodies; no constructor or daemon top-level code runs.
const actual = vm.runInNewContext('({\n' + methods.join(',\n') + '\n})', { catalogLib });
const root = path.resolve(__dirname, '..');
const ids = ['cluster_redline', 'cluster_redline_en'];

function fixture(apps, options) {
    const o = options || {}, listed = new Map(), installed = Object.assign({ 'mgu-deploy': '0.7.17' }, o.installed);
    const rows = apps.map((entry) => ({ entry, source: 'jam' }));
    if (o.renderer !== false) rows.push({ source: 'robertn', entry: {
        id: 'cluster-render', kind: 'tool', title: 'Cluster renderer',
        version: o.offeredVersion || '0.4.0', mguHmi: o.rendererHmi || ['ID7', 'ID8'],
        requires: { 'mgu-deploy': '0.4.0' },
    } });
    rows.push({ source: 'builtin', entry: { id: 'mgu-deploy', kind: 'tool', title: 'Deploy', version: '0.7.17', requires: {}, mguHmi: ['ID7'] } });
    rows.forEach((r) => listed.set(r.entry.id, r));
    const runner = Object.assign(Object.create(actual), {
        installedOf: (id) => installed[id] ? { id, version: installed[id] } : null,
        resolved: () => listed,
        defs: () => ['jam', 'robertn', 'builtin'].map((id) => ({ id })),
        src: new Map(['jam', 'robertn', 'builtin'].map((id) => [id, {}])),
        providerIds: () => [], unit: { hmi: 'ID7' },
        queue: [], errors: {}, busy: null, rebooting: false,
        changed() {}, putAside() {}, next() {},
    });
    return runner;
}

(async () => {
    const parsed = await sources.repoCatalog((name) => Promise.resolve(fs.readFileSync(path.join(root, name))), null, 'local');
    assert.deepStrictEqual(parsed.skipped, []);
    const apps = ids.map((id) => parsed.components.find((c) => c.id === id));
    apps.forEach((app) => {
        assert(app); assert.strictEqual(app.requires['cluster-render'], '0.4.0');
        assert.strictEqual(app.requires['mgu-deploy'], '0.7.17');
    });
    for (const id of ids) {
        const fresh = fixture(apps); assert.strictEqual(fresh.request(id), null);
        assert.deepStrictEqual(fresh.queue.map((q) => q.id), ['cluster-render', id], 'renderer must be queued before ' + id);
        assert.strictEqual(fresh.queue[0].source, 'robertn', 'renderer is resolved from its registered upstream source');
        const older = fixture(apps, { installed: { 'cluster-render': '0.3.9' } }); older.request(id);
        assert.deepStrictEqual(older.queue.map((q) => q.id), ['cluster-render', id]);
        for (const version of ['0.4.0', '0.4.1']) {
            const ready = fixture(apps, { installed: { 'cluster-render': version } }); ready.request(id);
            assert.deepStrictEqual(ready.queue.map((q) => q.id), [id], 'reuse compatible renderer ' + version);
        }
        const missing = fixture(apps, { renderer: false }); missing.request(id);
        assert.deepStrictEqual(missing.queue, [], 'missing renderer source must stop the complete install plan');
        assert(/needs cluster-render/.test(missing.errors[id]));
        const incompatible = fixture(apps, { rendererHmi: ['ID8'] }); incompatible.request(id);
        assert.deepStrictEqual(incompatible.queue, []); assert(/iDrive 8/.test(incompatible.errors[id]));
        const insufficient = fixture(apps, { offeredVersion: '0.3.9' }); insufficient.request(id);
        assert.deepStrictEqual(insufficient.queue, []); assert(/needs cluster-render/.test(insufficient.errors[id]));
        const deploy = fixture(apps, { installed: { 'mgu-deploy': '0.7.16' } }); deploy.request(id);
        assert.deepStrictEqual(deploy.queue.map((q) => q.id), ['mgu-deploy', 'cluster-render', id]);
    }
    const shared = fixture(apps); ids.forEach((id) => shared.request(id));
    assert.deepStrictEqual(shared.queue.map((q) => q.id), ['cluster-render'].concat(ids), 'queue one shared renderer for both editions');
    console.log('PASS: actual Store parser and queue: renderer-first, old-version upgrade, compatible reuse, shared renderer, deploy-first and blocked missing/incompatible sources');
})().catch((e) => { console.error(e); process.exitCode = 1; });
