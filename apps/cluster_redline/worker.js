'use strict';
// Live-only background work in the same OAP process as the settings UI.
// MainApp owns its autostart/restart lifecycle; no root service is installed.
const fs = require('fs');
const path = require('path');
const { ClusterRender } = require('./cluster_render_client');
const { Outputs } = require('./outputs');
const painter = require('./draw');
const hudPainter = require('./hud-compose');
const { settings, DEFAULTS } = require('./policy');
const renderer = require('./renderer');
const gear = require('./gear');
const guidance = require('./guidance');
const {NativeNavigation} = require('./native-navigation');
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
    const client = new ClusterRender('cluster-redline'), controller = new Outputs(client, painter, hudPainter);
    const gearbox = new gear.GearState(), navigation = new guidance.GuidanceState(), maneuvers = new NativeNavigation();
    const navigationFields = [], lastNavigationValues = {}, navigationEventRevisions = {}, navigationSeenAt = {}, navigationReadState = {};
    function navigationSample(field,value,readState) {
        if(stopped)return;
        navigationSeenAt[field]=mono();navigationReadState[field]=readState||'received';
        if(field!=='conclusiveDart' && lastNavigationValues[field]!==value){navigationRevision++;lastNavigationValues[field]=value;}
        if(field===guidance.FIELD)navigation.sample(value,mono());
        maneuvers.sample(field,value,mono());
        if(navigation.read(mono(),true).blocked&&!maneuvers.read(mono(),true).visible)controller.hud.hide();
    }
    let config = settings(), lastStatus = -Infinity, stopped = false, timer;
    let guidanceSub, lastGuidancePoll = -Infinity, guidancePending = false, navigationRevision = 0, nativeStatus = null;
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
        // Read the common native/projection guidance channel. Never set routes,
        // call vehicle methods, or alter the BMW HUD/menu configuration.
        try {
            const cfg=signals.loadConfig(guidance.INTERFACE);
            [guidance.FIELD,'guidingProvider','conclusiveDart'].forEach((field)=>{
                if(cfg.fields&&cfg.fields[field]&&cfg.fields[field].getter)navigationFields.push(field);
            });
        } catch(e) {}
        if(navigationFields.indexOf(guidance.FIELD)>=0) {
            const handlers={};
            navigationFields.forEach((field)=>{handlers[field]=(value)=>{navigationEventRevisions[field]=(navigationEventRevisions[field]||0)+1;navigationSample(field,value);};});
            signals.watch(guidance.INTERFACE,guidance.INSTANCE,handlers,log,{}).then((sub)=>{
                guidanceSub=sub;keep(sub);if(sub.error)reportError('optional native guidance',sub.error);
            }).catch((e)=>reportError('optional native guidance',e));
        } else reportError('optional native guidance','readable guidanceState unavailable; HUD released');
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
                lastRendererCheck = at;
                try { nativeStatus = fs.readFileSync('/run/cluster-render/status.txt', 'utf8').slice(0, 24576); } catch (e) { nativeStatus = null; } rendererInfo = renderer.inspect(undefined, fs);
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
            Object.keys(DEFAULTS).forEach((k) => { if (k !== 'frameRate') raw[k] = ctx.settings.get(k); });
            config = settings(raw);
            const navigationAvailable = !!(guidanceSub && guidanceSub.available === true && !guidanceSub.error);
            if (!navigationAvailable) { navigationRevision++; navigation.clear(); maneuvers.clear(); }
            // Owned polling uses the existing worker timer; shutdown leaves no
            // independent interval and late reads cannot alter a stopped worker.
            if (navigationAvailable && guidanceSub.proxy && typeof guidanceSub.proxy.getValue === 'function' && !guidancePending && at - lastGuidancePoll >= 1000) {
                lastGuidancePoll = at; guidancePending = true; const revision = navigationRevision;
                const eventRevisions=Object.assign({},navigationEventRevisions);
                try {
                    const reads=navigationFields.map((field)=>Promise.resolve().then(()=>guidanceSub.proxy.getValue(field,1000))
                        .then((value)=>({field,value}),()=>({field,value:null,failed:true})));
                    Promise.all(reads).then((values)=>{
                        guidancePending=false;
                        if(stopped||revision!==navigationRevision)return;
                        // Apply identity before its maneuver; asynchronous initial
                        // reads cannot reinsert an arrow from a previous provider.
                        values.forEach((item)=>{
                            // A newer notification supersedes only its own
                            // getter. Repeated identical state/provider events
                            // must not starve unrelated direction/distance reads.
                            if((navigationEventRevisions[item.field]||0)===(eventRevisions[item.field]||0))navigationSample(item.field,item.value,item.failed?'read_failed':'read_ok');
                        });
                    },()=>{guidancePending=false;if(!stopped&&revision===navigationRevision){navigation.clear();maneuvers.clear();controller.hud.hide();}});
                } catch(e) {guidancePending=false;navigation.clear();maneuvers.clear();controller.hud.hide();}
            }
            const navigationState=navigation.read(at,navigationAvailable);
            const maneuverState=maneuvers.read(at,navigationAvailable);
            controller.navigation=maneuverState;
            const composed=config.hudNavigationEnabled&&maneuverState.visible;
            controller.hudBlocked=rendererInfo.hudGuidanceSafe===false||(navigationState.blocked&&!composed);
            controller.hudBlockReason=rendererInfo.hudGuidanceSafe===false?'hud_safety':navigationState.active&&config.hudNavigationEnabled?maneuverState.reason:navigationState.reason;
            const state = controller.tick(at, config);
            if (at - lastStatus >= 500) {
                lastStatus = at;
                atomic(path.join(ctx.dataDir, 'cluster-redline-status.json'), {
                    at: new Date().toISOString(), appVersion: ctx.spec && ctx.spec.version || 'unknown', requested: !!state.requested, layerState: state.layerState || 'hidden',
                    reason: state.reason, mode: state.mode, rpm: state.rpm, shift: state.shift, engineStopped: !!state.engineStopped,
                    gear: state.gear, torqueNm: state.torqueNm, powerPS: state.powerPS, powerEstimated: true,
                    targetName: state.targetName, targetState: state.targetState, targetHolder: state.targetHolder, targetReason: state.targetReason,
                    guidanceRequested: !!state.guidanceRequested, guidanceDisabled: !!state.guidanceDisabled,
                    outputs: state.outputs, navigation: navigationState, maneuver: maneuverState,
                    navigationInputs: {fields:navigationFields.slice(),available:navigationAvailable,pending:guidancePending,reads:Object.assign({},navigationReadState),
                        agesMs:navigationFields.reduce((out,field)=>{out[field]=navigationSeenAt[field]===undefined?null:Math.max(0,at-navigationSeenAt[field]);return out;},{})}, nativeStatus: nativeStatus,
                    renderer: rendererInfo, rendererBackend: client.backend || null, rendererTargets: client.targets || '', requestedSettings: raw,
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
