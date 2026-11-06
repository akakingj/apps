'use strict';
// Bound this app's pixel traffic below the compositor's shared link budget.
// Only the latest state is rendered when credit returns; never queue old frames.
class UploadPacer {
    constructor() { this.rate = 1024 * 1024; this.reset(); }
    reset() { this.credit = this.rate / 8; this.at = null; this.waitUntil = 0; this.sent = 0; this.skipped = 0; }
    budget(kb) { if (typeof kb === 'number' && isFinite(kb) && kb > 0) this.rate = Math.min(1024 * 1024, kb * 1024 * 0.3); }
    ready(now) { return now >= this.waitUntil; }
    allow(bytes, now, first) {
        const capacity = Math.max(this.rate / 4, bytes);
        if (this.at !== null) this.credit = Math.min(capacity, this.credit + Math.max(0, now - this.at) * this.rate / 1000);
        this.at = now;
        if (first) { this.credit = 0; this.waitUntil = now + 250; this.sent += bytes; return true; }
        if (bytes > this.credit) {
            this.waitUntil = now + Math.ceil((bytes - this.credit) / this.rate * 1000);
            this.skipped++; return false;
        }
        this.credit -= bytes; this.waitUntil = now; this.sent += bytes; return true;
    }
}
module.exports = { UploadPacer };
