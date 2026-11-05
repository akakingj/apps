'use strict';
const { Canvas } = require('./kit/canvas');
const { PROFILES } = require('./policy');
const W = 1088, H = 480;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function draw(state) {
    const cv = new Canvas(W, H), cfg = state.config, rpm = state.rpm;
    cv.clear('#090d13');
    cv.roundRect(6, 6, W - 12, H - 12, 18, '#131b25');
    cv.roundRect(8, 8, W - 16, H - 16, 17, '#090d13');
    cv.text('REDLINE', W / 2, 47, 32, '#f2f5fa', { align: 'center', font: 'bold', spacing: 3 });
    cv.text((PROFILES[cfg.engineProfile] || PROFILES.petrol).label, 48, 45, 23, '#9eafc7');
    const colors = ['#12dcb1', '#12dcb1', '#12dcb1', '#12dcb1', '#ffdb32', '#ffdb32', '#ffdb32', '#ff3838', '#ff3838', '#ff3838'];
    const lit = Math.floor(clamp((rpm - (cfg.shiftRpm - 2000)) / 2000, 0, 1) * colors.length);
    colors.forEach((color, i) => cv.roundRect(210 + i * 68, 66, 46, 22, 8, state.shift || i < lit ? color : '#202933'));
    cv.text(String(Math.round(rpm / 10) * 10), W / 2, 250, 156, state.shift ? '#ffe085' : '#f2f5fa', { align: 'center', font: 'num' });
    cv.text('rpm', W / 2, 278, 23, '#a6b4c8', { align: 'center' });
    const x0 = 70, width = W - x0 * 2, step = width / 24;
    const fill = clamp(rpm / cfg.maxRpm, 0, 1) * 24;
    for (let i = 0; i < 24; i++) {
        const f = i / 24, color = f >= cfg.redlineRpm / cfg.maxRpm ? '#f33145' : f > 0.72 ? '#ffc735' : '#09c9eb';
        cv.quad([[x0 + i * step + 10, 300], [x0 + (i + 1) * step - 2, 300], [x0 + (i + 1) * step - 12, 344], [x0 + i * step, 344]], i < fill ? color : '#202933');
    }
    for (let r = 0; r <= cfg.maxRpm; r += 1000) {
        const x = x0 + width * r / cfg.maxRpm;
        cv.line(x, 350, x, 358, 2, r >= cfg.redlineRpm ? '#ff384a' : '#79899e');
        cv.text(String(r / 1000), x, 381, 23, r >= cfg.redlineRpm ? '#ff384a' : '#b7c3d2', { align: 'center' });
    }
    if (state.shift) {
        cv.roundRect(110, 402, W - 220, 57, 10, '#5e3b0b');
        cv.text('↑  변속 시점', W / 2, 443, 34, '#ffdc79', { align: 'center', font: 'bold' });
    } else {
        cv.text('SPORT  ·  변속 알림 ' + cfg.shiftRpm + ' rpm', W / 2, 441, 24, '#9eafc7', { align: 'center' });
    }
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
