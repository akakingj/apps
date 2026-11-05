'use strict';
// This module never talks to the vehicle or renderer; its inputs must be live.
const PROFILES = {
    petrol: { label: '가솔린', shiftRpm: 6500, redlineRpm: 7000, maxRpm: 8000,
        ranges: { shiftRpm: [2500, 7500], redlineRpm: [3000, 8500], maxRpm: [4000, 10000] } },
    diesel: { label: '디젤', shiftRpm: 4200, redlineRpm: 5000, maxRpm: 6000,
        ranges: { shiftRpm: [2000, 5000], redlineRpm: [3000, 5500], maxRpm: [4000, 7000] } },
    hybrid: { label: '하이브리드', shiftRpm: 6500, redlineRpm: 7000, maxRpm: 8000,
        ranges: { shiftRpm: [2500, 7500], redlineRpm: [3000, 8500], maxRpm: [4000, 10000] } },
};
// Zero RPM settings mean the selected profile's defaults, rather than engine-off.
const DEFAULTS = { autoSport: true, engineProfile: 'petrol', shiftRpm: 0, redlineRpm: 0, maxRpm: 0, frameRate: 8 };
const MODES = { 1: 'SPORT', 2: 'SPORT_PLUS', 3: 'SPORT_INDIVIDUAL', 4: 'COMFORT', 5: 'COMFORT_PLUS',
    6: 'COMFORT_INDIVIDUAL', 7: 'ECO_PRO', 8: 'ECO_PRO_PLUS', 9: 'ECO_PRO_INDIVIDUAL', 10: 'ADAPTIVE',
    SPORT_DYNAMIC: 'SPORT', SPORT_EXPERT: 'SPORT_PLUS', SPORT_INDIVIDUAL: 'SPORT_INDIVIDUAL',
    COMFORT: 'COMFORT', ECO_PRO_EFFICIENT: 'ECO_PRO' };
const SPORT = ['SPORT', 'SPORT_PLUS', 'SPORT_INDIVIDUAL'];
function settings(raw) {
    raw = raw || {};
    const out = Object.assign({}, DEFAULTS);
    if (Object.prototype.hasOwnProperty.call(raw, 'autoSport')) out.autoSport = raw.autoSport === true;
    if (Object.prototype.hasOwnProperty.call(raw, 'engineProfile')) {
        out.engineProfile = typeof raw.engineProfile === 'string' && Object.prototype.hasOwnProperty.call(PROFILES, raw.engineProfile)
            ? raw.engineProfile : 'unknown';
    }
    const profile = PROFILES[out.engineProfile] || PROFILES.petrol;
    ['shiftRpm', 'redlineRpm', 'maxRpm'].forEach((key) => {
        const value = raw[key], range = profile.ranges[key];
        out[key] = typeof value === 'number' && isFinite(value) && value >= range[0] && value <= range[1] ? value : profile[key];
    });
    if (typeof raw.frameRate === 'number' && isFinite(raw.frameRate) && raw.frameRate >= 2 && raw.frameRate <= 12) out.frameRate = raw.frameRate;
    out.redlineRpm = Math.max(out.redlineRpm, out.shiftRpm);
    out.maxRpm = Math.max(out.maxRpm, out.redlineRpm);
    return out;
}
function modeOf(raw) { return (typeof raw === 'number' || typeof raw === 'string') && Object.prototype.hasOwnProperty.call(MODES, raw) ? MODES[raw] : null; }
class Policy {
    constructor() { this.reset(); }
    reset() { this.mode = null; this.rpm = null; this.modeAt = null; this.rpmAt = null; this.sportSince = null; }
    modeSample(raw, now) {
        const next = modeOf(raw), wasSport = SPORT.indexOf(this.mode) >= 0 && this.modeAt !== null && now >= this.modeAt && now - this.modeAt <= 3500;
        const isSport = SPORT.indexOf(next) >= 0;
        this.sportSince = isSport ? (wasSport && this.sportSince !== null ? this.sportSince : now) : null;
        this.mode = next; this.modeAt = next ? now : null;
    }
    rpmSample(rpm, now) {
        this.rpm = typeof rpm === 'number' && isFinite(rpm) && rpm >= 0 && rpm <= 10000 ? rpm : null;
        this.rpmAt = this.rpm === null ? null : now;
    }
    evaluate(now, ready, config) {
        const cfg = settings(config);
        const fresh = (at, ttl) => at !== null && now >= at && now - at <= ttl;
        let reason = 'sport';
        if (!cfg.autoSport) reason = 'disabled';
        else if (!Object.prototype.hasOwnProperty.call(PROFILES, cfg.engineProfile)) reason = 'profile_unknown';
        else if (!ready) reason = 'renderer_unavailable';
        else if (!fresh(this.modeAt, 3500)) reason = 'mode_unknown';
        else if (SPORT.indexOf(this.mode) < 0) reason = 'not_sport';
        else if (!fresh(this.rpmAt, 1800)) reason = 'rpm_unknown';
        else if (this.rpm < 100) reason = cfg.engineProfile === 'hybrid' ? 'hybrid_engine_stopped' : 'engine_stopped';
        else if (this.rpm > cfg.maxRpm + 1000) reason = 'rpm_invalid';
        else if (this.sportSince === null || now - this.sportSince < 1000) reason = 'stabilizing';
        return { show: reason === 'sport', reason: reason, mode: this.mode, rpm: this.rpm,
            shift: reason === 'sport' && this.rpm >= cfg.shiftRpm, config: cfg };
    }
}
module.exports = { Policy, DEFAULTS, PROFILES, settings, modeOf, SPORT };
