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
function checkPackage(file, id, version, start, language) {
    const names = entries(file);
    assert(!names.some((n) => /(^|\/)node_modules\//.test(n) || /(^|\/)oap-sdk\//.test(n)), 'published/build output must contain no SDK');
    const p = json(file, 'package.json');
    assert.strictEqual(p.name, id); assert.strictEqual(p.version, version);
    assert.deepStrictEqual(p.mguHmi, ['ID7']); assert.strictEqual(p.mguLocalOnly, true);
    assert.strictEqual(p.mguAppStartType || 'manually', start);
    assert.strictEqual(json(file, 'javascript/kit/locale.json').language, language);
    const title = json(file, 'rhmiData/variantGroups/Common/texts/en_GB.json')['SID_' + id.toUpperCase() + '_TITLE'];
    assert.strictEqual(/[가-힣]/.test(title), language === 'ko', 'RHMI title must use the chosen language');
    const spec = json(file, 'javascript/kit/app-spec.json');
    assert.strictEqual(spec.id, id);
    if (id.indexOf('cluster_redline') === 0) {
        assert.strictEqual(spec.settings.find((s) => s.key === 'displayTarget').default, 'panel');
        assert.strictEqual(spec.settings.find((s) => s.key === 'widgetScale').default, 75);
        assert.strictEqual(spec.settings.find((s) => s.key === 'gearPrefix').default, 'auto');
        assert.deepStrictEqual(spec.settings.find((s) => s.key === 'frameRate').steps.slice(-3), [12, 30, 60]);
    }
    const app = json(file, 'rhmiData/application.json').application;
    assert.strictEqual(app.name, id); assert.strictEqual(app.version, version);
    const icon = 'package/rhmiData/variantGroups/Common/images/' + app.entryPoints[0].icon;
    assert(names.includes(icon), 'RHMI icon reference must exist after id aliasing');
    return app.uuid;
}
function optionsFor(args) {
    const result = {};
    for (let i = 0; i < args.length; i += 2) result[args[i].slice(2)] = args[i + 1];
    return result;
}
(async () => {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'mgu-repo.json')));
    let sourceParser;
    if (process.env.MGU_STORE_UPDATER_JS) {
        sourceParser = require(path.join(process.env.MGU_STORE_UPDATER_JS, 'sources'));
        const catalog = await sourceParser.repoCatalog((name) => Promise.resolve(fs.readFileSync(path.join(ROOT, name))), null, 'local');
        assert.deepStrictEqual(catalog.skipped, []);
        assert.deepStrictEqual(catalog.components.map((c) => c.id).sort(), ['cluster_redline', 'cluster_redline_en', 'idrive_circuit', 'idrive_circuit_en']);
        assert(catalog.components.every((c) => c.script.node === 'tools/store-build.js' && !c.script.network));
        assert.strictEqual(catalog.components.find((c) => c.id === 'cluster_redline').requires['cluster-render'], '0.3.10');
    }
    const identities = new Set();
    for (const component of doc.components) {
        const id = component.id, spec = JSON.parse(fs.readFileSync(path.join(ROOT, component.path, 'app.json')));
        const args = component.build.args.map((a) => a.replace('{id}', id).replace('{version}', spec.version).replace('{dir}', component.path));
        const options = Object.assign(optionsFor(args), { out: path.join(temp, id) });
        const source = options.source || component.path;
        const file = build(options), start = options.template === 'cluster_redline' ? 'autostart' : 'manually';
        const originalUuid = checkPackage(file, id, spec.version, start, options.language);
        assert(!identities.has(originalUuid), 'language variants need separate RHMI identities'); identities.add(originalUuid);
        assert(read(file, 'package/javascript/app.js').equals(fs.readFileSync(path.join(ROOT, source, 'main.js'))));
        const runtime = options.template + (options.language === 'en' ? '.en' : '');
        const runtimeNames = entries(path.join(ROOT, 'store/runtime', runtime + '.tgz'));
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
        const aliasOptions = Object.assign({}, options, { id: alias, dir: path.relative(ROOT, dir), out: path.join(temp, alias) });
        let sourceDir = dir;
        if (options.source) {
            sourceDir = path.join(sourceCopy, id + '-shared-source'); copy(path.join(ROOT, source), sourceDir);
            aliasOptions.source = path.relative(ROOT, sourceDir);
        }
        fs.appendFileSync(path.join(sourceDir, 'main.js'), '\n// latest source supplied by the repository\n');
        const aliasFile = build(aliasOptions);
        const aliasUuid = checkPackage(aliasFile, alias, spec.version, start, options.language);
        assert.notStrictEqual(aliasUuid, originalUuid, 'aliased apps need distinct RHMI identities');
        assert(read(aliasFile, 'package/javascript/app.js').includes(Buffer.from('latest source supplied by the repository')));
        const aliasStrings = json(aliasFile, 'rhmiData/variantGroups/Common/texts/en_GB.json');
        assert(aliasStrings['SID_' + alias.toUpperCase() + '_TITLE']);
        // UI changes must never be installed with a stale generated screen or permission table.
        const sourceSpec = JSON.parse(fs.readFileSync(path.join(sourceDir, 'app.json')));
        sourceSpec.settings[0].label = 'Changed screen';
        fs.writeFileSync(path.join(sourceDir, 'app.json'), JSON.stringify(sourceSpec));
        assert.throws(() => build(Object.assign({}, aliasOptions, { out: path.join(temp, alias + '-bad') })), /stale/);
        if (sourceParser) {
            const catalog = await sourceParser.repoCatalog((name) => Promise.resolve(fs.readFileSync(path.join(ROOT, name))), null, 'local');
            const entry = catalog.components.find((c) => c.id === id);
            assert(sourceParser.renameable(entry), 'every language variant must support Store collision ids');
            const named = Object.assign({}, entry, { path: path.relative(ROOT, path.join(sourceCopy, id)), manifest: path.relative(ROOT, path.join(sourceCopy, id, 'app.json')) });
            const files = [{ name: named.manifest, data: Buffer.from(JSON.stringify(spec)), mode: 0o644 }];
            const renamed = sourceParser.renameApp(named, files, id + '3');
            const target = path.join(ROOT, renamed.entry.path); copy(path.join(ROOT, component.path), target);
            fs.writeFileSync(path.join(target, 'app.json'), renamed.files[1].data);
            const actualOptions = Object.assign(optionsFor(renamed.entry.script.args), { out: path.join(temp, id + '3') });
            const renamedFile = build(actualOptions);
            checkPackage(renamedFile, id + '3', spec.version, start, options.language);
        }
    }
    console.log('PASS: four English/Korean Store listings and SDK-free builds, current shared source, distinct language identities, real Store collision-id builds, autostart and stale-UI rejection');
})().catch((e) => { console.error(e); process.exitCode = 1; }).then(() => {
    fs.rmSync(temp, { recursive: true, force: true }); fs.rmSync(sourceCopy, { recursive: true, force: true });
});
