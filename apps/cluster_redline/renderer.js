'use strict';
// Shared read-only discovery; explicit CLI actions manage only compositor config.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MINIMUM = '0.3.10';
function atLeast(value, minimum) {
    if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) return false;
    const have = value.split('.').map(Number), want = minimum.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (have[i] !== want[i]) return have[i] > want[i];
    return true;
}
function inspect(root, io) {
    root = root || '/'; io = io || fs;
    const base = path.join(root, 'var/opt/cluster-render');
    const result = { minimum: MINIMUM, version: null, compatible: false, metadata: null,
        localConfig: path.join(base, 'cluster-render.local.conf'), takeOverStock: true, hudTakeOverStock: false, reason: '' };
    const candidates = [path.join(base, 'current/component.json'), path.join(base, 'component.json')];
    for (const file of candidates) {
        let source;
        try { source = io.readFileSync(file, 'utf8'); }
        catch (e) { if (e.code === 'ENOENT') continue; result.reason = 'Cannot read ' + file + ': ' + e.message; return result; }
        try {
            const component = JSON.parse(source);
            result.metadata = file; result.version = component.version || null;
            result.compatible = component.id === 'cluster-render' && atLeast(component.version, MINIMUM);
            result.reason = result.compatible ? 'compatible' : 'cluster-render >= ' + MINIMUM + ' required; found ' + String(component.version);
        } catch (e) { result.reason = 'Invalid metadata at ' + file; }
        break; // Never hide an old/broken active installation behind a newer stale fallback.
    }
    if (!result.metadata && !result.reason) result.reason = 'cluster-render metadata missing: checked ' + candidates.join(', ');
    const configs = result.metadata ? [path.join(path.dirname(result.metadata), 'cluster-render.conf'), result.localConfig] : [];
    configs.forEach((file) => {
        try {
            io.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
                const m = line.match(/^\s*(map|hud)_take_over_stock\s*=\s*([^#;\s]+)/);
                if (m) result[m[1] === 'hud' ? 'hudTakeOverStock' : 'takeOverStock'] = m[2] === '1' ? true : m[2] === '0' ? false : null;
            });
        } catch (e) {} // Keep each target's documented default when no readable override exists.
    });
    return result;
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function configure(action, root) {
    const info = inspect(root), file = info.localConfig, backup = path.join(path.dirname(file), 'cluster-redline-map.backup.json');
    if (action === 'check') return info;
    if (action === 'enable') {
        if (!info.compatible) throw new Error(info.reason + '. Update cluster-render; current upstream release is 0.4.0.');
        if (info.takeOverStock === true) return Object.assign(info, { changed: false });
        if (fs.existsSync(backup)) throw new Error('A map backup already exists; check it before changing the configuration again: ' + backup);
        let original = '', existed = true;
        try { original = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; existed = false; }
        const managed = original + '\n# Cluster Redline: allow visible contending layers to take the stock map slot.\nmap_take_over_stock = 1\n';
        fs.writeFileSync(backup, JSON.stringify({ existed, original, managedHash: hash(managed) }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        fs.writeFileSync(file + '.tmp', managed, { mode: 0o644 }); fs.renameSync(file + '.tmp', file);
        return Object.assign(inspect(root), { changed: true, backup });
    }
    if (action === 'restore') {
        const saved = JSON.parse(fs.readFileSync(backup, 'utf8'));
        if (hash(fs.readFileSync(file, 'utf8')) !== saved.managedHash) throw new Error('Local configuration changed after setup; refusing to overwrite owner edits. Backup: ' + backup);
        if (saved.existed) { fs.writeFileSync(file + '.tmp', saved.original, { mode: 0o644 }); fs.renameSync(file + '.tmp', file); }
        else fs.unlinkSync(file);
        fs.unlinkSync(backup);
        return Object.assign(inspect(root), { changed: true, restored: true });
    }
    throw new Error('Unknown action');
}
function cli(args) {
    const commands = { '--check': 'check', '--enable-map': 'enable', '--restore-map': 'restore' };
    const action = commands[args[0] || '--check'];
    if (!action) throw new Error('Usage: node cluster-redline-renderer.js [--check|--enable-map|--restore-map]');
    if (action !== 'check' && (!process.getuid || process.getuid() !== 0)) throw new Error('Configuration changes must run as root');
    const result = configure(action);
    if (result.changed) {
        try { require('child_process').execFileSync('systemctl', ['try-restart', 'cluster-render.service'], { stdio: 'inherit' }); }
        catch (e) { result.restartRequired = 'systemctl restart cluster-render.service'; }
    }
    console.log(JSON.stringify(result, null, 2));
    if (action === 'check' && !result.compatible) process.exitCode = 1;
}
if (require.main === module) { try { cli(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; } }
module.exports = { MINIMUM, atLeast, inspect, configure, cli };
