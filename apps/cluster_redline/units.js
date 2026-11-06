'use strict';
// Keep ECU samples and peaks in Nm / metric PS; convert values AND scales on drawing.
const PS_TO_KW = 0.73549875, NM_PER_KGFM = 9.80665;
function convert(value, factor) { return typeof value === 'number' && isFinite(value) ? value * factor : null; }
function gauges(state) {
    const cfg = state.config;
    const tf = cfg.torqueUnit === 'kgfm' ? 1 / NM_PER_KGFM : 1;
    const pf = cfg.powerUnit === 'kW' ? PS_TO_KW : 1;
    return {
        torque: { value: convert(state.torqueNm, tf), peak: convert(state.torquePeak, tf), maximum: cfg.torqueScale * tf, unit: tf === 1 ? 'Nm' : 'kgf·m', decimals: tf === 1 ? 0 : 1 },
        power: { value: convert(state.powerPS, pf), peak: convert(state.powerPeak, pf), maximum: cfg.powerScale * pf, unit: cfg.powerUnit, decimals: 0 },
    };
}
module.exports = { gauges, PS_TO_KW, NM_PER_KGFM };
