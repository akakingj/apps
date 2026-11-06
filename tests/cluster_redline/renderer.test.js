'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { inspect, configure, atLeast } = require('../../apps/cluster_redline/renderer');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cluster-render-info-'));
const base = path.join(root, 'var/opt/cluster-render'), active = path.join(base, 'current/component.json');
function put(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); }
try {
    assert(!inspect(root).compatible);
    assert(!atLeast('0.3.1', '0.3.10')); assert(atLeast('0.3.10', '0.3.10')); assert(atLeast('0.4.0', '0.3.10'));
    put(path.join(base, 'component.json'), { id: 'cluster-render', version: '0.4.0' });
    assert(inspect(root).compatible); // alternate deployed layout
    put(active, { id: 'cluster-render', version: '0.3.1' });
    assert(!inspect(root).compatible, 'a stale newer fallback cannot hide an old active installation');
    assert(inspect(root).reason.includes('0.3.1'));
    put(active, '{broken'); assert(!inspect(root).compatible);
    put(active, { id: 'cluster-render', version: '0.4.0' });
    put(path.join(base, 'current/cluster-render.conf'), 'map_take_over_stock = 1\nhud_take_over_stock = 0\n');
    const file = path.join(base, 'cluster-render.local.conf');
    const original = '# owner settings\nmap_take_over_stock = 0\nmap_linger_ms = 0\n';
    put(file, original);
    assert.strictEqual(configure('check', root).takeOverStock, false);
    assert.strictEqual(configure('check', root).hudTakeOverStock, false);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), original, 'default check must not write');
    assert.strictEqual(configure('enable', root).takeOverStock, true);
    assert(fs.readFileSync(file, 'utf8').includes('map_linger_ms = 0'));
    assert.strictEqual(configure('enable', root).changed, false);
    configure('restore', root); assert.strictEqual(fs.readFileSync(file, 'utf8'), original);
    put(file, original + 'hud_take_over_stock = 1\n');
    assert.strictEqual(inspect(root).hudTakeOverStock, true, 'report the owner HUD override separately from map takeover');
    put(file, original + 'hud_take_over_stock = invalid\n');
    assert.strictEqual(inspect(root).hudTakeOverStock, null, 'invalid HUD policy must not be reported as enabled');
    put(file, original);
    configure('enable', root); fs.appendFileSync(file, '# a later owner edit\n');
    assert.throws(() => configure('restore', root), /owner edits/);
    assert(fs.readFileSync(file, 'utf8').includes('a later owner edit'));
    put(active, { id: 'cluster-render', version: '0.3.1' });
    assert.throws(() => configure('enable', root), /Update cluster-render/);
    console.log('PASS: renderer version/path diagnostics, no stale metadata fallback, read-only check, explicit reversible map takeover and owner-edit protection');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
