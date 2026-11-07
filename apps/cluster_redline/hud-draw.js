'use strict';
const { Canvas } = require('./kit/canvas');
const cluster = require('./draw');
// Both displays use the same face: layout, blue/cyan/pink RPM ramp, shift LEDs, gear, units and
// M marks. Independent width/height controls still choose the physical size.
const W = 800, H = 353;
const scale = Math.min(W / cluster.W, H / cluster.H);
const faceW = Math.round(cluster.W * scale), faceH = Math.round(cluster.H * scale);
const offsetX = Math.round((W - faceW) / 2), offsetY = Math.round((H - faceH) / 2);
const scaleX = faceW / cluster.W, scaleY = faceH / cluster.H;
const L = { left: offsetX + cluster.layout.left * scaleX, right: offsetX + cluster.layout.right * scaleX,
    top: cluster.layout.top * scaleY, bottom: cluster.layout.bottom * scaleY,
    baseline: 270 * scaleY, gearX: W / 2, gearY: 400 * scaleY,
    torqueLeft: offsetX + 265 * scaleX, powerLeft: offsetX + 623 * scaleX,
    faceX: offsetX, faceY: offsetY, faceW: faceW, faceH: faceH };
let lastKey = null, lastFace = null;
function draw(state) {
    const cfg = state.config;
    const key = JSON.stringify([state.rpm, state.gear, state.shift, state.shift ? !!state.flash : false, state.torqueNm, state.powerPS, state.torquePeak, state.powerPeak,
        cfg.shiftRpm, cfg.redlineRpm, cfg.maxRpm, cfg.torqueScale, cfg.powerScale, cfg.torqueUnit, cfg.powerUnit]);
    if (key === lastKey && lastFace) return lastFace;
    const source = cluster.draw(state), cv = new Canvas(W, H);
    const sx = source.w / faceW, sy = source.h / faceH;
    // Canvas.drawImage deliberately makes an opaque picture. Copy all four
    // channels here so transparent space stays transparent on the HUD, and
    // nearest sampling retains the exact colors used by the cluster painter.
    for (let y = 0; y < faceH; y++) {
        const row = Math.min(source.h - 1, Math.floor((y + 0.5) * sy)) * source.w;
        for (let x = 0; x < faceW; x++) {
            const si = (row + Math.min(source.w - 1, Math.floor((x + 0.5) * sx))) * 4;
            const di = ((y + offsetY) * W + x + offsetX) * 4;
            cv.d[di] = source.d[si]; cv.d[di + 1] = source.d[si + 1];
            cv.d[di + 2] = source.d[si + 2]; cv.d[di + 3] = source.d[si + 3];
        }
    }
    lastKey = key; lastFace = cv;
    return cv;
}
function difference(previous, next) {
    const stride = W * 4, rects = [], parts = [];
    // Separate alerts, RPM bar/value, torque, gear and power. Every pixel is
    // covered exactly once, including transparent pixels that must be erased.
    const alertsEnd = Math.ceil(90 * scaleY), barEnd = Math.ceil(205 * scaleY), valueEnd = Math.ceil(308 * scaleY);
    const gearLeft = Math.round(480 * scaleX), gearRight = Math.round(608 * scaleX);
    [[0, 0, W, alertsEnd], [0, alertsEnd, W, barEnd], [0, barEnd, W, valueEnd],
        [0, valueEnd, gearLeft, H], [gearLeft, valueEnd, gearRight, H], [gearRight, valueEnd, W, H]].forEach((region) => {
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
