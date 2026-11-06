'use strict';
const { Canvas } = require('./kit/canvas');
const W = 800, H = 480;
const L = { left: 120, right: 680, alertTop: 36, barTop: 94, barBottom: 126, baseline: 242 };
const RED = '#ff2a2a', WHITE = '#f4f7fb';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function draw(state) {
    const cv = new Canvas(W, H), cfg = state.config;
    cv.clear([0, 0, 0, 0]);
    // Keep the lower half empty for the factory HUD. This does not change its
    // layout or guidance priority; the renderer owns actual slot placement.
    const color = state.shift ? RED : WHITE, span = L.right - L.left;
    const start = Math.max(0, cfg.shiftRpm - Math.min(2000, cfg.shiftRpm * 0.7));
    const lit = state.shift ? 12 : Math.floor(clamp((state.rpm - start) / (cfg.shiftRpm - start), 0, 1) * 12);
    for (let i = 0; i < 12; i++) {
        const tint = i < 6 ? '#19ee67' : i < 9 ? '#ffd522' : RED;
        cv.fillRect(L.left + i * span / 12, L.alertTop, span / 12 - 2, 18, i < lit ? tint : '#000000');
    }
    const end = L.left + span * clamp(state.rpm / cfg.maxRpm, 0, 1);
    cv.fillRect(L.left, L.barTop, span, L.barBottom - L.barTop, '#17212a');
    cv.fillRect(L.left + span * cfg.redlineRpm / cfg.maxRpm, L.barTop,
        span * (1 - cfg.redlineRpm / cfg.maxRpm), L.barBottom - L.barTop, '#4c1621');
    if (end > L.left) cv.fillRect(L.left, L.barTop, end - L.left, L.barBottom - L.barTop, state.shift ? RED : '#25c5ff');
    for (let r = 500; r < cfg.maxRpm; r += 500) {
        const x = L.left + span * r / cfg.maxRpm;
        cv.line(x, L.barTop, x, L.barBottom, 1, '#000000');
    }
    cv.text(String(Math.round(state.rpm / 10) * 10), L.left, L.baseline, 90, color, { font: 'num' });
    cv.text('RPM', L.left, L.baseline + 30, 22, color, { font: 'bold', literal: true });
    const gear = typeof state.gear === 'string' && /^(?:[DSM]?(?:[1-9]|10)|P|R|N|D|--)$/.test(state.gear) ? state.gear : '--';
    cv.text(gear, L.right, L.baseline, 90, WHITE, { font: 'bold', align: 'right' });
    return cv;
}
// Crop four independent regions. Unchanged transparent pixels never enter updates.
function difference(previous, next) {
    const stride = W * 4;
    const rects = [], parts = [];
    [[0, 0, W, 80], [0, 80, W, 150], [0, 150, 480, H], [480, 150, W, H]].forEach((region) => {
        const [x0, top, x1, bottom] = region;
        let left = x1, right = -1, first = H, last = -1;
        for (let y = top; y < bottom; y++) {
            const offset = y * stride;
            if (previous.slice(offset + x0 * 4, offset + x1 * 4).equals(next.slice(offset + x0 * 4, offset + x1 * 4))) continue;
            let a = x0, b = x1 - 1;
            while (a < x1 && previous.readUInt32LE(offset + a * 4) === next.readUInt32LE(offset + a * 4)) a++;
            while (b > a && previous.readUInt32LE(offset + b * 4) === next.readUInt32LE(offset + b * 4)) b--;
            left = Math.min(left, a); right = Math.max(right, b); first = Math.min(first, y); last = y;
        }
        if (last < first) return;
        const r = { x: left, y: first, w: right - left + 1, h: last - first + 1 };
        rects.push(r);
        for (let y = first; y <= last; y++) parts.push(next.slice(y * stride + left * 4, y * stride + (right + 1) * 4));
    });
    return { rects, pixels: Buffer.concat(parts) };
}
module.exports = { draw, difference, W, H, layout: L };
