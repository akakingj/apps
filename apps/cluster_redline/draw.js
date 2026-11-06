'use strict';
const { Canvas, ramp } = require('./kit/canvas');
const { gauges } = require('./units');
const W = 1088, H = 480;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const C = { track: '#1b212b', text: '#f4f7fb', red: '#ff2a2a' };
const L = { left: 220, right: 868, slant: 14, top: 112, bottom: 153 };
function mark(cv, cx, y) {
    ['#38c9ff', '#1653ad', '#ed253c'].forEach((c, i) => {
        const x = cx - 37 + i * 11;
        cv.quad([[x + 8, y], [x + 17, y], [x + 9, y + 22], [x, y + 22]], c);
    });
    cv.polyline([[cx + 1, y + 22], [cx + 7, y + 1], [cx + 13, y + 14], [cx + 25, y + 1], [cx + 19, y + 22]], 5, C.text);
}
function frame(cv, y, lower) {
    const side = lower ? -12 : 12;
    cv.polyline([[98, y + side], [124, y], [499, y]], 1.5, '#8993a0');
    cv.polyline([[589, y], [964, y], [990, y + side]], 1.5, '#8993a0');
    mark(cv, W / 2, y - 11);
}
function mini(cv, x, label, value, unit, maximum, peak, decimals) {
    const w = 200, y = 368, h = 12, slant = 7;
    const valid = typeof value === 'number' && isFinite(value) && value >= 0;
    cv.text(label, x, 344, 18, '#b8c2d1', { font: 'bold' });
    const number = valid ? value.toFixed(decimals || 0) : '--';
    const uw = cv.textWidth(unit, 13, { font: 'label' });
    cv.text(number, x + w - uw - 5, 345, 30, C.text, { align: 'right', font: 'num' });
    cv.text(unit, x + w, 345, 13, '#b8c2d1', { align: 'right' });
    const q = (right, color) => {
        if (right <= 0) return;
        cv.quad([[x + slant, y], [x + slant + right, y], [x + right, y + h], [x, y + h]], color);
    };
    const span = w - slant;
    q(span, C.track);
    if (valid) {
        const fill = span * clamp(value / maximum, 0, 1);
        q(fill, '#1caeff');
        cv.line(x + slant, y - 2, x + slant + span * clamp((peak || value) / maximum, 0, 1), y - 2, 2, C.red);
        cv.line(x + slant + fill, y - 1, x + fill, y + h + 1, 2, C.text);
    }
    [0, 0.5, 1].forEach((f) => {
        const px = x + span * f;
        cv.line(px, y + h + 3, px, y + h + 6, 1, '#a0a9b7');
        cv.text((maximum * f).toFixed(decimals || 0), px, 403, 13, '#c5cdd8', { align: 'center', font: 'num' });
    });
}
function draw(state) {
    const cv = new Canvas(W, H), cfg = state.config, rpm = state.rpm;
    cv.clear([0, 0, 0, 0]); // Preserve the factory cluster through every empty pixel.
    frame(cv, 68, false); frame(cv, 450, true);
    const colors = ['#19ee67', '#19ee67', '#19ee67', '#19ee67', '#19ee67', '#19ee67',
        '#ffd522', '#ffd522', '#ffd522', '#f32d4c', '#f32d4c', '#f32d4c'];
    const start = Math.max(0, cfg.shiftRpm - Math.min(2000, cfg.shiftRpm * 0.7));
    const lit = state.shift ? 12 : Math.floor(clamp((rpm - start) / (cfg.shiftRpm - start), 0, 1) * 12);
    const span = L.right - L.left - L.slant;
    colors.forEach((color, i) => {
        const a = L.left + span * i / 12, b = L.left + span * (i + 1) / 12 - 0.5;
        cv.quad([[a + L.slant, 22], [b + L.slant, 22], [b, 40], [a, 40]], i < lit ? color : '#000000');
    });
    const polygon = (a, b, color) => {
        if (b <= a) return;
        const xa = L.left + span * a / cfg.maxRpm, xb = L.left + span * b / cfg.maxRpm;
        cv.quad([[xa + L.slant, L.top], [xb + L.slant, L.top], [xb, L.bottom], [xa, L.bottom]], color);
    };
    polygon(0, cfg.maxRpm, C.track);
    polygon(cfg.redlineRpm, cfg.maxRpm, '#4c1621');
    const top = clamp(rpm, 0, cfg.maxRpm);
    for (let r = 0; r < top; r += 500) {
        const end = Math.min(r + 500, top);
        if (r < cfg.redlineRpm) polygon(r, Math.min(end, cfg.redlineRpm), ramp(['#1455df', '#1dc8f9', '#be4ee2', '#ed3fa7'], r / cfg.maxRpm));
        if (end > cfg.redlineRpm) polygon(Math.max(r, cfg.redlineRpm), end, C.red);
    }
    for (let r = 500; r < cfg.maxRpm; r += 500) {
        const x = L.left + span * r / cfg.maxRpm;
        cv.line(x + L.slant, L.top, x, L.bottom, 0.7, '#05060a');
    }
    if (top > 0) {
        const x = L.left + span * top / cfg.maxRpm;
        cv.line(x + L.slant, L.top - 2, x, L.bottom + 2, 3, C.text);
    }
    for (let r = 0; r <= cfg.maxRpm; r += 500) {
        const x = L.left + span * r / cfg.maxRpm, major = r % 1000 === 0;
        const color = r >= cfg.redlineRpm ? C.red : '#b8c2d1';
        cv.line(x, L.bottom + 5, x, L.bottom + (major ? 13 : 9), 1, color);
        if (major) cv.text(String(r / 1000), x, 187, 22, color, { align: 'center', font: 'num' });
    }
    const num = String(Math.round(rpm / 10) * 10), size = 78, suffix = 'RPM';
    const nw = cv.textWidth(num, size, { font: 'num' }), sw = cv.textWidth(suffix, 22, { font: 'bold', literal: true });
    const nx = (W - nw - 10 - sw) / 2, tint = state.shift ? C.red : C.text;
    cv.text(num, nx, 270, size, tint, { font: 'num' });
    cv.text(suffix, nx + nw + 10, 270, 22, tint, { font: 'bold', literal: true });
    const gear = typeof state.gear === 'string' && /^(?:[DSM]?(?:[1-9]|10)|P|R|N|D|--)$/.test(state.gear) ? state.gear : '--';
    cv.text(gear, W / 2, 400, 74, C.text, { align: 'center', font: 'bold' });
    const g = gauges(state);
    mini(cv, 265, 'Torque', g.torque.value, g.torque.unit, g.torque.maximum, g.torque.peak, g.torque.decimals);
    mini(cv, 623, 'Power*', g.power.value, g.power.unit, g.power.maximum, g.power.peak, g.power.decimals);
    return cv;
}
// Four independent horizontal regions keep updates below the link budget.
function difference(previous, next) {
    const stride = W * 4, rects = [], parts = [];
    const regions = [[0, 0, W, 90], [0, 90, W, 205], [0, 205, W, 308],
        [0, 308, 480, H], [480, 308, 608, H], [608, 308, W, H]];
    regions.forEach((region) => {
        const [x0, top, x1, bottom] = region;
        let left = x1, right = -1, first = H, last = -1;
        for (let y = top; y < bottom; y++) {
            const off = y * stride;
            if (previous.slice(off + x0 * 4, off + x1 * 4).equals(next.slice(off + x0 * 4, off + x1 * 4))) continue;
            let a = x0, b = x1 - 1;
            while (a < x1 && previous.readUInt32LE(off + a * 4) === next.readUInt32LE(off + a * 4)) a++;
            while (b > a && previous.readUInt32LE(off + b * 4) === next.readUInt32LE(off + b * 4)) b--;
            left = Math.min(left, a); right = Math.max(right, b); first = Math.min(first, y); last = y;
        }
        if (last < first) return;
        const r = { x: left, y: first, w: right - left + 1, h: last - first + 1 };
        rects.push(r);
        for (let y = r.y; y < r.y + r.h; y++) parts.push(next.slice(y * stride + r.x * 4, y * stride + (r.x + r.w) * 4));
    });
    return { rects: rects, pixels: Buffer.concat(parts) };
}
module.exports = { draw, difference, W, H, layout: L };
