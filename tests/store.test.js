'use strict';
// Host-only integration: actual repo-tree parser when MGU_STORE_UPDATER_JS is set.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const { build } = require('../tools/store-build');
const ROOT = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jam-store-test-'));
const sourceCopy = fs.mkdtempSync(path.join(ROOT, '.store-test-'));
function entries(archive) { return cp.execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n'); }
function read(archive, name) { return cp.execFileSync('tar', ['-xOzf', archive, name]); }
function json(archive, name) { return JSON.parse(read(archive, 'package/' + name)); }
function copy(from, to) { fs.mkdirSync(to, { recursive: true }); fs.readdirSync(from).forEach((n) => { const a = path.join(from, n), b = path.join(to, n); if (fs.statSync(a).isDirectory()) copy(a, b); else fs.copyFileSync(a, b); }); }
function checkPackage(file, id, version, start) {
    const names = entries(file);
    assert(!names.some((n) => /(^|\/)node_modules\//.test(n) || /(^|\/)oap-sdk\//.test(n)), 'published/build output must contain no SDK');
    const p = json(file, 'package.json');
    assert.strictEqual(p.name, id); assert.strictEqual(p.version, version);
    assert.deepStrictEqual(p.mguHmi, ['ID7']); assert.strictEqual(p.mguLocalOnly, true);
    assert.strictEqual(p.mguAppStartType || 'manually', start);
    assert.strictEqual(json(file, 'javascript/kit/locale.json').language, 'ko');
    assert.strictEqual(json(file, 'javascript/kit/app-spec.json').id, id);
    const app = json(file, 'rhmiData/application.json').application;
    assert.strictEqual(app.name, id); assert.strictEqual(app.version, version);
    const icon = 'package/rhmiData/variantGroups/Common/images/' + app.entryPoints[0].icon;
    assert(names.includes(icon), 'RHMI icon reference must exist after id aliasing');
    return app.uuid;
}
(async () => {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'mgu-repo.json')));
    let sourceParser;
    if (process.env.MGU_STORE_UPDATER_JS) {
        sourceParser = require(path.join(process.env.MGU_STORE_UPDATER_JS, 'sources'));
        const catalog = await sourceParser.repoCatalog((name) => Promise.resolve(fs.readFileSync(path.join(ROOT, name))), null, 'local');
        assert.deepStrictEqual(catalog.skipped, []);
        assert.deepStrictEqual(catalog.components.map((c) => c.id).sort(), ['cluster_redline', 'idrive_circuit']);
        assert(catalog.components.every((c) => c.script.node === 'tools/store-build.js' && !c.script.network));
        assert.strictEqual(catalog.components.find((c) => c.id === 'cluster_redline').requires['cluster-render'], '0.3.10');
    }
    for (const component of doc.components) {
        const id = component.id, spec = JSON.parse(fs.readFileSync(path.join(ROOT, component.path, 'app.json')));
        const options = { template: id, id, version: spec.version, dir: component.path, out: path.join(temp, id) };
        const file = build(options), start = id === 'cluster_redline' ? 'autostart' : 'manually';
        const originalUuid = checkPackage(file, id, spec.version, start);
        assert(read(file, 'package/javascript/app.js').equals(fs.readFileSync(path.join(ROOT, component.path, 'main.js'))));
        const runtimeNames = entries(path.join(ROOT, 'store/runtime', id + '.tgz'));
        assert(!runtimeNames.includes('package/javascript/app.js'), 'template must not freeze the app source');
        if (sourceParser) {
            const tar = require(path.join(process.env.MGU_STORE_UPDATER_JS, 'tar'));
            const members = await tar.untgz(fs.readFileSync(file), 30 << 20);
            const entry = sourceParser.packageEntry(members, fs.readFileSync(file), {}, 'tgz');
            assert.strictEqual(entry.id, id); assert.strictEqual(entry.version, spec.version);
            assert.deepStrictEqual(entry.mguHmi, ['ID7']);
        }
        const alias = id + '2', dir = path.join(sourceCopy, alias);
        copy(path.join(ROOT, component.path), dir);
        const modified = Object.assign({}, spec, { id: alias });
        fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify(modified));
        fs.appendFileSync(path.join(dir, 'main.js'), '\n// latest source supplied by the repository\n');
        const aliasFile = build({ template: id, id: alias, version: spec.version, dir: path.relative(ROOT, dir), out: path.join(temp, alias) });
        const aliasUuid = checkPackage(aliasFile, alias, spec.version, start);
        assert.notStrictEqual(aliasUuid, originalUuid, 'aliased apps need distinct RHMI identities');
        assert(read(aliasFile, 'package/javascript/app.js').includes(Buffer.from('latest source supplied by the repository')));
        const aliasStrings = json(aliasFile, 'rhmiData/variantGroups/Common/texts/en_GB.json');
        assert(aliasStrings['SID_' + alias.toUpperCase() + '_TITLE']);
        // UI changes must never be installed with a stale generated screen or permission table.
        modified.settings[0].label = 'Changed screen';
        fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify(modified));
        assert.throws(() => build({ template: id, id: alias, version: spec.version, dir: path.relative(ROOT, dir), out: path.join(temp, alias + '-bad') }), /stale/);
    }
    console.log('PASS: Store repo listing, two Korean SDK-free builds, real source refresh, numeric versions, start types, collision-id UUID/icon rewrites and stale-UI rejection');
})().catch((e) => { console.error(e); process.exitCode = 1; }).then(() => {
    fs.rmSync(temp, { recursive: true, force: true }); fs.rmSync(sourceCopy, { recursive: true, force: true });
});
