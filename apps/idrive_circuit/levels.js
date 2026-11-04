'use strict';

/** Deterministic level set.  The later boards are generated from seeded grid trees at load time. */
const P = require('./puzzle');

const NAMES = [
    'First Light', 'Two Devices', 'Signal Bend', 'Split Current', 'Workshop',
    'Cold Start', 'Junction Box', 'Night Drive', 'Sensor Check', 'Power Bus',
    'Motor Control', 'Branch Test', 'Fuse Path', 'Wake Sequence', 'Control Rack',
    'High Beam', 'Charge Route', 'Data Link', 'Service Bay', 'Relay Logic',
    'Power Grid', 'Signal Flow', 'Test Bench', 'Main Harness', 'Energy Loop',
    'Module Wake', 'Bus Network', 'Full System', 'Final Check', 'Circuit Master',
];

function rng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function popcount(v) { let n = 0; for (; v; v &= v - 1) n++; return n; }

function typeForMask(mask) {
    const n = popcount(mask);
    if (n === 1) return 'end';
    if (n === 3) return 'tee';
    if (n === 4) return 'cross';
    return (mask === 5 || mask === 10) ? 'line' : 'elbow';
}

function rotationFor(type, mask) {
    for (let r = 0; r < 4; r++) if (P.rotateMask(P.BASE_MASK[type], r) === mask) return r;
    throw new Error('No rotation for ' + type + ' mask ' + mask);
}

function cellsFromEdges(rows, cols, edges, source, offsets) {
    const masks = new Array(rows * cols).fill(0);
    edges.forEach((e) => {
        const a = e[0], b = e[1], d = b - a;
        if (d === 1) { masks[a] |= 2; masks[b] |= 8; }
        else if (d === -1) { masks[a] |= 8; masks[b] |= 2; }
        else if (d === cols) { masks[a] |= 4; masks[b] |= 1; }
        else if (d === -cols) { masks[a] |= 1; masks[b] |= 4; }
        else throw new Error('Non-adjacent edge ' + a + '-' + b);
    });
    const leaves = masks.map((m, i) => popcount(m) === 1 ? i : -1).filter((i) => i >= 0);
    let device = 0;
    return masks.map((mask, i) => {
        if (!mask) return null;
        const type = typeForMask(mask), goal = rotationFor(type, mask);
        const role = i === source ? 'source' : leaves.indexOf(i) >= 0 ? 'sink' : 'wire';
        const fixed = role !== 'wire' || type === 'cross';
        const off = offsets && offsets[i] != null ? offsets[i] : fixed ? 0 : 1;
        return {
            type, goal, start: (goal + off) & 3, role, fixed,
            device: role === 'sink' ? ['headlight', 'motor', 'sensor'][device++ % 3] : null,
        };
    });
}

function parFor(cells) {
    return cells.reduce((sum, c) => sum + (c && !c.fixed ? P.clockwiseDistance(c, c.start, c.goal) : 0), 0);
}

function manual(id, name, rows, cols, edges, source, offsets, note) {
    const cells = cellsFromEdges(rows, cols, edges, source, offsets);
    return { id, name, rows, cols, cells, par: parFor(cells), note };
}

function gridTree(rows, cols, seed) {
    for (let attempt = 0; attempt < 80; attempt++) {
        const random = rng(seed + attempt * 977), seen = new Array(rows * cols).fill(false), stack = [0], edges = [], degree = new Array(rows * cols).fill(0);
        seen[0] = true;
        while (stack.length) {
            const a = stack[stack.length - 1], r = Math.floor(a / cols), c = a % cols;
            const next = [];
            if (r) next.push(a - cols);
            if (c < cols - 1) next.push(a + 1);
            if (r < rows - 1) next.push(a + cols);
            if (c) next.push(a - 1);
            for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)), v = next[i]; next[i] = next[j]; next[j] = v; }
            const b = next.find((v) => !seen[v]);
            if (b == null) { stack.pop(); continue; }
            seen[b] = true; stack.push(b); edges.push([a, b]); degree[a]++; degree[b]++;
        }
        if (degree.every((d) => d <= 3)) return { edges, degree, random };
    }
    throw new Error('Could not generate circuit tree');
}

function generated(id, name, rows, cols, seed, scramble) {
    const built = gridTree(rows, cols, seed), leaves = built.degree.map((d, i) => d === 1 ? i : -1).filter((i) => i >= 0);
    leaves.sort((a, b) => (a % cols) - (b % cols) || Math.floor(a / cols) - Math.floor(b / cols));
    const source = leaves[0], cells = cellsFromEdges(rows, cols, built.edges, source, {}), random = built.random;
    let wrong = 0;
    cells.forEach((cell) => {
        if (!cell || cell.fixed) return;
        if (random() > scramble) { cell.start = cell.goal; return; }
        const options = [];
        for (let r = 0; r < 4; r++) if (!P.equivalent(cell, r, cell.goal)) options.push(r);
        cell.start = options[Math.floor(random() * options.length)]; wrong++;
    });
    if (!wrong) {
        const cell = cells.find((c) => c && !c.fixed);
        if (cell) cell.start = (cell.goal + 1) & 3;
    }
    return {
        id, name, rows, cols, cells, par: parFor(cells),
        note: rows >= 5 ? 'Restore the complete vehicle network' : 'Power every module with no open connection',
    };
}

const levels = [
    manual('L01', NAMES[0], 1, 3, [[0, 1], [1, 2]], 0, { 1: 1 }, 'Rotate the centre wire to power the headlight'),
    manual('L02', NAMES[1], 2, 3, [[0, 1], [1, 2], [1, 4], [4, 5]], 0, { 1: 1, 4: 2 }, 'A branch can power more than one device'),
    manual('L03', NAMES[2], 3, 4, [[0, 1], [1, 2], [2, 3], [2, 6], [6, 5], [5, 4], [6, 7], [7, 11], [11, 10], [10, 9], [9, 8]], 0,
        { 1: 1, 2: 3, 5: 2, 6: 1, 7: 3, 9: 1, 10: 2, 11: 1 }, 'Follow the glow from the battery'),
];

for (let n = 4; n <= 30; n++) {
    let rows, cols;
    if (n <= 5) { rows = 3; cols = n === 4 ? 5 : 6; }
    else if (n <= 10) { rows = 4; cols = 5; }
    else if (n <= 20) { rows = 4; cols = 6; }
    else if (n <= 25) { rows = 4; cols = 7; }
    else { rows = 5; cols = 8; }
    const scramble = Math.min(0.78, 0.42 + n * 0.012);
    levels.push(generated('L' + (n < 10 ? '0' : '') + n, NAMES[n - 1], rows, cols, 0xC1A000 + n * 7919, scramble));
}

module.exports = levels;

