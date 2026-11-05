'use strict';
// FES statusActualValueTorque2: raw 2047 = 0 Nm, 0.5 Nm/bit;
// 4095 and 65535 are unavailable, not physical engine torque.
function torque(raw) {
    return typeof raw === 'number' && isFinite(raw) && Math.floor(raw) === raw && raw >= 0 && raw < 4095
        ? Math.max(0, (raw - 2047) * 0.5) : null;
}
class Telemetry {
    constructor() { this.clear(); }
    clear() { this.nm = null; this.at = null; this.peakNm = 0; this.peakPS = 0; }
    sample(raw, now) { this.nm = torque(raw); this.at = this.nm === null ? null : now; }
    read(rpm, now) {
        const fresh = this.at !== null && now >= this.at && now - this.at <= 1800;
        const nm = fresh ? this.nm : null;
        const ps = nm !== null && typeof rpm === 'number' && isFinite(rpm) && rpm >= 0 ? nm * rpm / 9549.2966 * 1.3596216 : null;
        if (nm !== null) this.peakNm = Math.max(this.peakNm, nm);
        if (ps !== null) this.peakPS = Math.max(this.peakPS, ps);
        return { torqueNm: nm, powerPS: ps, torquePeak: this.peakNm, powerPeak: this.peakPS, powerEstimated: true };
    }
}
module.exports = { torque, Telemetry };
