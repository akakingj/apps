'use strict';
const { Canvas } = require('./kit/canvas');
const fonts = require('./kit/fonts');
const { drawMark } = require('./m-mark');
const rpmColors = require('./rpm-colors');
const {part}=require('./component-canvas');
const {drawAux}=require('./aux-draw');
const W = 800, H = 240;
const TYPE = { rpm:59.4, rpmUnit:19.8, label:15.4, value:26.4, unit:12.1, scale:13.2, ticks:16.5, gear:70.4 };
const L = { left:64, right:612, slant:12, alertTop:14, barTop:52, barBottom:84.4, tickBaseline:116, baseline:180,
    miniWidth:160, torqueLeft:64, powerLeft:452, miniBaseline:154, miniTop:162, miniHeight:32, miniLabels:211,
    gaugeScale:0.9, frameY:230, rpmLeft:236, rpmRight:440 };
const RED='#ff2a2a',WHITE='#f4f7fb';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function layoutFor(cfg) {
    if(cfg.hudAlertStyle!=='circle')return L;
    const result=Object.assign({},L,{barTop:18,barBottom:50.4,tickBaseline:82,baseline:146,miniBaseline:120,miniTop:134,miniHeight:32,miniLabels:184,frameY:198});
    ['alertTop','barTop','barBottom','tickBaseline','baseline','miniBaseline','miniTop','miniLabels','frameY'].forEach(k=>{result[k]+=20;});return result;
}
function alertStage(state) { return state.rpm>=state.config.shiftRpm?'red':state.rpm>=state.config.shiftRpm*0.85?'yellow':'green'; }
function alertState(state) {
    const shift=state.config.shiftRpm,start=shift*0.65;
    // The original twelve-segment alert determines the first visible green.
    const lit=state.shift?12:Math.floor(clamp((state.rpm-start)/(shift-start),0,1)*12);
    const stage=alertStage(state);
    return {lit,stage,visible:lit>0,color:stage==='red'?RED:stage==='yellow'?'#ffd522':'#19ee67'};
}
function gearLayout(cv,gear,cfg) {
    let size=TYPE.gear,width,top,bottom,diameter;
    do {
        const f=fonts.get('bold',size,gear),scale=f?size/f.size:1;
        const glyphs=f?Array.from(gear,c=>f.glyphs[c.codePointAt(0)]).filter(Boolean):[];
        top=glyphs.length?Math.min.apply(null,glyphs.map(g=>g[5]))*scale:-size*0.72;
        bottom=glyphs.length?Math.max.apply(null,glyphs.map(g=>g[5]+g[3]))*scale:0;
        const reference=f&&f.glyphs[68];
        diameter=(gear==='--'&&reference?reference[3]*scale:bottom-top)*0.7;width=cv.textWidth(gear,size,{font:'bold',literal:true});
        if(width+12+diameter<=160||size<=44)break;
        size-=1;
    }while(true);
    const l=layoutFor(cfg||{}),baseline=(l.barTop+l.barBottom)/2-(top+bottom)/2,right=780;
    return {size,right,baseline,left:right-width,diameter,cx:right-width-12-diameter/2,cy:baseline+(top+bottom)/2};
}
function metricUnitSize(cv,value,unit,width,size) {
    const nw=cv.textWidth(value,size,{font:'num',literal:true});
    const natural=cv.textWidth(unit,TYPE.rpmUnit,{font:'bold',literal:true});
    return Math.max(TYPE.unit,Math.min(TYPE.rpmUnit,TYPE.rpmUnit*Math.max(0,width-nw-8)/Math.max(1,natural)));
}
function metric(cv,value,unit,left,right,baseline,size,tint) {
    const unitSize=metricUnitSize(cv,value,unit,right-left,size),uw=cv.textWidth(unit,unitSize,{font:'bold',literal:true});
    const nw=cv.textWidth(value,size,{font:'num',literal:true}),x=(left+right-nw-8-uw)/2;
    cv.text(value,x,baseline,size,tint,{font:'num',literal:true});
    cv.text(unit,x+nw+8,baseline,unitSize,tint,{font:'bold',literal:true});
}
function draw(state,target) {
    const cv=target||new Canvas(W,H),cfg=state.config,l=layoutFor(cfg),alert=alertState(state);
    if(!target)cv.clear([0,0,0,0]);
    part(cv,cfg,'hud','MarkLine',{x:l.left-3,y:l.frameY-2,w:l.right-l.left+6,h:4},c=>{
        if(!cfg.hudMarkLineHidden){c.line(l.left,l.frameY,294,l.frameY,1,'#8993a0');c.line(365,l.frameY,l.right,l.frameY,1,'#8993a0');}
    });
    part(cv,cfg,'hud','Mark',{x:303,y:l.frameY-9,w:54,h:17},c=>{if(!cfg.hudMarkHidden)drawMark(c,330,l.frameY-9,54,17);});
    const span=l.right-l.left-l.slant;
    part(cv,cfg,'hud','RpmGauge',{x:50,y:l.barTop-5,w:580,h:l.tickBaseline-l.barTop+14},c=>{
        const band=(a,b,tint)=>{if(b<=a)return;const x=l.left+span*a/cfg.maxRpm,z=l.left+span*b/cfg.maxRpm;c.quad([[x+l.slant,l.barTop],[z+l.slant,l.barTop],[z,l.barBottom],[x,l.barBottom]],tint);};
        band(0,cfg.maxRpm,'#1b212b');band(cfg.redlineRpm,cfg.maxRpm,'#4c1621');
        const top=clamp(state.rpm,0,cfg.maxRpm);
        for(let rpm=0;rpm<top;rpm+=50)band(rpm,Math.min(rpm+75,top),rpmColors.colorAt(rpm,cfg));
        for(let rpm=500;rpm<cfg.maxRpm;rpm+=500){const x=l.left+span*rpm/cfg.maxRpm;c.line(x+l.slant,l.barTop,x,l.barBottom,0.8,'#000000');}
        for(let rpm=0;rpm<=cfg.maxRpm;rpm+=1000){const x=l.left+span*rpm/cfg.maxRpm,tint=rpm>=cfg.redlineRpm?RED:'#aeb9c6';c.line(x,l.barBottom+4,x,l.barBottom+10,1,tint);c.text(String(rpm/1000),x,l.tickBaseline,TYPE.ticks,tint,{align:'center',font:'num',literal:true});}
    });
    const gear=typeof state.gear==='string'&&/^(?:[DSM]?(?:[1-9]|10)|P|R|N|D|--)$/.test(state.gear)?state.gear:'--',gl=gearLayout(cv,gear,cfg);
    const alertBounds=cfg.hudAlertStyle==='circle'?{x:gl.cx-gl.diameter/2-3,y:gl.cy-gl.diameter/2-3,w:gl.diameter+6,h:gl.diameter+6}:{x:l.left-2,y:l.alertTop-2,w:span+l.slant+4,h:16};
    const paintAlert=c=>{
        if(cfg.hudAlertStyle!=='circle')for(let i=0;i<12;i++){
            const a=l.left+span*i/12,b=l.left+span*(i+1)/12-1,color=alert.stage==='red'&&!state.flash?'#711318':alert.color;
            c.quad([[a+l.slant,l.alertTop],[b+l.slant,l.alertTop],[b,l.alertTop+12],[a,l.alertTop+12]],i<alert.lit?color:'#000000');
        }
        else if(alert.visible&&(alert.stage!=='red'||state.flash))c.arc(gl.cx,gl.cy,0,gl.diameter/2,0,360,alert.color);
    };
    if(cfg.hudAlertStyle!=='circle')part(cv,cfg,'hud','Alert',alertBounds,paintAlert);
    part(cv,cfg,'hud','RpmValue',{x:l.rpmLeft-3,y:l.baseline-70,w:l.rpmRight-l.rpmLeft+6,h:76},c=>{
        const num=String(Math.round(state.rpm/10)*10);let size=TYPE.rpm;
        while(size>24&&c.textWidth(num,size,{font:'num',literal:true})+8+c.textWidth('RPM',TYPE.unit,{font:'bold',literal:true})>l.rpmRight-l.rpmLeft)size--;
        metric(c,num,'RPM',l.rpmLeft,l.rpmRight,l.baseline,size,state.shift?RED:WHITE);
    });
    drawAux(cv,state,'hud',{left:l.torqueLeft,right:l.powerLeft,width:l.miniWidth,top:cfg.hudAlertStyle==='circle'?125:133,bottom:cfg.hudAlertStyle==='circle'?204:211,textShift:cfg.hudAlertStyle==='circle'?20:0});
    const circle=cfg.hudAlertStyle==='circle',left=circle?Math.min(620,alertBounds.x):620,right=790;
    const top=Math.min(gl.baseline-TYPE.gear,circle?alertBounds.y:Infinity),bottom=Math.max(gl.baseline+14,circle?alertBounds.y+alertBounds.h:0);
    part(cv,cfg,'hud','Gear',{x:left,y:top,w:right-left,h:bottom-top},c=>{c.text(gear,gl.right,gl.baseline,gl.size,WHITE,{font:'bold',align:'right',literal:true});if(circle)paintAlert(c);});
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
module.exports = { draw, difference, W, H, layout: L, layoutFor, gearLayout, typography: TYPE, alertStage, alertState };
