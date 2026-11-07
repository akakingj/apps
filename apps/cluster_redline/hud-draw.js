'use strict';
const { Canvas } = require('./kit/canvas');
const { gauges } = require('./units');
const W = 800, H = 240;
const L = { left: 64, right: 612, slant: 12, alertTop: 34, barTop: 74, barBottom: 110, baseline: 208,
    miniWidth: 160, torqueLeft: 64, powerLeft: 452, miniBaseline: 180, miniTop: 190, miniHeight: 10, miniLabels: 220, rpmLeft: 236, rpmRight: 440 };
const RED = '#ff2a2a', WHITE = '#f4f7fb';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function alertStage(state) { return state.rpm >= state.config.shiftRpm ? 'red' : state.rpm >= state.config.shiftRpm * 0.85 ? 'yellow' : 'green'; }
// Match the cluster's small slanted gauges, keeping their complete footprint
// inside the RPM bar's horizontal extent and clear of the central RPM value.
function mini(cv, x, label, gauge) {
    const w = L.miniWidth, y = L.miniTop, h = L.miniHeight, slant = 7;
    const valid = typeof gauge.value === 'number' && isFinite(gauge.value) && gauge.value >= 0;
    const number = valid ? gauge.value.toFixed(gauge.decimals) : '--';
    const uw = cv.textWidth(gauge.unit, 11, { font: 'label' });
    cv.text(label, x, L.miniBaseline, 14, '#b8c2d1', { font: 'bold' });
    cv.text(number, x + w - uw - 4, L.miniBaseline, 24, WHITE, { align: 'right', font: 'num' });
    cv.text(gauge.unit, x + w, L.miniBaseline, 11, '#b8c2d1', { align: 'right' });
    const span = w - slant;
    const q = (right, tint) => {
        if (right > 0) cv.quad([[x + slant, y], [x + slant + right, y], [x + right, y + h], [x, y + h]], tint);
    };
    q(span, '#1b212b');
    if (valid) {
        const fill = span * clamp(gauge.value / gauge.maximum, 0, 1);
        const peak = typeof gauge.peak === 'number' && isFinite(gauge.peak) ? gauge.peak : gauge.value;
        q(fill, '#1caeff');
        cv.line(x + slant, y - 2, x + slant + span * clamp(peak / gauge.maximum, 0, 1), y - 2, 2, RED);
        cv.line(x + slant + fill, y - 1, x + fill, y + h + 1, 1.5, WHITE);
    }
    [0, 0.5, 1].forEach((f) => {
        const px = x + span * f;
        cv.line(px, y + h + 3, px, y + h + 6, 1, '#a0a9b7');
        // Align endpoint labels inward: neither unit nor scale numbers extend
        // past the upper RPM bar even when a large preset is selected.
        cv.text((gauge.maximum * f).toFixed(gauge.decimals), f === 1 ? x + w : px, L.miniLabels, 12, '#c5cdd8',
            { align: f === 0 ? 'left' : f === 1 ? 'right' : 'center', font: 'num' });
    });
}
function draw(state) {
    const cv = new Canvas(W, H), cfg = state.config;
    cv.clear([0, 0, 0, 0]);
    [14,232].forEach((y)=>{
        cv.line(L.left,y,294,y,1,'#8993a0');cv.line(365,y,L.right,y,1,'#8993a0');
        ['#38c9ff','#1653ad','#ed253c'].forEach((tint,i)=>{
            const x=300+i*8;cv.quad([[x+5,y-7],[x+11,y-7],[x+6,y+7],[x,y+7]],tint);
        });
        cv.polyline([[328,y+7],[332,y-7],[337,y+2],[345,y-7],[341,y+7]],3,WHITE);
    });
    const stage = alertStage(state), color = stage === 'red' ? (state.flash ? RED : '#711318') : stage === 'yellow' ? '#ffd522' : '#19ee67';
    const span = L.right - L.left - L.slant;
    const start = cfg.shiftRpm * 0.65;
    const lit = state.shift ? 12 : Math.floor(clamp((state.rpm-start)/(cfg.shiftRpm-start),0,1)*12);
    for(let i=0;i<12;i++) {
        const a=L.left+span*i/12,b=L.left+span*(i+1)/12-1;
        cv.quad([[a+L.slant,L.alertTop],[b+L.slant,L.alertTop],[b,L.alertTop+12],[a,L.alertTop+12]],i<lit?color:'#000000');
    }
    const band=(a,b,tint)=>{
        if(b<=a)return;
        const x=L.left+span*a/cfg.maxRpm,z=L.left+span*b/cfg.maxRpm;
        cv.quad([[x+L.slant,L.barTop],[z+L.slant,L.barTop],[z,L.barBottom],[x,L.barBottom]],tint);
    };
    band(0,cfg.maxRpm,'#1b212b');band(cfg.redlineRpm,cfg.maxRpm,'#4c1621');
    band(0,clamp(state.rpm,0,cfg.maxRpm),color);
    for(let rpm=500;rpm<cfg.maxRpm;rpm+=500) {
        const x=L.left+span*rpm/cfg.maxRpm;
        cv.line(x+L.slant,L.barTop,x,L.barBottom,0.8,'#000000');
    }
    for(let rpm=0;rpm<=cfg.maxRpm;rpm+=1000) {
        const x=L.left+span*rpm/cfg.maxRpm,tint=rpm>=cfg.redlineRpm?RED:'#aeb9c6';
        cv.line(x,L.barBottom+4,x,L.barBottom+10,1,tint);
        cv.text(String(rpm/1000),x,142,15,tint,{align:'center',font:'num'});
    }
    const num=String(Math.round(state.rpm/10)*10),tint=state.shift?RED:WHITE;
    const sw=cv.textWidth('RPM',18,{font:'bold',literal:true});
    let size=54;
    while(size>24 && cv.textWidth(num,size,{font:'num'})+8+sw>L.rpmRight-L.rpmLeft)size--;
    const nw=cv.textWidth(num,size,{font:'num'}),nx=(L.rpmLeft+L.rpmRight-nw-8-sw)/2;
    cv.text(num,nx,L.baseline,size,tint,{font:'num'});
    cv.text('RPM',nx+nw+8,L.baseline,18,tint,{font:'bold',literal:true});
    const g=gauges(state);
    mini(cv,L.torqueLeft,'Torque',g.torque);
    mini(cv,L.powerLeft,'Power*',g.power);
    const gear=typeof state.gear==='string'&&/^(?:[DSM]?(?:[1-9]|10)|P|R|N|D|--)$/.test(state.gear)?state.gear:'--';
    cv.text(gear,750,132,64,WHITE,{font:'bold',align:'right'});
    return cv;
}
function difference(previous, next) {
    const stride = W * 4;
    const rects = [], parts = [];
    [[0, 0, W, 65], [0, 65, 630, 155], [0, 155, L.rpmLeft, H],
        [L.rpmLeft, 155, L.rpmRight, H], [L.rpmRight, 155, 630, H], [630, 65, W, H]].forEach((region) => {
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
module.exports = { draw, difference, W, H, layout: L, alertStage };
