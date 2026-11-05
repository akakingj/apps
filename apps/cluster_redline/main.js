'use strict';
const fs = require('fs');
const path = require('path');
const mgu = require('./kit/mgu');
const { Canvas } = require('./kit/canvas');
const { t: translate } = require('./kit/i18n');
const { DEFAULTS, PROFILES, settings: effectiveSettings } = require('./policy');
const worker = require('./worker');
const REASONS = { disabled: 'Automatic display off', renderer_unavailable: 'Waiting for cluster renderer',
    profile_unknown: 'Check engine profile', hybrid_engine_stopped: 'Hybrid engine stopped · hidden',
    renderer_refused: 'Renderer refused display', mode_unknown: 'Waiting for drive mode', not_sport: 'Normal mode · hidden',
    rpm_unknown: 'Waiting for engine RPM', rpm_invalid: 'Check engine RPM', engine_stopped: 'Engine stopped · hidden',
    stabilizing: 'Confirming Sport mode', sport: 'Sport mode · display requested', stopped: 'Background app stopped' };
const MODES = { SPORT: 'Sport', SPORT_PLUS: 'Sport Plus', SPORT_INDIVIDUAL: 'Sport Individual',
    COMFORT: 'Comfort', COMFORT_PLUS: 'Comfort Plus', COMFORT_INDIVIDUAL: 'Comfort Individual',
    ECO_PRO: 'Eco Pro', ECO_PRO_PLUS: 'Eco Pro Plus', ECO_PRO_INDIVIDUAL: 'Eco Pro Individual', ADAPTIVE: 'Adaptive' };
const LAYERS = { hidden: 'Hidden', waiting: 'Waiting', shown: 'Shown', suspended: 'Suspended' };
mgu.run({ async start(ctx) {
    // A different engine must not inherit the previous engine's manual limits.
    ctx.settings.onChange((key) => {
        if (key === 'engineProfile') ['shiftRpm', 'redlineRpm', 'maxRpm'].forEach((name) => ctx.settings.set(name, 0));
    });
    // This timer lives outside ctx.loop, which intentionally pauses with the UI.
    worker.start(ctx);
    async function render() {
        let state = null;
        try { state = JSON.parse(fs.readFileSync(path.join(ctx.dataDir, 'cluster-redline-status.json'), 'utf8')); } catch (e) {}
        if (state && (!isFinite(Date.parse(state.at)) || Date.now() - Date.parse(state.at) > 5000)) state = null;
        const cv = new Canvas(1600, 520);
        cv.clear('#0b0f15');
        cv.text('Cluster Redline', 54, 74, 40, '#f3f5fa', { font: 'bold' });
        cv.text('Autostart · Sport mode only', 54, 118, 25, '#8fabc4');
        cv.roundRect(48, 157, 1504, 221, 18, '#141e29');
        cv.text(state ? REASONS[state.reason] || 'Waiting for status' : 'Waiting for background app', 80, 217, 32, '#f3f5fa');
        const raw = {};
        Object.keys(DEFAULTS).forEach((k) => { raw[k] = ctx.settings.get(k); });
        const cfg = effectiveSettings(raw), profile = PROFILES[cfg.engineProfile];
        cv.text(translate('Drive mode') + ': ' + translate(state && MODES[state.mode] || 'Checking'), 80, 269, 25, '#a8bfd4');
        cv.text(translate('Cluster status') + ': ' + translate(state && LAYERS[state.layerState] || 'Hidden'), 80, 311, 25, '#a8bfd4');
        cv.text(translate('Engine profile') + ': ' + translate(profile ? profile.label : 'Check required'), 820, 269, 25, '#a8bfd4');
        cv.text(translate('Shift alert') + ': ' + cfg.shiftRpm + ' rpm', 820, 311, 25, '#a8bfd4');
        cv.text(translate('Redline / scale') + ': ' + cfg.redlineRpm + ' / ' + cfg.maxRpm + ' rpm', 80, 353, 25, '#a8bfd4');
        const target = state && state.targetState || 'idle', holder = state && state.targetHolder || '--';
        cv.text(translate('Map slot') + ': ' + target + ' / ' + holder + '   ' + translate('Gear') + ': ' + (state && state.gear || '--'), 54, 437, 25, '#a8bfd4');
        const takeover = state && state.renderer && state.renderer.compatible ? state.renderer.takeOverStock : null;
        cv.text(translate('Renderer version') + ': ' + (state && state.renderer && state.renderer.version || '--') +
            '   ' + translate('Map takeover') + ': ' + (takeover === null ? '--' : takeover ? 'ON' : 'OFF'), 54, 479, 23, '#8194a8');
        await ctx.ui.image('MAIN_GFX', cv);
    }
    ctx.loop('MAIN', 2, render);
    await render();
} });
