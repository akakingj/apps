'use strict';

/**
 * Pure puzzle model for iDrive Circuit.  It deliberately knows nothing about
 * the HMI, vehicle signals or files, so the rules can be tested on a PC.
 *
 * Connector bits: N=1, E=2, S=4, W=8.  A tile is powered only when both ends
 * of every traversed connection agree.  A solved board powers every tile and
 * has no connector pointing into a wall or the blank side of another tile.
 */

const DIRS = [
    { bit: 1, opposite: 4, dr: -1, dc: 0 },
    { bit: 2, opposite: 8, dr: 0, dc: 1 },
    { bit: 4, opposite: 1, dr: 1, dc: 0 },
    { bit: 8, opposite: 2, dr: 0, dc: -1 },
];

const BASE_MASK = { end: 1, line: 5, elbow: 3, tee: 11, cross: 15 };

function normRot(v) { return ((Number(v) || 0) % 4 + 4) % 4; }

function rotateMask(mask, turns) {
    const r = normRot(turns);
    return r ? ((mask << r) | (mask >> (4 - r))) & 15 : mask & 15;
}

function maskFor(cell, rotation) {
    return rotateMask(BASE_MASK[cell.type] || 0, rotation);
}

function equivalent(cell, a, b) { return maskFor(cell, a) === maskFor(cell, b); }

function clockwiseDistance(cell, from, to) {
    for (let d = 0; d < 4; d++) if (equivalent(cell, normRot(from) + d, to)) return d;
    return 0;
}

function neighbour(level, index, dir) {
    const r = Math.floor(index / level.cols) + dir.dr;
    const c = index % level.cols + dir.dc;
    return r < 0 || c < 0 || r >= level.rows || c >= level.cols ? -1 : r * level.cols + c;
}

function analyse(level, rotations) {
    const cells = level.cells;
    const active = [];
    let source = -1;
    for (let i = 0; i < cells.length; i++) {
        if (!cells[i]) continue;
        active.push(i);
        if (cells[i].role === 'source') source = i;
    }

    const powered = new Set();
    const queue = [];
    if (source >= 0) { powered.add(source); queue.push(source); }
    while (queue.length) {
        const i = queue.shift(), cell = cells[i], mask = maskFor(cell, rotations[i]);
        DIRS.forEach((dir) => {
            if (!(mask & dir.bit)) return;
            const j = neighbour(level, i, dir), next = j >= 0 ? cells[j] : null;
            if (!next || !(maskFor(next, rotations[j]) & dir.opposite) || powered.has(j)) return;
            powered.add(j); queue.push(j);
        });
    }

    let leaks = 0, matchedEdges = 0, sinks = 0, poweredSinks = 0;
    active.forEach((i) => {
        const cell = cells[i], mask = maskFor(cell, rotations[i]);
        if (cell.role === 'sink') { sinks++; if (powered.has(i)) poweredSinks++; }
        DIRS.forEach((dir) => {
            if (!(mask & dir.bit)) return;
            const j = neighbour(level, i, dir), next = j >= 0 ? cells[j] : null;
            if (!next || !(maskFor(next, rotations[j]) & dir.opposite)) leaks++;
            else if (i < j) matchedEdges++;
        });
    });

    return {
        powered,
        poweredCount: powered.size,
        activeCount: active.length,
        sinks,
        poweredSinks,
        leaks,
        matchedEdges,
        complete: source >= 0 && powered.size === active.length && leaks === 0,
    };
}

function goalDistances(level) {
    const cells = level.cells, out = new Array(cells.length).fill(1e9), queue = [];
    let source = cells.findIndex((c) => c && c.role === 'source');
    if (source < 0) return out;
    out[source] = 0; queue.push(source);
    while (queue.length) {
        const i = queue.shift(), mask = maskFor(cells[i], cells[i].goal);
        DIRS.forEach((dir) => {
            if (!(mask & dir.bit)) return;
            const j = neighbour(level, i, dir);
            if (j < 0 || !cells[j] || out[j] <= out[i] + 1) return;
            if (!(maskFor(cells[j], cells[j].goal) & dir.opposite)) return;
            out[j] = out[i] + 1; queue.push(j);
        });
    }
    return out;
}

class Game {
    constructor(levels, levelIndex, saved) {
        if (!levels || !levels.length) throw new Error('No circuit levels');
        this.levels = levels;
        this.setLevel(levelIndex || 0, saved);
    }

    setLevel(index, saved) {
        this.levelIndex = Math.max(0, Math.min(this.levels.length - 1, Number(index) || 0));
        this.level = this.levels[this.levelIndex];
        this.rotations = this.level.cells.map((c) => c ? normRot(c.start) : 0);
        this.moves = 0;
        this.hintsUsed = 0;
        this.history = [];
        this.lastChanged = -1;
        if (saved && saved.levelId === this.level.id && Array.isArray(saved.rotations) && saved.rotations.length === this.rotations.length) {
            this.rotations = saved.rotations.map(normRot);
            this.moves = Math.max(0, Number(saved.moves) || 0);
            this.hintsUsed = Math.max(0, Number(saved.hintsUsed) || 0);
            this.history = Array.isArray(saved.history) ? saved.history.slice(-80).filter((h) => h && this.isRotatable(h.index)).map((h) => ({
                index: h.index,
                rotation: normRot(h.rotation),
                moves: Math.max(0, Number(h.moves) || 0),
                hintsUsed: Math.max(0, Number(h.hintsUsed) || 0),
            })) : [];
        }
        this.analysis = analyse(this.level, this.rotations);
        this._goalDistances = goalDistances(this.level);
        return this;
    }

    isRotatable(index) {
        const c = this.level.cells[index];
        return !!(c && !c.fixed && c.type !== 'cross');
    }

    rotatableIndices() {
        const out = [];
        for (let i = 0; i < this.level.cells.length; i++) if (this.isRotatable(i)) out.push(i);
        return out;
    }

    _turn(index, hint) {
        if (!this.isRotatable(index) || this.analysis.complete) return false;
        this.history.push({ index, rotation: this.rotations[index], moves: this.moves, hintsUsed: this.hintsUsed });
        if (this.history.length > 80) this.history.shift();
        this.rotations[index] = normRot(this.rotations[index] + 1);
        this.moves++;
        if (hint) this.hintsUsed++;
        this.lastChanged = index;
        this.analysis = analyse(this.level, this.rotations);
        return true;
    }

    rotate(index) { return this._turn(index, false); }

    undo() {
        const h = this.history.pop();
        if (!h) return false;
        this.rotations[h.index] = h.rotation;
        this.moves = h.moves;
        this.hintsUsed = h.hintsUsed;
        this.lastChanged = h.index;
        this.analysis = analyse(this.level, this.rotations);
        return true;
    }

    hint() {
        if (this.analysis.complete) return false;
        const wrong = this.rotatableIndices().filter((i) => !equivalent(this.level.cells[i], this.rotations[i], this.level.cells[i].goal));
        wrong.sort((a, b) => this._goalDistances[a] - this._goalDistances[b] || a - b);
        return wrong.length ? this._turn(wrong[0], true) : false;
    }

    restart() {
        this.rotations = this.level.cells.map((c) => c ? normRot(c.start) : 0);
        this.moves = 0;
        this.hintsUsed = 0;
        this.history = [];
        this.lastChanged = -1;
        this.analysis = analyse(this.level, this.rotations);
        return true;
    }

    stars() {
        if (!this.analysis.complete) return 0;
        let n = this.moves <= this.level.par ? 3 : this.moves <= this.level.par + 3 ? 2 : 1;
        if (this.hintsUsed && n > 2) n = 2;
        return n;
    }

    state() {
        return {
            levelId: this.level.id,
            rotations: this.rotations.slice(),
            moves: this.moves,
            hintsUsed: this.hintsUsed,
            history: this.history.slice(-80),
        };
    }
}

module.exports = {
    DIRS,
    BASE_MASK,
    normRot,
    rotateMask,
    maskFor,
    equivalent,
    clockwiseDistance,
    analyse,
    Game,
};

