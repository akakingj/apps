'use strict';
// Enum mappings match upstream kit/runtime/car.js. No ratio-based guessing.
function gearbox(value) {
    value = value || {};
    const raw = value.statusActualGearDrive, stage = value.statusActualStageDrive;
    const direct = typeof raw === 'string' && /^([DSM])(?:[1-9]|10)$/.test(raw.toUpperCase());
    const stages = { P: 'P', R: 'R', N: 'N', D: 'D', 1: 'P', 2: 'R', 3: 'N', 4: 'D' };
    const s = (typeof stage === 'string' || typeof stage === 'number') && stages[stage];
    if (s === 'P' || s === 'R' || s === 'N') return s;
    if (direct) return raw.toUpperCase();
    const gears = { G1: 1, G2: 2, G3: 3, G4: 4, G5: 5, G6: 6, G7: 7, G8: 8, G9: 9, G10: 10 };
    const g = typeof raw === 'number' && raw === Math.floor(raw) && raw >= 3 && raw <= 12 ? raw - 2 :
        typeof raw === 'string' && Object.prototype.hasOwnProperty.call(gears, raw) ? gears[raw] : null;
    if (g !== null) return String(g);
    if (raw === 1 || raw === 'R') return 'R';
    return s === 'D' ? 'D' : '--'; // N_OR_P by itself does not distinguish park and neutral.
}
function selection(value) {
    const raw = value && value.statusGearSelectionDrive;
    if (typeof raw === 'string' && /^(?:[DSM](?:[1-9]|10)?|DS)$/.test(raw.toUpperCase())) return raw.toUpperCase() === 'DS' ? 'S' : raw.toUpperCase();
    const positions = { P: 'P', R: 'R', N: 'N', 1: 'N', 2: 'R', 3: 'P' };
    if ((typeof raw === 'number' || typeof raw === 'string') && Object.prototype.hasOwnProperty.call(positions, raw)) return positions[raw];
    if (typeof raw === 'number' && raw === Math.floor(raw) && raw >= 5 && raw <= 13) return String(raw - 4);
    if (typeof raw === 'string' && /^_[1-9]$/.test(raw)) return raw.slice(1);
    return '--';
}
function programme(value) {
    // Only selector fields; Sport driving mode alone does not mean S gearbox mode.
    for (const name of ['statusActualGearDrive', 'statusGearSelectionDrive', 'statusActualStageDrive']) {
        const direct = value && value[name];
        if (typeof direct === 'string' && /^[DSM](?:[1-9]|10)?$/.test(direct.toUpperCase())) return direct[0].toUpperCase();
    }
    for (const key of Object.keys(value || {})) {
        if (key === 'statusActualGearDrive' || !/program|mode|selector|manual|sport|tip/i.test(key)) continue;
        const raw = value[key];
        if (raw === true || raw === 1) {
            if (/manual|tip/i.test(key)) return 'M';
            if (/sport/i.test(key)) return 'S';
        }
        if (typeof raw !== 'string' || /NOT|INVALID|UNKNOWN|INACTIVE|OFF|NO_/i.test(raw)) continue;
        const mode = raw.toUpperCase();
        if (/^(M|M[1-9]|MANUAL|M_MINUS_PROGRAMM|TIPP|TIPTRONIC)$/.test(mode)) return 'M';
        if (/^(S|S[1-9]|DS|SPORT|S_MINUS_PROGRAMM)$/.test(mode)) return 'S';
        if (/^(D|D[1-9]|DRIVE|AUTOMATIC)$/.test(mode)) return 'D';
    }
    return null;
}
function display(gear, mode, override) {
    if (/^(P|R|N|--)$/.test(gear)) return gear;
    const match = /^(?:[DSM])?([1-9]|10)$/.exec(String(gear));
    if (!match) return /^[DSM]$/.test(gear) ? (['D', 'S', 'M'].indexOf(override) >= 0 ? override : mode || gear) : '--';
    const prefix = ['D', 'S', 'M'].indexOf(override) >= 0 ? override : ['D', 'S', 'M'].indexOf(mode) >= 0 ? mode : /^[DSM]/.test(gear) ? gear[0] : '';
    return prefix + match[1];
}
class GearState {
    constructor() { this.clear(); }
    clear() { this.gear = '--'; this.mode = null; this.programMode = null; this.samples = {}; }
    sample(source, value) {
        const diagnostic = {};
        Object.keys(value || {}).filter((key) => /gear|program|stage|selector|manual|sport|tip|mode|range/i.test(key)).slice(0, 20).forEach((key) => {
            const v = value[key];
            if (v === null || ['string', 'number', 'boolean'].indexOf(typeof v) >= 0) diagnostic[key] = typeof v === 'string' ? v.slice(0, 96) : v;
        });
        if (source === 'programme') {
            const raw = value && value.displayProgramGearbox;
            this.programMode = raw === 1 || raw === 'S_MINUS_PROGRAMM' || raw === 'S' ? 'S' :
                raw === 2 || raw === 'M_MINUS_PROGRAMM' || raw === 'M' ? 'M' : raw === 'D' ? 'D' : null;
            this.samples.programme = { value: diagnostic, mode: this.programMode }; return;
        }
        const parsed = source === 'gearbox' ? gearbox(value) : selection(value);
        const mode = programme(value);
        // Preserve raw selector fields for a diagnostic photo/log, never VIN.
        this.samples[source] = { value: diagnostic, parsed: parsed, mode: mode };
        if (parsed === '--') {
            const raw = value && value[source === 'gearbox' ? 'statusActualGearDrive' : 'statusGearSelectionDrive'];
            if (source === 'gearbox' ? raw === 'N_OR_P' || raw === 2 : raw === 'NP' || raw === 4) {
                this.gear = '--'; this.mode = null; this.programMode = null;
            }
            return; // An absent field cannot erase the other signal.
        }
        if (/^[PRN]$/.test(parsed)) { this.gear = parsed; this.mode = null; return; }
        if (/^[DSM]$/.test(parsed)) {
            if (!/^(?:[DSM])?(?:[1-9]|10)$/.test(this.gear)) this.gear = parsed;
        } else this.gear = parsed;
        if (mode) this.mode = mode;
        // Standard engaged-gear enums identify forward drive. Keep a received
        // S/M programme, but show D rather than an unexplained bare number when
        // the car supplies only its ordinary drive-stage/selection enum.
        else if (!this.mode && (/^(?:[1-9]|10)$/.test(parsed) || parsed === 'D')) this.mode = 'D';
    }
}
module.exports = { gearbox, selection, programme, display, GearState };
