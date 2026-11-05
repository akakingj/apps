'use strict';
// Enum mappings match upstream kit/runtime/car.js. No ratio-based guessing.
function gearbox(value) {
    value = value || {};
    const raw = value.statusActualGearDrive, stage = value.statusActualStageDrive;
    const stages = { P: 'P', R: 'R', N: 'N', D: 'D', 1: 'P', 2: 'R', 3: 'N', 4: 'D' };
    const s = (typeof stage === 'string' || typeof stage === 'number') && stages[stage];
    if (s === 'P' || s === 'R' || s === 'N') return s;
    const gears = { G1: 1, G2: 2, G3: 3, G4: 4, G5: 5, G6: 6, G7: 7, G8: 8, G9: 9, G10: 10 };
    const g = typeof raw === 'number' && raw === Math.floor(raw) && raw >= 3 && raw <= 12 ? raw - 2 :
        typeof raw === 'string' && Object.prototype.hasOwnProperty.call(gears, raw) ? gears[raw] : null;
    if (g !== null) return String(g);
    if (raw === 1 || raw === 'R') return 'R';
    return s === 'D' ? 'D' : '--'; // N_OR_P by itself does not distinguish park and neutral.
}
function selection(value) {
    const raw = value && value.statusGearSelectionDrive;
    const positions = { P: 'P', R: 'R', N: 'N', 1: 'N', 2: 'R', 3: 'P' };
    if ((typeof raw === 'number' || typeof raw === 'string') && Object.prototype.hasOwnProperty.call(positions, raw)) return positions[raw];
    if (typeof raw === 'number' && raw === Math.floor(raw) && raw >= 5 && raw <= 13) return String(raw - 4);
    if (typeof raw === 'string' && /^_[1-9]$/.test(raw)) return raw.slice(1);
    return '--';
}
function programme(value) {
    // Only selector fields; Sport driving mode alone does not mean S gearbox mode.
    for (const key of Object.keys(value || {})) {
        if (key === 'statusActualGearDrive' || !/program|mode|selector|manual|sport|tip/i.test(key)) continue;
        const raw = value[key];
        if (raw === true || raw === 1) {
            if (/manual|tip/i.test(key)) return 'M';
            if (/sport/i.test(key)) return 'S';
        }
        if (typeof raw !== 'string' || /NOT|INVALID|UNKNOWN|INACTIVE|OFF|NO_/i.test(raw)) continue;
        if (/^(M|MANUAL|M_MINUS_PROGRAMM|TIPP|TIPTRONIC)$/.test(raw)) return 'M';
        if (/^(S|DS|SPORT|S_MINUS_PROGRAMM)$/.test(raw)) return 'S';
        if (/^(D|DRIVE|AUTOMATIC)$/.test(raw)) return 'D';
    }
    return null;
}
function display(gear, mode, override) {
    if (/^(P|R|N|--)$/.test(gear)) return gear;
    const match = /^(?:[DSM])?([1-9]|10)$/.exec(String(gear));
    if (!match) return gear === 'D' ? 'D' : '--';
    const prefix = ['D', 'S', 'M'].indexOf(override) >= 0 ? override : ['D', 'S', 'M'].indexOf(mode) >= 0 ? mode : /^[DSM]/.test(gear) ? gear[0] : '';
    return prefix + match[1];
}
module.exports = { gearbox, selection, programme, display };
