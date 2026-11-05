'use strict';
const { Policy, settings } = require('./policy');
class Controller {
    constructor(client, painter) {
        this.client = client; this.painter = painter; this.policy = new Policy();
        this.ref = 0; this.previous = null; this.layerState = 'hidden'; this.refused = false;
        this.profile = null; this.layerRate = null;
        this.gear = '--'; this.targetName = null; this.targetStates = {}; this.paintKey = null;
        client.on('disconnected', () => { this.hide(); this.policy.reset(); });
        client.on('refused', () => { this.hide(); this.refused = true; });
        client.on('ready', () => { this.hide(); this.policy.reset(); this.refused = false; });
        client.on('layer', (ref, state) => { if (ref === this.ref) this.layerState = state; });
        client.on('target', (target, state, holder, reason) => {
            if (target !== 'map' && target !== 'panel') return;
            this.targetStates[target] = { state: state, holder: holder || '', reason: reason || '' };
        });
    }
    hide() {
        if (this.ref) this.client.drop(this.ref);
        this.ref = 0; this.previous = null; this.paintKey = null; this.layerState = 'hidden';
        this.targetName = null; this.targetStates = {};
    }
    tick(now, config) {
        const cfg = settings(config);
        if (this.profile !== null && this.profile !== cfg.engineProfile) {
            this.hide(); this.policy.reset();
        } else if (this.ref && (this.layerRate !== cfg.frameRate || this.targetName !== cfg.displayTarget)) this.hide();
        this.profile = cfg.engineProfile;
        const d = this.policy.evaluate(now, this.client.ready && !this.refused, cfg);
        d.gear = this.gear;
        d.targetName = cfg.displayTarget;
        const target = this.targetStates[cfg.displayTarget] || {};
        d.targetState = target.state || 'idle'; d.targetHolder = target.holder || ''; d.targetReason = target.reason || '';
        const panel = cfg.displayTarget === 'panel';
        const geometry = panel ? 'panel:1920x720' : 'map:1088x480';
        if (d.show && (cfg.displayTarget === 'unknown' || String(this.client.targets || '').split(',').indexOf(geometry) < 0)) {
            d.show = false; d.reason = 'target_unavailable';
        }
        if (!d.show) { this.hide(); return Object.assign(d, { requested: false, layerState: this.layerState }); }
        if (!this.ref) {
            // The panel scene is transparent outside this central image. Never
            // resize to fill the panel, take over its stock speech dialog, or use HUD.
            this.ref = this.client.image({ target: cfg.displayTarget, klass: panel ? 'overlay' : 'content', z: 100,
                x: panel ? (1920 - this.painter.W) / 2 : 0, y: panel ? (720 - this.painter.H) / 2 : 0,
                w: this.painter.W, h: this.painter.H, iw: this.painter.W, ih: this.painter.H,
                visible: false, prewarm: false, exclusive: !panel, contend: !panel, guide_hold: false, fps: d.config.frameRate });
            if (!this.ref) { this.refused = true; d.show = false; d.reason = 'renderer_refused'; return d; }
            this.layerState = 'waiting';
            this.layerRate = d.config.frameRate;
            this.targetName = cfg.displayTarget;
        }
        // Do not repaint a whole canvas 60 times/s when no source value changed.
        // Keep freshness/mode checks above this cache so stale signals still hide.
        const paintKey = [d.rpm, d.shift, d.gear, cfg.shiftRpm, cfg.redlineRpm, cfg.maxRpm].join('|');
        if (this.previous && this.paintKey === paintKey) return Object.assign(d, { requested: true, layerState: this.layerState });
        const canvas = this.painter.draw(d), pixels = Buffer.from(canvas.d);
        if (!this.previous) {
            this.client.pixels(this.ref, null, pixels);
            this.client.set(this.ref, { visible: true });
        } else {
            const delta = this.painter.difference(this.previous, pixels);
            if (delta.rects.length) this.client.pixels(this.ref, delta.rects, delta.pixels);
        }
        this.previous = pixels;
        this.paintKey = paintKey;
        return Object.assign(d, { requested: true, layerState: this.layerState });
    }
    close() { this.hide(); this.policy.reset(); this.client.close(); }
}
module.exports = { Controller };
