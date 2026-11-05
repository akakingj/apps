'use strict';
const assert = require('assert');
const { gearbox, selection } = require('../../apps/cluster_redline/gear');
for (let g = 1; g <= 10; g++) {
    assert.strictEqual(gearbox({ statusActualGearDrive: 'G' + g, statusActualStageDrive: 'D' }), String(g));
    assert.strictEqual(gearbox({ statusActualGearDrive: g + 2 }), String(g));
}
for (let g = 1; g <= 9; g++) {
    assert.strictEqual(selection({ statusGearSelectionDrive: '_' + g }), String(g));
    assert.strictEqual(selection({ statusGearSelectionDrive: g + 4 }), String(g));
}
for (const stage of ['P', 'R', 'N']) assert.strictEqual(gearbox({ statusActualStageDrive: stage, statusActualGearDrive: 'G4' }), stage);
assert.strictEqual(selection({ statusGearSelectionDrive: 3 }), 'P');
assert.strictEqual(selection({ statusGearSelectionDrive: 'R' }), 'R');
for (const value of [undefined, null, {}, true, 'INVALID', 0, 255]) {
    assert.strictEqual(gearbox(value), '--');
    assert.strictEqual(selection({ statusGearSelectionDrive: value }), '--');
}
assert.strictEqual(gearbox({ statusActualGearDrive: 'N_OR_P' }), '--');
assert.strictEqual(selection({ statusGearSelectionDrive: 'NP' }), '--');
console.log('PASS: both real gear enums, wire values, P/R/N priority and unknown data without guessed gears');
