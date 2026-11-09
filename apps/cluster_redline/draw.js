'use strict';
const { Canvas } = require('./kit/canvas');
const { drawMark } = require('./m-mark');
const rpmColors = require('./rpm-colors');
const {part}=require('./component-canvas');
const {drawAux}=require('./aux-draw');
const {alertState}=require('./hud-draw');
const fonts=require('./kit/fonts');
const W = 1088, H = 480;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const C = { track: '#1b212b', text: '#f4f7fb', red: '#ff2a2a' };
const L = { left: 220, right: 868, slant: 14, top: 112, bottom: 153,
    upperFrame: 31, alertTop: 59, alertBottom: 77, miniHeight: 26 };
function frame(cv, cfg, y, lower) {
    const key=lower?'MarkBottom':'MarkTop';
    part(cv,cfg,'cluster',key+'Line',{x:92,y:y-18,w:904,h:40},c=>{
        const side=lower?-12:12;
        if(!cfg['cluster'+key+'LineHidden']){c.polyline([[98,y+side],[124,y],[499,y]],1.5,'#8993a0');c.polyline([[589,y],[964,y],[990,y+side]],1.5,'#8993a0');}
    });
    part(cv,cfg,'cluster',key,{x:W/2-44,y:y-14,w:88,h:28},c=>{if(!cfg['cluster'+key+'Hidden'])drawMark(c,W/2,y-14);});
}
function draw(state,target) {
    const cv=target||new Canvas(W,H),cfg=state.config,rpm=state.rpm;
    if(!target)cv.clear([0,0,0,0]);
    frame(cv,cfg,L.upperFrame,false);frame(cv,cfg,450,true);
    const span=L.right-L.left-L.slant;
    part(cv,cfg,'cluster','RpmGauge',{x:204,y:L.top-5,w:680,h:90},c=>{
        const polygon=(a,b,color)=>{if(b<=a)return;const xa=L.left+span*a/cfg.maxRpm,xb=L.left+span*b/cfg.maxRpm;c.quad([[xa+L.slant,L.top],[xb+L.slant,L.top],[xb,L.bottom],[xa,L.bottom]],color);};
        polygon(0,cfg.maxRpm,C.track);polygon(cfg.redlineRpm,cfg.maxRpm,'#4c1621');
        const top=clamp(rpm,0,cfg.maxRpm);
        for(let r=0;r<top;r+=50)polygon(r,Math.min(r+75,top),rpmColors.colorAt(r,cfg));
        for(let r=500;r<cfg.maxRpm;r+=500){const x=L.left+span*r/cfg.maxRpm;c.line(x+L.slant,L.top,x,L.bottom,0.7,'#05060a');}
        if(top>0){const x=L.left+span*top/cfg.maxRpm;c.line(x+L.slant,L.top-2,x,L.bottom+2,3,C.text);}
        for(let r=0;r<=cfg.maxRpm;r+=500){const x=L.left+span*r/cfg.maxRpm,major=r%1000===0,color=r>=cfg.redlineRpm?C.red:'#b8c2d1';c.line(x,L.bottom+5,x,L.bottom+(major?13:9),1,color);if(major)c.text(String(r/1000),x,187,22,color,{align:'center',font:'num'});}
    });
    const gear=typeof state.gear==='string'&&/^(?:[DSM]?(?:[1-9]|10)|P|R|N|D|--)$/.test(state.gear)?state.gear:'--';
    const gearWidth=cv.textWidth(gear,74,{font:'bold',literal:true}),font=fonts.get('bold',74,gear),glyphs=font?Array.from(gear,c=>font.glyphs[c.codePointAt(0)]).filter(Boolean):[];
    const scale=font?74/font.size:1,top=glyphs.length?Math.min.apply(null,glyphs.map(g=>g[5]))*scale:-54,bottom=glyphs.length?Math.max.apply(null,glyphs.map(g=>g[5]+g[3]))*scale:0,diameter=(gear==='--'&&font&&font.glyphs[68]?font.glyphs[68][3]*scale:bottom-top)*0.7;
    const circleX=W/2-gearWidth/2-12-diameter/2,circleY=400+(top+bottom)/2,alert=alertState(state);
    part(cv,cfg,'cluster','Alert',cfg.clusterAlertStyle==='circle'?{x:circleX-diameter/2-3,y:circleY-diameter/2-3,w:diameter+6,h:diameter+6}:{x:L.left-2,y:L.alertTop-2,w:span+L.slant+4,h:24},c=>{
        if(cfg.clusterAlertStyle==='circle'){
            if(alert.visible&&(alert.stage!=='red'||state.flash))c.arc(circleX,circleY,0,diameter/2,0,360,alert.color);
        }else for(let i=0;i<12;i++){
            const a=L.left+span*i/12,b=L.left+span*(i+1)/12-0.5,color=alert.stage==='red'&&!state.flash?'#711318':alert.color;
            c.quad([[a+L.slant,L.alertTop],[b+L.slant,L.alertTop],[b,L.alertBottom],[a,L.alertBottom]],i<alert.lit?color:'#000000');
        }
    });
    part(cv,cfg,'cluster','RpmValue',{x:380,y:190,w:330,h:94},c=>{
        const num=String(Math.round(rpm/10)*10),size=78,nw=c.textWidth(num,size,{font:'num'}),sw=c.textWidth('RPM',22,{font:'bold',literal:true}),nx=(W-nw-10-sw)/2,tint=state.shift?C.red:C.text;
        c.text(num,nx,270,size,tint,{font:'num'});c.text('RPM',nx+nw+10,270,22,tint,{font:'bold',literal:true});
    });
    part(cv,cfg,'cluster','Gear',{x:W/2-gearWidth/2-4,y:320,w:gearWidth+8,h:96},c=>c.text(gear,W/2,400,74,C.text,{align:'center',font:'bold'}));
    drawAux(cv,state,'cluster');
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
