'use strict';
// This module never talks to the vehicle or renderer; its inputs must be live.
const PROFILES = {
    petrol: { label: 'Petrol', shiftRpm: 5500, redlineRpm: 6000, maxRpm: 7000,
        torqueScale: 500, powerScale: 300,
        ranges: { shiftRpm: [2000, 7500], redlineRpm: [3000, 8500], maxRpm: [4000, 10000] } },
    diesel: { label: 'Diesel', shiftRpm: 4200, redlineRpm: 5000, maxRpm: 6000,
        torqueScale: 700, powerScale: 300,
        ranges: { shiftRpm: [2000, 5000], redlineRpm: [3000, 5500], maxRpm: [4000, 7000] } },
    hybrid: { label: 'eDrive (PHEV)', shiftRpm: 5500, redlineRpm: 7000, maxRpm: 8000,
        torqueScale: 600, powerScale: 400,
        ranges: { shiftRpm: [2000, 7500], redlineRpm: [3000, 8500], maxRpm: [4000, 10000] } },
    m: { label: 'M', shiftRpm: 5500, redlineRpm: 7000, maxRpm: 9000,
        torqueScale: 800, powerScale: 600,
        ranges: { shiftRpm: [2000, 7500], redlineRpm: [3000, 8500], maxRpm: [4000, 10000] } },
};
// Zero RPM settings mean the selected profile's defaults, rather than engine-off.
const FRAME_RATE = 20;
const DEFAULTS = { appEnabled: true, engineProfile: 'petrol', displayMode: 'sport', powerUnit: 'PS', torqueUnit: 'Nm', shiftRpm: 0, frameRate: FRAME_RATE, displayTarget: 'map', widgetScale: 80 };
Object.assign(DEFAULTS, { sportClusterOutput: 'redline', sportHudOutput: 'stock', allClusterOutput: 'redline', allHudOutput: 'stock',
    clusterOffsetX: 0, clusterOffsetY: 0, clusterWidthScale: 80, clusterHeightScale: 80,
    hudOffsetX: 0, hudOffsetY: -100, hudWidthScale: 75, hudHeightScale: 75 });
const MODES = { 1: 'SPORT', 2: 'SPORT_PLUS', 3: 'SPORT_INDIVIDUAL', 4: 'COMFORT', 5: 'COMFORT_PLUS',
    6: 'COMFORT_INDIVIDUAL', 7: 'ECO_PRO', 8: 'ECO_PRO_PLUS', 9: 'ECO_PRO_INDIVIDUAL', 10: 'ADAPTIVE',
    SPORT_DYNAMIC: 'SPORT', SPORT_EXPERT: 'SPORT_PLUS', SPORT_INDIVIDUAL: 'SPORT_INDIVIDUAL',
    COMFORT: 'COMFORT', ECO_PRO_EFFICIENT: 'ECO_PRO' };
const SPORT = ['SPORT', 'SPORT_PLUS', 'SPORT_INDIVIDUAL'];
function settings(raw) {
    raw = raw || {};
    const out = Object.assign({}, DEFAULTS);
    // Retain an old owner's OFF choice; removed manual scales/prefixes are ignored.
    if (typeof raw.appEnabled === 'boolean') out.appEnabled = raw.appEnabled;
    else if (raw.autoSport === false) out.appEnabled = false;
    if (['sport', 'all'].indexOf(raw.displayMode) >= 0) out.displayMode = raw.displayMode;
    if (['PS', 'kW'].indexOf(raw.powerUnit) >= 0) out.powerUnit = raw.powerUnit;
    if (['Nm', 'kgfm'].indexOf(raw.torqueUnit) >= 0) out.torqueUnit = raw.torqueUnit;
    if (Object.prototype.hasOwnProperty.call(raw, 'engineProfile')) {
        out.engineProfile = typeof raw.engineProfile === 'string' && Object.prototype.hasOwnProperty.call(PROFILES, raw.engineProfile)
            ? raw.engineProfile : 'unknown';
    }
    const profile = PROFILES[out.engineProfile] || PROFILES.petrol;
    ['shiftRpm'].forEach((key) => {
        const value = raw[key], range = profile.ranges[key];
        out[key] = typeof value === 'number' && isFinite(value) && value >= range[0] && value <= range[1] ? value : profile[key];
    });
    ['redlineRpm', 'maxRpm', 'torqueScale', 'powerScale'].forEach((key) => { out[key] = profile[key]; });
    // Fixed request ceiling. Retired saved 12/30/60 fps choices never override it.
    if (Object.prototype.hasOwnProperty.call(raw, 'displayTarget')) out.displayTarget = ['map', 'panel', 'hud'].indexOf(raw.displayTarget) >= 0 ? raw.displayTarget : 'unknown';
    if ([60, 65, 70, 75, 80, 85, 90, 100].indexOf(raw.widgetScale) >= 0) out.widgetScale = raw.widgetScale;
    const outputKeys = ['sportClusterOutput', 'sportHudOutput', 'allClusterOutput', 'allHudOutput'];
    outputKeys.forEach((key) => { if (raw[key] !== undefined) out[key] = ['redline', 'stock'].indexOf(raw[key]) >= 0 ? raw[key] : 'stock'; });
    // Direct legacy callers retain their selected single output. The entry
    // migrates persisted choices before the worker reads the new schema.
    if (raw.displayTarget && outputKeys.every((key) => raw[key] === undefined)) {
        ['sport', 'all'].forEach((mode) => {
            out[mode + 'ClusterOutput'] = ['map','panel'].indexOf(raw.displayTarget) >= 0 ? 'redline' : 'stock';
            out[mode + 'HudOutput'] = raw.displayTarget === 'hud' ? 'redline' : 'stock';
        });
    }
    ['cluster', 'hud'].forEach((target) => {
        ['OffsetX', 'OffsetY'].forEach((suffix) => {
            const key = target + suffix, value = raw[key];
            if (typeof value === 'number' && isFinite(value)) out[key] = Math.max(-1000, Math.min(1000, Math.round(value / 10) * 10));
        });
        ['WidthScale', 'HeightScale'].forEach((suffix) => {
            const key = target + suffix, value = raw[key], max = target === 'hud' && suffix === 'HeightScale' ? 150 : 100;
            if (typeof value === 'number' && isFinite(value)) out[key] = Math.max(20, Math.min(max, Math.round(value / 5) * 5));
            else if (target === 'cluster' && typeof raw.widgetScale === 'number') out[key] = out.widgetScale;
        });
    });
    // Red-zone start and shift alert are independent display settings.
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
        let reason = cfg.displayMode === 'all' ? 'all_modes' : 'sport';
        if (!cfg.appEnabled) reason = 'disabled';
        else if (!Object.prototype.hasOwnProperty.call(PROFILES, cfg.engineProfile)) reason = 'profile_unknown';
        else if (!ready) reason = 'renderer_unavailable';
        else if (!fresh(this.modeAt, 3500)) reason = 'mode_unknown';
        else if (cfg.displayMode === 'sport' && SPORT.indexOf(this.mode) < 0) reason = 'not_sport';
        else if (!fresh(this.rpmAt, 1800)) reason = 'rpm_unknown';
        else if (this.rpm < 100) reason = cfg.engineProfile === 'hybrid' ? 'hybrid_engine_stopped' : 'engine_stopped';
        else if (this.rpm > cfg.maxRpm + 1000) reason = 'rpm_invalid';
        else if (cfg.displayMode === 'sport' && (this.sportSince === null || now - this.sportSince < 1000)) reason = 'stabilizing';
        const show = reason === 'sport' || reason === 'all_modes';
        return { show: show, reason: reason, mode: this.mode, rpm: this.rpm,
            shift: show && this.rpm >= cfg.shiftRpm, config: cfg };
    }
}
module.exports = { Policy, DEFAULTS, FRAME_RATE, PROFILES, settings, modeOf, SPORT };
