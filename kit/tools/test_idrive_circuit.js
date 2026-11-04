'use strict';

// iDrive Circuit's pure puzzle rules and all deterministic levels.  No SDK, renderer or car needed:
//   node kit/tools/test_idrive_circuit.js
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const Puzzle = require(path.join(ROOT, 'apps/idrive_circuit/puzzle'));
const levels = require(path.join(ROOT, 'apps/idrive_circuit/levels'));

assert.strictEqual(levels.length, 30, 'level count');
assert.strictEqual(new Set(levels.map((l) => l.id)).size, levels.length, 'unique level ids');

levels.forEach((level, levelIndex) => {
    assert(level.rows >= 1 && level.cols >= 3, level.id + ': dimensions');
    assert.strictEqual(level.cells.length, level.rows * level.cols, level.id + ': cell count');
    assert.strictEqual(level.cells.filter((c) => c && c.role === 'source').length, 1, level.id + ': source');
    assert(level.cells.some((c) => c && c.role === 'sink'), level.id + ': sink');

    const goal = level.cells.map((c) => c ? c.goal : 0);
    const solved = Puzzle.analyse(level, goal);
    assert(solved.complete, level.id + ': goal must solve the board');
    assert.strictEqual(solved.leaks, 0, level.id + ': goal leaks');

    const start = level.cells.map((c) => c ? c.start : 0);
    assert(!Puzzle.analyse(level, start).complete, level.id + ': initial board must not already be solved');
    const par = level.cells.reduce((n, c) => n + (c && !c.fixed ? Puzzle.clockwiseDistance(c, c.start, c.goal) : 0), 0);
    assert.strictEqual(level.par, par, level.id + ': par is the direct clockwise solution');
    assert(level.par > 0, level.id + ': useful puzzle');

    // Repeated hints rotate one wrong tile a step towards its goal and must solve every shipped level.
    const game = new Puzzle.Game(levels, levelIndex);
    let guard = 0;
    while (!game.analysis.complete && guard++ < 300) assert(game.hint(), level.id + ': hint made progress');
    assert(game.analysis.complete, level.id + ': hints solve the level');
    assert.strictEqual(game.moves, level.par, level.id + ': hints follow the par route');
    assert.strictEqual(game.stars(), 2, level.id + ': hints cap the score at two stars');
});

// Rotate, persistence payload and undo restore the exact previous state.
const game = new Puzzle.Game(levels, 4), index = game.rotatableIndices()[0];
const before = game.state(), beforeMask = Puzzle.maskFor(game.level.cells[index], game.rotations[index]);
assert(game.rotate(index));
assert.notStrictEqual(Puzzle.maskFor(game.level.cells[index], game.rotations[index]), beforeMask, 'rotation changes the connector mask');
const saved = game.state();
const restored = new Puzzle.Game(levels, 4, saved);
assert.deepStrictEqual(restored.rotations, game.rotations, 'saved rotations');
assert.strictEqual(restored.moves, game.moves, 'saved move count');
assert(game.undo());
assert.deepStrictEqual(game.rotations, before.rotations, 'undo rotations');
assert.strictEqual(game.moves, before.moves, 'undo move count');

console.log('PASS: iDrive Circuit puzzle rules, persistence, undo, scoring and 30 solvable levels');

