'use strict';
// A requested layer is not proof of visibility. Report native map acquisition,
// never claim that a physical cluster/HUD frame has been observed.
function mapStatus(state) {
    if (!state || !state.requested || state.targetName !== 'map') return null;
    if (state.targetState === 'shown') return state.guidanceDisabled ? 'Guidance hide unavailable' : 'Map slot acquired';
    if (state.targetState === 'parked' || state.targetHolder === 'stock') return 'Waiting for stock map release';
    return 'Waiting for map acquisition';
}
module.exports = { mapStatus };
