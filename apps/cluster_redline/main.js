'use strict';
const fs = require('fs');
const path = require('path');
const mgu = require('./kit/mgu');
const { t } = require('./kit/i18n');
const { SettingsPage, W, H } = require('./settings-ui');
const worker = require('./worker');
const REASONS = {
    disabled: 'Automatic display off', renderer_unavailable: 'Waiting for cluster renderer',
    profile_unknown: 'Check engine profile', hybrid_engine_stopped: 'Hybrid engine stopped · hidden',
    renderer_refused: 'Renderer refused display', target_unavailable: 'Selected display target unavailable',
    mode_unknown: 'Waiting for drive mode', not_sport: 'Normal mode · hidden', rpm_unknown: 'Waiting for engine RPM',
    rpm_invalid: 'Check engine RPM', engine_stopped: 'Engine stopped · hidden', stabilizing: 'Confirming Sport mode',
    recovering: 'Waiting for stable live signals', sport: 'Sport mode · display requested',
    all_modes: 'All drive modes · display requested', stopped: 'Background app stopped',
};
mgu.run({ async start(ctx) {
    // Preserve a legacy OFF choice when moving from autoSport to appEnabled.
    try {
        const old = JSON.parse(fs.readFileSync(path.join(ctx.dataDir, 'settings.json'), 'utf8'));
        if (old.appEnabled === undefined && old.autoSport === false) ctx.settings.set('appEnabled', false);
        if (old.renderer === 'software') ctx.settings.set('renderer', 'auto');
    } catch (e) {}
    let background = null, drawing = false, again = false;
    const page = new SettingsPage(ctx.settings, () => render().catch(report), ctx.spec.version);
    function report(e) { ctx.log.error('settings', e.message || e); }
    function syncWorker() {
        if (ctx.settings.get('appEnabled') === true && !background) background = worker.start(ctx);
        else if (ctx.settings.get('appEnabled') !== true && background) { background.stop(); background = null; }
    }
    ctx.settings.onChange((key) => {
        if (key === 'engineProfile') ctx.settings.set('shiftRpm', 0);
        if (key === 'appEnabled') syncWorker();
        render().catch(report);
    });
    // MainApp starts a lightweight settings host; OFF stops live subscriptions and cluster output.
    syncWorker();
    async function render() {
        if (drawing) { again = true; return; }
        drawing = true;
        try {
            let state = null;
            try { state = JSON.parse(fs.readFileSync(path.join(ctx.dataDir, 'cluster-redline-status.json'), 'utf8')); } catch (e) {}
            if (state && (!isFinite(Date.parse(state.at)) || Date.now() - Date.parse(state.at) > 5000)) state = null;
            const reason = !ctx.settings.get('appEnabled') ? 'disabled' : state && state.reason;
            const cv = page.draw(ctx.canvas(W, H), t(REASONS[reason] || 'Waiting for background app'));
            page.targets = cv.targets;
            await Promise.all([
                ctx.ui.text('BTN_VALUE_DOWN', page.open ? 'Cancel' : 'Value -'),
                ctx.ui.text('BTN_VALUE_UP', page.open ? 'Select' : 'Value +'),
            ]);
            await ctx.ui.image('MAIN_GFX', cv);
        } finally {
            drawing = false;
            if (again) { again = false; render().catch(report); }
        }
    }
    ctx.ui.onClick('BTN_BASIC', () => page.selectTab(0));
    ctx.ui.onClick('BTN_ADVANCED', () => page.selectTab(1));
    ctx.ui.onClick('BTN_PREVIOUS', () => page.move(-1));
    ctx.ui.onClick('BTN_NEXT', () => page.move(1));
    ctx.ui.onClick('BTN_VALUE_DOWN', () => { if (page.open) { page.open = null; render().catch(report); } else page.change(-1); });
    ctx.ui.onClick('BTN_VALUE_UP', () => page.open ? page.choose(page.choice) : page.change(1));
    // Native RHMI bar buttons remain usable without a GPU/touch renderer.
    ctx.onTap((x, y) => {
        const target = (page.targets || []).find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
        if (target) target.act();
    });
    ctx.onTab((i) => page.selectTab(i));
    ctx.onLayout(() => render().catch(report));
    ctx.loop('MAIN', 2, render);
    await render();
} });
