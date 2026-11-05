'use strict';
// Run the real installer metadata validator with in-memory component metadata.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const project = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const shell = fs.readFileSync(path.join(project, 'deploy/mgu-app-install.sh'), 'utf8');
const source = shell.split("<<'JAM_METADATA'\n")[1].split('\nJAM_METADATA')[0];
function validate(pkg, component) {
    let output = '', failed = false;
    const box = { require(name) {
        assert.strictEqual(name, 'fs');
        return { readFileSync(file) {
            if (file === '/package.json') return JSON.stringify(pkg);
            assert.strictEqual(file, '/var/opt/cluster-render/current/component.json');
            if (!component) throw new Error('Missing component');
            return JSON.stringify(component);
        } };
    }, console: { error() {} }, process: { argv: ['node', '-', '/package.json'], stdout: { write(s) { output += s; } }, exit(code) { failed = code !== 0; } } };
    vm.runInNewContext(source, box);
    return { output, failed };
}
assert.deepStrictEqual(validate({}), { output: 'manually', failed: false });
assert.deepStrictEqual(validate({ mguAppStartType: 'autostart' }), { output: 'autostart', failed: false });
assert(validate({ mguAppStartType: 'unexpected' }).failed);
const pkg = { mguAppStartType: 'autostart', mguClusterRenderMinVersion: '0.3.10' };
assert(validate(pkg).failed);
assert(validate(pkg, { id: 'cluster-render', version: '0.3.9' }).failed);
assert(validate(pkg, { id: 'wrong-component', version: '1.0.0' }).failed);
assert(!validate(pkg, { id: 'cluster-render', version: '0.3.10' }).failed);
assert(!validate(pkg, { id: 'cluster-render', version: '0.4.0' }).failed);
assert(validate({ mguClusterRenderMinVersion: '../invalid' }).failed);
console.log('PASS: standard installer metadata rejects bad start types and missing/old/wrong renderer requirements; normal apps remain manual');
