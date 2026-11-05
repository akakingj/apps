'use strict';
const { Policy, settings } = require('./policy');
class Controller {
    constructor(client, painter) {
        this.client = client; this.painter = painter; this.policy = new Policy();
        this.ref = 0; this.previous = null; this.layerState = 'hidden'; this.refused = false;
        this.profile = null; this.layerRate = null;
        this.gear = '--'; this.targetState = 'idle'; this.targetHolder = ''; this.targetReason = '';
        client.on('disconnected', () => { this.hide(); this.policy.reset(); });
        client.on('refused', () => { this.hide(); this.refused = true; });
        client.on('ready', () => { this.hide(); this.policy.reset(); this.refused = false; });
        client.on('layer', (ref, state) => { if (ref === this.ref) this.layerState = state; });
        client.on('target', (target, state, holder, reason) => {
            if (target !== 'map') return;
            this.targetState = state; this.targetHolder = holder || ''; this.targetReason = reason || '';
        });
    }
    hide() {
        if (this.ref) this.client.drop(this.ref);
        this.ref = 0; this.previous = null; this.layerState = 'hidden';
    }
    tick(now, config) {
        const cfg = settings(config);
        if (this.profile !== null && this.profile !== cfg.engineProfile) {
            this.hide(); this.policy.reset();
        } else if (this.ref && this.layerRate !== cfg.frameRate) this.hide();
        this.profile = cfg.engineProfile;
        const d = this.policy.evaluate(now, this.client.ready && !this.refused, cfg);
        d.gear = this.gear;
        d.targetState = this.targetState; d.targetHolder = this.targetHolder; d.targetReason = this.targetReason;
        if (!d.show) { this.hide(); return Object.assign(d, { requested: false, layerState: this.layerState }); }
        if (!this.ref) {
            this.ref = this.client.image({ target: 'map', klass: 'content', z: 100,
                x: 0, y: 0, w: this.painter.W, h: this.painter.H, iw: this.painter.W, ih: this.painter.H,
                visible: false, prewarm: false, exclusive: true, contend: true, guide_hold: false, fps: d.config.frameRate });
            if (!this.ref) { this.refused = true; d.show = false; d.reason = 'renderer_refused'; return d; }
            this.layerState = 'waiting';
            this.layerRate = d.config.frameRate;
        }
        const canvas = this.painter.draw(d), pixels = Buffer.from(canvas.d);
        if (!this.previous) {
            this.client.pixels(this.ref, null, pixels);
            this.client.set(this.ref, { visible: true });
        } else {
            const delta = this.painter.difference(this.previous, pixels);
            if (delta.rects.length) this.client.pixels(this.ref, delta.rects, delta.pixels);
        }
        this.previous = pixels;
        return Object.assign(d, { requested: true, layerState: this.layerState });
    }
    close() { this.hide(); this.policy.reset(); this.client.close(); }
}
module.exports = { Controller };
