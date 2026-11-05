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
module.exports = { gearbox, selection };
