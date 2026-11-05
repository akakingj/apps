'use strict';
// Live-only background work in the same OAP process as the settings UI.
// MainApp owns its autostart/restart lifecycle; no root service is installed.
const fs = require('fs');
const path = require('path');
const { ClusterRender } = require('./cluster_render_client');
const { Controller } = require('./controller');
const painter = require('./draw');
const { settings, DEFAULTS } = require('./policy');
const CDS = 'de.bmw.infotainment.vehicle.CDS';
const FES = 'de.bmw.infotainment.drivingexcitement.FES';
const MODE_FIELD = 'statusFESVehicleDynamicSwitchHMI';
function mono() { const p = process.hrtime(); return p[0] * 1000 + p[1] / 1000000; }
function atomic(file, value) {
    const temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value) + '\n', { mode: 0o644 });
    fs.renameSync(temp, file);
}
function supportedRenderer(file) {
    try {
        const c = JSON.parse(fs.readFileSync(file || '/var/opt/cluster-render/current/component.json', 'utf8'));
        const v = String(c.version || '').split('.').map(Number);
        return c.id === 'cluster-render' && v.length === 3 && v.every((n) => isFinite(n) && n >= 0)
            && (v[0] > 0 || v[1] > 3 || (v[1] === 3 && v[2] >= 10));
    } catch (e) { return false; }
}
function start(ctx) {
    const log = ctx.log, signals = ctx.signals;
    const client = new ClusterRender('cluster-redline'), controller = new Controller(client, painter);
    let config = settings(), lastStatus = -Infinity, stopped = false, timer;
    const subs = [], errors = [];
    const reportError = (name, e) => { const s = name + ': ' + e; if (errors.indexOf(s) < 0) { errors.push(s); log.warn(s); } };
    const live = signals && typeof signals.hasNative === 'function' && signals.hasNative();
    if (!live) reportError('someip', 'live native binding unavailable; cluster output disabled');
    const rendererOkay = live && supportedRenderer();
    if (live && !rendererOkay) reportError('cluster-render', '0.3.10 or newer required; cannot verify installed component');
    client.on('ready', () => {
        // ID7 map geometry only: never fall back to panel, HUD, or another slot.
        if (client.backend !== 'id7' || String(client.targets).split(',').indexOf('map:1088x480') < 0 || !supportedRenderer()) {
            controller.hide(); controller.refused = true;
            reportError('cluster-render', 'unsupported backend, map geometry or version; display disabled');
        }
    });
    if (rendererOkay) client.connect();
    if (live) {
        // Re-read getters even while values do not change. No set/call methods are used.
        signals.watch(CDS, '1', {
            statusEngineSpeed2: (v) => {
                const raw = v && v.actualValueRPMEngineCrankshaft;
                controller.policy.rpmSample(typeof raw === 'number' && raw >= 0 && raw < 65535 ? raw * 0.25 : null, mono());
            },
        }, log, { pollMs: 1000 }).then((s) => { subs.push(s); if (s.error) reportError(CDS, s.error); }).catch((e) => reportError(CDS, e));
        const handlers = {};
        handlers[MODE_FIELD] = (v) => controller.policy.modeSample(v && v.actualValueModeDrivingExperience, mono());
        signals.watch(FES, '1', handlers, log, { pollMs: 1000 }).then((s) => { subs.push(s); if (s.error) reportError(FES, s.error); }).catch((e) => reportError(FES, e));
    }
    function stop() {
        if (stopped) return;
        stopped = true; clearTimeout(timer); controller.close();
        subs.forEach((s) => { try { s.shutdown(); } catch (e) {} });
        try { atomic(path.join(ctx.dataDir, 'cluster-redline-status.json'), { at: new Date().toISOString(), reason: 'stopped', requested: false, layerState: 'hidden' }); } catch (e) {}
    }
    function tick() {
        const at = mono();
        try {
            const raw = {};
            Object.keys(DEFAULTS).forEach((k) => { raw[k] = ctx.settings.get(k); });
            config = settings(raw);
            const state = controller.tick(at, config);
            if (at - lastStatus >= 500) {
                lastStatus = at;
                atomic(path.join(ctx.dataDir, 'cluster-redline-status.json'), {
                    at: new Date().toISOString(), requested: !!state.requested, layerState: state.layerState || 'hidden',
                    reason: state.reason, mode: state.mode, rpm: state.rpm, shift: state.shift,
                    profile: config.engineProfile, config: config,
                    errors: errors.slice(-8), source: live ? 'live-someip' : 'offline-disabled',
                });
            }
        } catch (e) { controller.hide(); reportError('worker', e.message || e); }
        if (!stopped) timer = setTimeout(tick, Math.max(15, 1000 / config.frameRate - (mono() - at)));
    }
    if (ctx.app && ctx.app.once) ctx.app.once('shutdown', stop);
    process.once('exit', stop);
    tick();
    return { controller: controller, stop: stop };
}
module.exports = { start, supportedRenderer, CDS, FES, MODE_FIELD };
