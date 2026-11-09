'use strict';
// Fold coordinate/listener bursts into the latest complete page. At most one
// HMI image update is in flight; input never queues historical page snapshots.
class RenderQueue {
    constructor(draw, report, timers) {
        this.draw = draw; this.report = report || (() => {});
        this.timers = timers || { setTimeout, clearTimeout };
        this.timer = null; this.busy = false; this.dirty = false; this.closed = false;
    }
    request() {
        if (this.closed) return;
        this.dirty = true;
        if (!this.busy && this.timer === null)
            this.timer = this.timers.setTimeout(() => { this.timer = null; this.flush(); }, 40);
    }
    async flush() {
        if (this.closed || this.busy) return;
        if (this.timer !== null) { this.timers.clearTimeout(this.timer); this.timer = null; }
        this.dirty = false; this.busy = true;
        try { await this.draw(); } catch (e) { this.report(e); }
        finally { this.busy = false; if (this.dirty && !this.closed) this.request(); }
    }
    stop() {
        this.closed = true; this.dirty = false;
        if (this.timer !== null) this.timers.clearTimeout(this.timer);
        this.timer = null;
    }
}
module.exports = { RenderQueue };
