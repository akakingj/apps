'use strict';
// Live-only background work in the same OAP process as the settings UI.
// MainApp owns its autostart/restart lifecycle; no root service is installed.
const fs = require('fs');
const path = require('path');
const { ClusterRender } = require('./cluster_render_client');
const { Controller } = require('./controller');
const painter = require('./draw');
const { settings, DEFAULTS } = require('./policy');
const renderer = require('./renderer');
const gear = require('./gear');
const CDS = 'de.bmw.infotainment.vehicle.CDS';
const FES = 'de.bmw.infotainment.drivingexcitement.FES';
const MODE_FIELD = 'statusFESVehicleDynamicSwitchHMI';
const VEHICLE_INFO = 'de.bmw.infrastructure.VehicleInformation';
const MDRIVE = 'de.bmw.infotainment.misc.MDrive';
function mono() { const p = process.hrtime(); return p[0] * 1000 + p[1] / 1000000; }
function atomic(file, value) {
    const temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value) + '\n', { mode: 0o644 });
    fs.renameSync(temp, file);
}
function supportedRenderer() { return renderer.inspect(undefined, fs).compatible; }
function start(ctx) {
    const log = ctx.log, signals = ctx.signals;
    const client = new ClusterRender('cluster-redline'), controller = new Controller(client, painter);
    const gearbox = new gear.GearState();
    let config = settings(), lastStatus = -Infinity, stopped = false, timer;
    let rendererInfo = renderer.inspect(undefined, fs), lastRendererCheck = -Infinity, connectionStarted = false, gearSub, fesSub, programSub;
    const subs = [], errors = [];
    function keep(s) { if (stopped) s.shutdown(); else subs.push(s); }
    const reportError = (name, e) => { const s = name + ': ' + e; if (errors.indexOf(s) < 0) { errors.push(s); log.warn(s); } };
    const live = signals && typeof signals.hasNative === 'function' && signals.hasNative();
    if (!live) reportError('someip', 'live native binding unavailable; cluster output disabled');
    client.on('ready', () => {
        // Controller validates the selected target's exact ID7 geometry. It
        // never falls back to another target when the selected one is missing.
        if (client.backend !== 'id7' || !supportedRenderer()) {
            controller.hide(); controller.refused = true;
            reportError('cluster-render', 'unsupported backend or version; display disabled');
        }
    });
    if (live) {
        // Re-read getters even while values do not change. No set/call methods are used.
        signals.watch(CDS, '1', {
            statusEngineSpeed2: (v) => {
                const raw = v && v.actualValueRPMEngineCrankshaft;
                controller.policy.rpmSample(typeof raw === 'number' && raw >= 0 && raw < 65535 ? raw * 0.25 : null, mono());
            },
        }, log, { pollMs: 1000 }).then((s) => { keep(s); if (s.error) reportError(CDS, s.error); }).catch((e) => reportError(CDS, e));
        const handlers = {};
        handlers[MODE_FIELD] = (v) => controller.policy.modeSample(v && v.actualValueModeDrivingExperience, mono());
        handlers.statusActualValueTorque2 = (v) => controller.telemetry.sample(v && v.actualValueTorqueCrankshaft, mono());
        signals.watch(FES, '1', handlers, log, { pollMs: 1000 }).then((s) => { fesSub = s; keep(s); if (s.error) reportError(FES, s.error); }).catch((e) => reportError(FES, e));
        signals.watch(VEHICLE_INFO, '1', {
            statusGearboxDrive: (v) => gearbox.sample('gearbox', v),
            DataPowerTrain2: (v) => gearbox.sample('selection', v),
        }, log, { pollMs: 1000 }).then((s) => {
            gearSub = s; keep(s);
            if (s.error) { controller.gear = '--'; reportError('optional gear', s.error); }
        }).catch((e) => { controller.gear = '--'; reportError('optional gear', e); });
        // Some cars publish S/M only through MDrive. The Store build omits
        // this optional proxy when the car's catalog lacks the field.
        let hasProgram = false;
        try { const cfg = signals.loadConfig(MDRIVE); hasProgram = !!(cfg.fields && cfg.fields.dataDisplayGearbox); } catch (e) {}
        if (hasProgram) signals.watch(MDRIVE, '1', {
            dataDisplayGearbox: (v) => gearbox.sample('programme', v),
        }, log, { pollMs: 1000 }).then((s) => { programSub = s; keep(s); if (s.error) reportError('optional gearbox programme', s.error); }).catch((e) => reportError('optional gearbox programme', e));
    }
    function stop() {
        if (stopped) return;
        stopped = true; clearTimeout(timer); controller.close();
        process.removeListener('exit', stop);
        if (ctx.app && ctx.app.removeListener) ctx.app.removeListener('shutdown', stop);
        subs.forEach((s) => { try { s.shutdown(); } catch (e) {} });
        try { atomic(path.join(ctx.dataDir, 'cluster-redline-status.json'), { at: new Date().toISOString(), reason: 'stopped', requested: false, layerState: 'hidden' }); } catch (e) {}
    }
    function tick() {
        const at = mono();
        try {
            if (live && at - lastRendererCheck >= 1000) {
                lastRendererCheck = at; rendererInfo = renderer.inspect(undefined, fs);
                if (rendererInfo.compatible && !connectionStarted) { connectionStarted = true; client.connect(); }
                else if (!rendererInfo.compatible) {
                    reportError('cluster-render', rendererInfo.reason);
                    if (connectionStarted) { controller.hide(); controller.policy.reset(); client.close(); connectionStarted = false; }
                }
            }
            // Gear fields may notify only on changes. Keep a known gear while its
            // provider remains available, and clear it on provider loss/error.
            if (gearSub && (gearSub.available === false || gearSub.error)) gearbox.clear();
            if (programSub && (programSub.available === false || programSub.error)) gearbox.programMode = null;
            controller.gear = gearbox.gear; controller.gearMode = gearbox.programMode || gearbox.mode;
            if (fesSub && (fesSub.available === false || fesSub.error)) controller.telemetry.clear();
            const raw = {};
            Object.keys(DEFAULTS).forEach((k) => { raw[k] = ctx.settings.get(k); });
            config = settings(raw);
            const state = controller.tick(at, config);
            if (at - lastStatus >= 500) {
                lastStatus = at;
                atomic(path.join(ctx.dataDir, 'cluster-redline-status.json'), {
                    at: new Date().toISOString(), requested: !!state.requested, layerState: state.layerState || 'hidden',
                    reason: state.reason, mode: state.mode, rpm: state.rpm, shift: state.shift,
                    gear: state.gear, torqueNm: state.torqueNm, powerPS: state.powerPS, powerEstimated: true,
                    targetName: state.targetName, targetState: state.targetState, targetHolder: state.targetHolder, targetReason: state.targetReason,
                    renderer: rendererInfo, requestedSettings: raw,
                    profile: config.engineProfile, config: config,
                    errors: errors.slice(-8), source: live ? 'live-someip' : 'offline-disabled',
                    gearSignals: gearbox.samples, transitions: controller.transitions,
                    modeAgeMs: controller.policy.modeAt === null ? null : at - controller.policy.modeAt,
                    rpmAgeMs: controller.policy.rpmAt === null ? null : at - controller.policy.rpmAt,
                    uploadBytes: controller.upload.sent, skippedUploads: controller.upload.skipped,
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
module.exports = { start, supportedRenderer, CDS, FES, MODE_FIELD, VEHICLE_INFO };
