'use strict';
// The Redline app's HUD layouts (appsKOR apps/redline, MIT; see NOTICE) as Cluster Redline HUD and cluster designs.
// Every function takes the display d ('hud', the default, or 'cluster'): its design, readouts and part settings.
// Cluster Redline supplies the data (rpm, gear, the drive-mode shift point, the selected auxiliary items);
// rl-hud-draw.js draws its 400x130 image. Painted directly at the HUD size, so nothing is resampled.
// Redline's learning, shift grades, downshift cue and peak hold are not part of this port.
// The drawing modules need the kit; they load on first use so host tests can load the settings UI without it.
let drawing=null;const kit=()=>drawing||(drawing={DRAW:require('./rl-hud-draw'),Canvas:require('./kit/canvas').Canvas});
const {shiftSpec}=require('./shift-alert'),{auxConfig}=require('./display-config'),{gauges}=require('./units'),{language}=require('./strings');
const STYLES=['standard','minimal','wings','digital','vfd','vector','arc','ramp','dial'];
const NAMES={standard:'Standard',minimal:'Minimal',wings:'Split wings',digital:'80s digital dash',vfd:'VFD glow',vector:'Vector arcade',arc:'Arc (F80 M3/M4)',ramp:'Ramp (G80 M3/M4)',dial:'Dial (E60 M5)'};
const IW=400,IH=130,isNum=x=>typeof x==='number'&&isFinite(x);
function style(cfg,d){const m=/^rl-([a-z]+)$/.exec(cfg&&cfg[(d||'hud')+'Design']||'');return m&&STYLES.includes(m[1])?m[1]:null;}
function active(cfg,d){return !!style(cfg,d);}
// Cluster Redline's gear text ('M3', 'S4', 'D', 'P', '--') as Redline's { gear, stage } and mode letter.
function gearOf(text){
 const t=typeof text==='string'?text:'',m=/^([DSM])?(\d+)$/.exec(t);
 if(m)return {gear:Number(m[2]),stage:'D',mode:m[1]||null};
 if(/^[PRN]$/.test(t))return {gear:0,stage:t,mode:null};
 if(t==='D')return {gear:null,stage:'D',mode:null};
 return {gear:null,stage:null,mode:null};
}
const LABEL={boost:'BOOST',torque:'TORQUE',power:'POWER',gforce:'G',outside:'OUT',oil:'OIL',batteryCharge:'BATT',batteryVoltage:'VOLT',economy:'ECON',clock:'CLOCK'};
const KO={BOOST:'부스트',TORQUE:'토크',POWER:'마력',G:'G',OUT:'외기',OIL:'오일',BATT:'배터리',VOLT:'전압',ECON:'연비',CLOCK:'시계'};
function readouts(state,d){
 const cfg=state.config,a=auxConfig(cfg[(d||'hud')+'AuxConfig']),v=state.aux||{},g=gauges(state),label=id=>{const l=LABEL[id];return language()==='ko'&&KO[l]?KO[l]:l;};
 if(a.mode==='off')return [];
 return a.items.slice(0,4).map(id=>{
  let value='--',tone='text';
  if(id==='torque'||id==='power'){const x=g[id];value=x&&isNum(x.value)?String(Math.round(x.value)):'--';}
  else if(id==='clock')value=typeof v.clock==='string'?v.clock:'--:--';
  else if(id==='oil'||id==='outside'){if(isNum(v[id])){value=Math.round(v[id])+'°';if(id==='oil')tone=v[id]<70?'cold':v[id]>130?'hot':'text';}}
  else if(id==='boost')value=isNum(v.boost)?v.boost.toFixed(2):'--';
  else if(id==='gforce')value=isNum(v.gforce)?v.gforce.toFixed(2):'--';
  else if(id==='batteryCharge')value=isNum(v.batteryCharge)?Math.round(v.batteryCharge)+'%':'--';
  else if(id==='batteryVoltage')value=isNum(v.batteryVoltage)?v.batteryVoltage.toFixed(1):'--';
  else if(id==='economy')value=isNum(v.economy)?v.economy.toFixed(1):'--';
  return {label:label(id),value,tone};
 });
}
// Redline's frame from Cluster Redline's render state. Lights count over the 1500 rpm before the shift
// point (Redline's plain span) and flash at it, with the comfort/sport shift point of the drive mode.
function frame(state,now,d){
 const cfg=state.config,rpm=isNum(state.rpm)?state.rpm:null,spec=shiftSpec(cfg,state.mode),g=gearOf(state.gear);
 const limiter=rpm!==null&&rpm>=cfg.maxRpm-50,flash=!!state.shift||limiter,blink=flash?state.flash!==false:true;
 return {d:{rpm,gear:g.gear,stage:g.stage},shift:spec.shift,redline:cfg.redlineRpm,max:cfg.maxRpm,blink,
  cue:{from:spec.shift-1500,at:spec.shift,shift:!!state.shift,limiter},down:0,peak:0,chip:null,shake:null,readouts:readouts(state,d),mode:g.mode,
  opts:{style:style(cfg,d)||'standard',palette:'colour',gear:true,rpm:true,bar:true,lights:true,gt3:true,dim:true,lightStyle:'gt3',clearLabels:false}};
}
function paint(target,state,k,ox,oy,now,d){const {DRAW}=kit();DRAW.drawLayer(DRAW.scaled(target,k,ox||0,oy||0),frame(state,now,d));}
function drawSized(state,w,h){const {Canvas}=kit(),cv=new Canvas(Math.max(1,Math.round(w||IW)),Math.max(1,Math.round(h||IH)));cv.clear([0,0,0,0]);if(state&&state.config)paint(cv,state,(w||IW)/IW);return cv;}
function draw(state){return drawSized(state,IW,IH);}
// Where it sits on the HUD: centred on the RPM face's placement, 400x130 at the default 75 % HUD size,
// moved and sized with the RPM gauge part (Position / size).
function rect(cfg,face,d){
 // On the cluster: 800x260 at 100 %, centred in the cluster area, moved in its pixels.
 if(d==='cluster'){const k=face.w/1088*2*(cfg.clusterRpmGaugeWidthScale||100)/100,w=Math.round(IW*k),h=Math.round(IH*k);
  const x=Math.round(face.x+(face.w-w)/2+(cfg.clusterRpmGaugeOffsetX||0)*face.w/1088),y=Math.round(face.y+(face.h-h)/2+(cfg.clusterRpmGaugeOffsetY||0)*face.h/480);
  return {x:Math.max(face.x,Math.min(face.x+face.w-w,x)),y:Math.max(face.y,Math.min(face.y+face.h-h,y)),w,h};}
 const k=face.w/600*(cfg.hudRpmGaugeWidthScale||100)/100,w=Math.round(IW*k),h=Math.round(IH*k);
 const x=Math.round(face.x+face.w/2-w/2+(cfg.hudRpmGaugeOffsetX||0)*face.w/800),y=Math.round(face.y+10*face.h/240+(cfg.hudRpmGaugeOffsetY||0)*face.h/240);
 return {x:Math.max(0,Math.min(800-w,x)),y:Math.max(0,Math.min(480-h,y)),w,h};
}
// Elements of each layout that move, size and hide on their own (Position / size), in drawing order.
// Readouts are one group on the bar layouts and one element each on the M layouts.
const ELEMENTS={
 standard:['mode','gear','alert','gauge','read'],minimal:['mode','gear','alert'],wings:['mode','alert','gauge','gear'],
 digital:['mode','alert','gauge','gear','rpm','read'],vfd:['mode','alert','gauge','gear','rpm','read'],vector:['mode','gear','alert','gauge','read'],
 arc:['alert','gauge','gear','mode','readD','readA','readB','readC'],ramp:['gauge','readB','readC','readD','gear','mode','readA'],dial:['gauge','readB','readC','readD','gear','mode','readA']};
const PART={gear:'RlGear',mode:'RlMode',alert:'RlAlert',rpm:'RlRpm',gauge:'RlGauge',read:'RlRead',readA:'RlReadA',readB:'RlReadB',readC:'RlReadC',readD:'RlReadD'};
const PART_NAMES=Object.keys(PART).map(k=>PART[k]);
const LABELS={RlGear:'Gear',RlMode:'Drive mode',RlAlert:'RPM alert',RlRpm:'RPM number',RlGauge:'RPM gauge',RlRead:'Readouts',RlReadA:'Readout 1',RlReadB:'Readout 2',RlReadC:'Readout 3',RlReadD:'Readout 4'};
function readoutCount(cfg,d){const a=auxConfig(cfg[(d||'hud')+'AuxConfig']);return a.mode==='off'?0:Math.min(4,a.items.length);}
// The elements the chosen layout draws with the chosen readouts: [{id, key}].
function elements(cfg,d){
 const st=style(cfg,d);if(!st)return [];const n=readoutCount(cfg,d);
 return ELEMENTS[st].filter(id=>id==='read'?n>0:/^read[A-D]$/.test(id)?'ABCD'.indexOf(id[4])<n:true).map(id=>({id,key:PART[id]}));
}
// An element's extent in the 400x130 image, measured from a full frame (top revs, all lights lit, a wide
// gear and readouts) so it doesn't change with the live values.
function bboxCanvas(){
 const {Canvas}=kit(),probe=new Canvas(1,1),b={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
 const add=(x,y)=>{if(!isNum(x)||!isNum(y))return;b.x0=Math.min(b.x0,x);b.y0=Math.min(b.y0,y);b.x1=Math.max(b.x1,x);b.y1=Math.max(b.y1,y);};
 const box=(x,y,w,h)=>{add(x,y);add(x+w,y+h);};
 const pt=(cx,cy,r,a)=>add(cx+r*Math.sin(a*Math.PI/180),cy-r*Math.cos(a*Math.PI/180));
 const width=(t,size,o)=>{try{return probe.textWidth(String(t),size,o);}catch(e){return String(t).length*size*0.6;}};
 return {b,
  circle:(cx,cy,r)=>box(cx-r,cy-r,2*r,2*r),
  arc:(cx,cy,r0,r1,a0,a1)=>{const lo=Math.min(a0,a1),hi=Math.max(a0,a1);for(let a=lo;;a=Math.min(hi,a+2)){pt(cx,cy,r0,a);pt(cx,cy,r1,a);if(a>=hi)break;}},
  fillRect:(x,y,w,h)=>box(x,y,w,h),
  quad:(pts)=>pts.forEach(p=>add(p[0],p[1])),
  polyline:(pts,w)=>pts.forEach(p=>box(p[0]-w/2,p[1]-w/2,w,w)),
  line:(xa,ya,xb,yb,w)=>{box(xa-w/2,ya-w/2,w,w);box(xb-w/2,yb-w/2,w,w);},
  text:(t,x,y,size,c,o)=>{const w=width(t,size,o),al=o&&o.align;box(al==='center'?x-w/2:al==='right'?x-w:x,y-size*0.8,w,size*1.05);},
  textWidth:(t,size,o)=>width(t,size,o),
 };
}
const boundsCache=new Map();
function bounds(state,id,d){
 const cfg=state.config,f=frame(Object.assign({},state,{rpm:cfg.maxRpm,gear:'M8',flash:true}),0,d);
 f.d=Object.assign({},f.d,{rpm:f.max,gear:8,stage:'D'});f.mode='M';f.blink=true;f.cue=Object.assign({},f.cue,{shift:true});
 f.readouts=(f.readouts||[]).map(r=>Object.assign({},r,{value:'88.88'}));f.only=id;
 const k=JSON.stringify([id,f.opts.style,f.max,f.redline,f.readouts.map(r=>r.label)]);
 if(boundsCache.has(k))return boundsCache.get(k);
 const cv=bboxCanvas();kit().DRAW.drawLayer(cv,f);
 const b=cv.b,r=b.x1>b.x0?{x:Math.floor(b.x0)-2,y:Math.floor(b.y0)-2,w:Math.ceil(b.x1-b.x0)+4,h:Math.ceil(b.y1-b.y0)+4}:null;
 if(boundsCache.size>200)boundsCache.clear();boundsCache.set(k,r);return r;
}
// Where an element lands on the HUD: the whole layout's place (rect), then the element's own move and
// size (in the image's units, sized uniformly round its centre).
function partRect(cfg,layout,b,key,d){
 const p=(d||'hud')+key,k=layout.w/IW,s=(cfg[p+'WidthScale']||100)/100,ox=cfg[p+'OffsetX']||0,oy=cfg[p+'OffsetY']||0;
 return {x:Math.round(layout.x+(b.x+b.w*(1-s)/2+ox)*k),y:Math.round(layout.y+(b.y+b.h*(1-s)/2+oy)*k),w:Math.max(1,Math.round(b.w*s*k)),h:Math.max(1,Math.round(b.h*s*k))};
}
// One element painted at its own size (no resampling): {W, H, draw(state) -> Canvas}.
function partPainter(state,id,b,r,d){
 return {W:r.w,H:r.h,draw:v=>{const {Canvas,DRAW}=kit(),cv=new Canvas(r.w,r.h),k=r.w/b.w;cv.clear([0,0,0,0]);const f=frame(v,0,d);f.only=id;DRAW.drawLayer(DRAW.scaled(cv,k,-b.x*k,-b.y*k),f);return cv;}};
}
// The visible elements with their places: [{id, key, b, r}].
function placed(state,layout,d){
 const cfg=state.config,p=d||'hud';
 return elements(cfg,d).filter(e=>!cfg[p+e.key+'Hidden']).map(e=>{const b=bounds(state,e.id,d);return b&&Object.assign({b,r:partRect(cfg,layout,b,e.key,d)},e);}).filter(Boolean);
}
function key(state,d){const f=frame(state,0,d);return JSON.stringify([f.opts.style,f.d,f.shift,f.redline,f.max,f.cue,f.blink,f.readouts,f.mode]);}
module.exports={STYLES,NAMES,IW,IH,ELEMENTS,PART,PART_NAMES,LABELS,style,active,gearOf,readouts,frame,paint,draw,drawSized,rect,key,elements,bounds,partRect,partPainter,placed};
