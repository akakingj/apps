'use strict';
// Read-only native route state. Unknown data never means navigation is off.
const INTERFACE = 'de.bmw.infotainment.navigation.guiding.Guidance';
const INSTANCE = 'Main_Instance';
const FIELD = 'guidanceState';
const TTL_MS = 5000;
function decode(value) {
    // The supplied vehicle catalog defines INACTIVE=0, CALCULATING_ROUTE=1, ACTIVE=2.
    if (value === 0) return 'inactive';
    if (value === 1) return 'calculating';
    if (value === 2) return 'active';
    if (value === 'ACTIVE') return 'active';
    if (value === 'CALCULATING_ROUTE') return 'calculating';
    if (value === 'INACTIVE') return 'inactive';
    return null;
}
class GuidanceState {
    constructor(ttl) { this.ttl = typeof ttl === 'number' && isFinite(ttl) && ttl > 0 ? ttl : TTL_MS; this.clear(); }
    clear() { this.state = null; this.at = null; }
    sample(value, now) {
        if (typeof now !== 'number' || !isFinite(now) || now < 0) { this.clear(); return; }
        this.state = decode(value); this.at = now;
    }
    read(now, available) {
        const age = this.at === null || typeof now !== 'number' || !isFinite(now) ? null : now - this.at;
        let reason = 'guidance_unknown';
        const fresh = age !== null && age >= 0 && age <= this.ttl;
        const known = available === true && fresh && this.state !== null;
        if (available !== true) reason = 'guidance_unavailable';
        else if (this.at !== null && !fresh) reason = 'guidance_stale';
        else if (known) reason = 'guidance_' + this.state;
        return { state: known ? this.state : 'unknown', known: known,
            active: known && this.state !== 'inactive', blocked: !known || this.state !== 'inactive',
            reason: reason, ageMs: age };
    }
}
module.exports = { INTERFACE, INSTANCE, FIELD, TTL_MS, decode, GuidanceState };
