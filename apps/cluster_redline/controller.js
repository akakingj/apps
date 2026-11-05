'use strict';
const { Policy, settings } = require('./policy');
const gear = require('./gear');
const { Telemetry } = require('./telemetry');
class Controller {
    constructor(client, painter) {
        this.client = client; this.painter = painter; this.policy = new Policy();
        this.ref = 0; this.previous = null; this.layerState = 'hidden'; this.refused = false;
        this.profile = null; this.layerRate = null;
        this.gear = '--'; this.gearMode = null; this.telemetry = new Telemetry(); this.layerScale = null;
        this.targetName = null; this.targetStates = {}; this.paintKey = null;
        client.on('disconnected', () => { this.hide(); this.policy.reset(); this.telemetry.clear(); this.gear = '--'; this.gearMode = null; });
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
            this.telemetry.clear();
        } else if (this.ref && (this.layerRate !== cfg.frameRate || this.targetName !== cfg.displayTarget || this.layerScale !== cfg.widgetScale)) this.hide();
        this.profile = cfg.engineProfile;
        const d = this.policy.evaluate(now, this.client.ready && !this.refused, cfg);
        d.gear = gear.display(this.gear, this.gearMode, cfg.gearPrefix);
        Object.assign(d, this.telemetry.read(d.rpm, now));
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
            // Preserve alpha inside the image too; shrink its footprint so the
            // frame/text do not extend into the factory dials as 0.5.0 did.
            const width = Math.round(this.painter.W * cfg.widgetScale / 100), height = Math.round(this.painter.H * cfg.widgetScale / 100);
            this.ref = this.client.image({ target: cfg.displayTarget, klass: panel ? 'overlay' : 'content', z: 100,
                x: ((panel ? 1920 : 1088) - width) / 2, y: ((panel ? 720 : 480) - height) / 2,
                w: width, h: height, iw: this.painter.W, ih: this.painter.H, sampling: 'bilinear',
                visible: false, prewarm: false, exclusive: !panel, contend: !panel, guide_hold: false, fps: d.config.frameRate });
            if (!this.ref) { this.refused = true; d.show = false; d.reason = 'renderer_refused'; return d; }
            this.layerState = 'waiting';
            this.layerRate = d.config.frameRate;
            this.layerScale = cfg.widgetScale;
            this.targetName = cfg.displayTarget;
        }
        // Do not repaint a whole canvas 60 times/s when no source value changed.
        // Keep freshness/mode checks above this cache so stale signals still hide.
        const paintKey = [d.rpm, d.shift, d.gear, d.torqueNm, d.powerPS, d.torquePeak, d.powerPeak, cfg.shiftRpm, cfg.redlineRpm, cfg.maxRpm, cfg.torqueScale, cfg.powerScale].join('|');
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
