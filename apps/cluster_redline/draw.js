'use strict';
const { Canvas, ramp, withAlpha } = require('./kit/canvas');
const W = 1088, H = 480;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const C = { bg: '#04060a', track: '#1b212b', tick: '#4c5666', text: '#f4f7fb', red: '#ff2a2a' };
function draw(state) {
    const cv = new Canvas(W, H), cfg = state.config, rpm = state.rpm;
    cv.clear(C.bg);
    // Match the original M Tricolour Redline: angular chrome and no title/footer.
    cv.polyline([[16, 77], [113, 77], [150, 103], [938, 103], [975, 77], [1072, 77]], 2, '#394452');
    cv.polyline([[150, 103], [938, 103]], 2, '#707b8b');
    cv.polyline([[16, 464], [113, 464], [150, 441], [426, 441]], 2, '#394452');
    cv.polyline([[662, 441], [938, 441], [975, 464], [1072, 464]], 2, '#394452');
    const colors = ['#19ee67', '#19ee67', '#19ee67', '#19ee67', '#19ee67',
        '#ffd522', '#ffd522', '#ffd522', '#ffd522', '#f32d4c', '#f32d4c', '#f32d4c'];
    const start = Math.max(0, cfg.shiftRpm - Math.min(2000, cfg.shiftRpm * 0.7));
    const lit = state.shift ? colors.length : Math.floor(clamp((rpm - start) / (cfg.shiftRpm - start), 0, 1) * colors.length);
    const ledW = 50, gap = 14, left = (W - colors.length * ledW - (colors.length - 1) * gap) / 2;
    colors.forEach((color, i) => {
        const x = left + i * (ledW + gap);
        cv.roundRect(x - 3, 25, ledW + 6, 35, 7, withAlpha(color, i < lit ? 0.11 : 0.02));
        cv.roundRect(x, 28, ledW, 29, 5, i < lit ? color : withAlpha(color, 0.13));
    });
    const rw = cv.text(String(Math.round(rpm / 10) * 10), W / 2, 205, 112,
        state.shift ? C.red : C.text, { align: 'center', font: 'num' });
    cv.text('rpm', W / 2 + rw / 2 + 12, 205, 24, state.shift ? C.red : '#a3afc0', { font: 'bold' });
    const x0 = 60, width = W - 120, y0 = 229, y1 = 290, slant = 20;
    const polygon = (a, b, color) => {
        const xa = x0 + width * a / cfg.maxRpm, xb = x0 + width * b / cfg.maxRpm;
        cv.quad([[xa + slant, y0], [xb + slant, y0], [xb, y1], [xa, y1]], color);
    };
    polygon(0, cfg.maxRpm, C.track);
    polygon(cfg.redlineRpm, cfg.maxRpm, '#4c1621');
    const hot = ['#1f5fd0', '#159cff', '#20c9ff', '#c04cdc', '#f12c65'];
    const top = Math.min(rpm, cfg.maxRpm);
    for (let r = 0; r < top; r += 500) polygon(r, Math.min(r + 500, top), (state.shift || r >= cfg.redlineRpm) ? C.red : ramp(hot, clamp(r / cfg.shiftRpm, 0, 1)));
    for (let r = 500; r < cfg.maxRpm; r += 500) {
        const x = x0 + width * r / cfg.maxRpm;
        cv.quad([[x + slant - 1, y0], [x + slant + 1, y0], [x + 1, y1], [x - 1, y1]], C.bg);
    }
    if (top > 0) {
        const x = x0 + width * top / cfg.maxRpm;
        cv.line(x + slant, y0 - 3, x, y1 + 3, 5, state.shift ? C.red : '#f4f7fb');
    }
    for (let r = 0; r <= cfg.maxRpm; r += 500) {
        const x = x0 + width * r / cfg.maxRpm, major = r % 1000 === 0, color = r >= cfg.redlineRpm ? '#f32d4c' : '#b8c2d1';
        cv.line(x, y1 + 6, x, y1 + (major ? 18 : 13), major ? 2 : 1, color);
        if (major) cv.text(String(r / 1000), x, y1 + 41, 24, color, { align: 'center', font: 'bold' });
    }
    [[cfg.shiftRpm, '#ffd522'], [cfg.redlineRpm, '#f32d4c']].forEach((mark) => {
        const x = x0 + width * mark[0] / cfg.maxRpm + slant;
        cv.line(x, y0 - 12, x, y0 - 4, 4, mark[1]);
    });
    const gear = typeof state.gear === 'string' && /^(?:[1-9]|10|P|R|N|D|--)$/.test(state.gear) ? state.gear : '--';
    cv.text(gear, W / 2, 453, gear.length > 1 ? 118 : 148, C.text, { align: 'center', font: 'gear' });
    return cv;
}
// Four independent horizontal regions keep updates below the link budget.
function difference(previous, next) {
    const stride = W * 4, rects = [], parts = [];
    [0, 94, 282, 392].forEach((top, band) => {
        const bottom = [94, 282, 392, H][band];
        let left = W, right = -1, first = H, last = -1;
        for (let y = top; y < bottom; y++) {
            const off = y * stride;
            if (previous.slice(off, off + stride).equals(next.slice(off, off + stride))) continue;
            let a = 0, b = W - 1;
            while (a < W && previous.readUInt32LE(off + a * 4) === next.readUInt32LE(off + a * 4)) a++;
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
module.exports = { draw, difference, W, H };
