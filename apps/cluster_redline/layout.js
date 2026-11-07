'use strict';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function placement(config, target, painter) {
    const prefix = target === 'hudNav' ? 'hudNav' : target === 'hud' ? 'hud' : 'cluster';
    const tw = target === 'panel' ? 1920 : target === 'hud' || target === 'hudNav' ? 800 : 1088, th = target === 'panel' ? 720 : 480;
    const w = Math.min(tw, Math.round(painter.W * config[prefix + 'WidthScale'] / 100));
    const h = Math.min(th, Math.round(painter.H * config[prefix + 'HeightScale'] / 100));
    const cx = Math.round((tw - w) / 2), cy = target === 'hudNav' ? Math.min(240, th-h) : Math.round((th - h) / 2);
    return { x: clamp(cx + config[prefix + 'OffsetX'], 0, tw - w), y: clamp(cy + config[prefix + 'OffsetY'], 0, th - h), w, h,
        minX: -cx, maxX: tw - w - cx, minY: -cy, maxY: th - h - cy, tw, th };
}
module.exports = { placement };
