'use strict';
const { Policy, settings } = require('./policy');
const gear = require('./gear');
const { Telemetry } = require('./telemetry');
const { UploadPacer } = require('./upload');
class Controller {
    constructor(client, painter, hudPainter) {
        this.client = client; this.painter = painter; this.hudPainter = hudPainter; this.policy = new Policy();
        this.ref = 0; this.previous = null; this.layerState = 'hidden'; this.refused = false;
        this.profile = null; this.layerRate = null;
        this.gear = '--'; this.gearMode = null; this.telemetry = new Telemetry(); this.layerScale = null;
        this.upload = new UploadPacer(); this.retryAfter = 0; this.recoverySince = null; this.recovering = false;
        this.transitions = []; this.lastReason = null;
        client.on('budget', (cap) => this.upload.budget(cap));
        this.targetName = null; this.targetStates = {}; this.paintKey = null;
        client.on('disconnected', () => { this.hide(); this.policy.reset(); this.telemetry.clear(); this.gear = '--'; this.gearMode = null; });
        client.on('refused', () => { this.hide(); this.refused = true; });
        client.on('ready', () => { this.hide(); this.policy.reset(); this.refused = false; });
        client.on('layer', (ref, state) => { if (ref === this.ref) this.layerState = state; });
        client.on('target', (target, state, holder, reason) => {
            if (target !== 'map' && target !== 'panel' && target !== 'hud') return;
            this.targetStates[target] = { state: state, holder: holder || '', reason: reason || '' };
        });
    }
    hide() {
        if (this.ref) this.client.drop(this.ref);
        this.ref = 0; this.previous = null; this.paintKey = null; this.layerState = 'hidden';
        this.upload.reset();
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
        d.gear = gear.display(this.gear, this.gearMode, 'auto');
        Object.assign(d, this.telemetry.read(d.rpm, now));
        d.targetName = cfg.displayTarget;
        const target = this.targetStates[cfg.displayTarget] || {};
        d.targetState = target.state || 'idle'; d.targetHolder = target.holder || ''; d.targetReason = target.reason || '';
        const panel = cfg.displayTarget === 'panel', hud = cfg.displayTarget === 'hud';
        const painter = hud ? this.hudPainter : this.painter;
        const targetWidth = panel ? 1920 : hud ? 800 : 1088, targetHeight = panel ? 720 : 480;
        const geometry = cfg.displayTarget + ':' + targetWidth + 'x' + targetHeight;
        if (d.show && (!painter || cfg.displayTarget === 'unknown' || String(this.client.targets || '').split(',').indexOf(geometry) < 0)) {
            d.show = false; d.reason = 'target_unavailable';
        }
        if (!d.show) {
            if (this.ref && ['rpm_unknown', 'mode_unknown', 'rpm_invalid'].indexOf(d.reason) >= 0) { this.recovering = true; this.retryAfter = now + 2000; }
            this.recoverySince = null;
            if (['disabled', 'not_sport', 'engine_stopped', 'hybrid_engine_stopped'].indexOf(d.reason) >= 0) this.recovering = false;
        } else if (this.recovering) {
            if (this.recoverySince === null) this.recoverySince = now;
            if (now < this.retryAfter || now - this.recoverySince < 1000) { d.show = false; d.reason = 'recovering'; }
            else this.recovering = false;
        }
        if (this.lastReason !== d.reason) {
            this.transitions.push({ at: now, reason: d.reason, target: d.targetState });
            this.transitions = this.transitions.slice(-12); this.lastReason = d.reason;
        }
        if (!d.show) { this.hide(); return Object.assign(d, { requested: false, layerState: this.layerState }); }
        if (!this.ref) {
            // Preserve alpha inside the image too; shrink its footprint so the
            // frame/text do not extend into the factory dials as 0.5.0 did.
            const width = Math.round(painter.W * cfg.widgetScale / 100), height = Math.round(painter.H * cfg.widgetScale / 100);
            this.ref = this.client.image({ target: cfg.displayTarget, klass: panel ? 'overlay' : 'content', z: 100,
                x: (targetWidth - width) / 2, y: (targetHeight - height) / 2,
                w: width, h: height, iw: painter.W, ih: painter.H, sampling: 'bilinear',
                // An exclusive image keeps its last complete frame if a write
                // fails; a nonexclusive image is hidden during the rewrite.
                // Alpha remains transparent over factory gauges. Other lower
                // custom layers in this compositor target are suspended.
                // HUD yields to factory guidance. Never request panel + HUD:
                // they share a native scene ID on iDrive 7.
                visible: false, prewarm: false, exclusive: true, contend: !panel && !hud, guide_hold: false, fps: d.config.frameRate });
            if (!this.ref) { this.refused = true; d.show = false; d.reason = 'renderer_refused'; return d; }
            this.layerState = 'waiting';
            this.layerRate = d.config.frameRate;
            this.layerScale = cfg.widgetScale;
            this.targetName = cfg.displayTarget;
        }
        // Do not repaint a whole canvas 60 times/s when no source value changed.
        // Keep freshness/mode checks above this cache so stale signals still hide.
        const paintKey = [d.rpm, d.shift, d.gear, d.torqueNm, d.powerPS, d.torquePeak, d.powerPeak, cfg.shiftRpm, cfg.redlineRpm, cfg.maxRpm, cfg.torqueScale, cfg.powerScale, cfg.torqueUnit, cfg.powerUnit].join('|');
        if (this.previous && this.paintKey === paintKey) return Object.assign(d, { requested: true, layerState: this.layerState });
        if (this.previous && !this.upload.ready(now)) return Object.assign(d, { requested: true, layerState: this.layerState });
        const canvas = painter.draw(d), pixels = Buffer.from(canvas.d);
        if (!this.previous) {
            this.upload.allow(pixels.length, now, true);
            this.client.pixels(this.ref, null, pixels);
            // The production client waits if pixels are still queued behind
            // socket backpressure. Simple synchronous test/legacy clients can
            // keep the original frame -> visible calls.
            if (typeof this.client.showWhenSent === 'function') this.client.showWhenSent(this.ref);
            else this.client.set(this.ref, { visible: true });
        } else {
            const delta = painter.difference(this.previous, pixels);
            if (delta.rects.length && !this.upload.allow(delta.pixels.length, now, false)) return Object.assign(d, { requested: true, layerState: this.layerState });
            if (delta.rects.length) this.client.pixels(this.ref, delta.rects, delta.pixels);
        }
        this.previous = pixels;
        this.paintKey = paintKey;
        return Object.assign(d, { requested: true, layerState: this.layerState });
    }
    close() { this.hide(); this.policy.reset(); this.client.close(); }
}
module.exports = { Controller };
