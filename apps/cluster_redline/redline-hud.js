'use strict';
// The Redline app's HUD layouts (appsKOR apps/redline, MIT; see NOTICE) as Cluster Redline HUD designs.
// Cluster Redline supplies the data (rpm, gear, the drive-mode shift point, the selected auxiliary items);
// rl-hud-draw.js draws its 400x130 image. Painted directly at the HUD size, so nothing is resampled.
// Redline's learning, shift grades, downshift cue and peak hold are not part of this port.
// The drawing modules need the kit; they load on first use so host tests can load the settings UI without it.
let drawing=null;const kit=()=>drawing||(drawing={DRAW:require('./rl-hud-draw'),Canvas:require('./kit/canvas').Canvas});
const {shiftSpec}=require('./shift-alert'),{auxConfig}=require('./display-config'),{gauges}=require('./units'),{language}=require('./strings');
const STYLES=['standard','minimal','wings','digital','vfd','vector','arc','ramp','dial'];
const NAMES={standard:'Standard',minimal:'Minimal',wings:'Split wings',digital:'80s digital dash',vfd:'VFD glow',vector:'Vector arcade',arc:'Arc (F80 M3/M4)',ramp:'Ramp (G80 M3/M4)',dial:'Dial (E60 M5)'};
const IW=400,IH=130,isNum=x=>typeof x==='number'&&isFinite(x);
function style(cfg){const m=/^rl-([a-z]+)$/.exec(cfg&&cfg.hudDesign||'');return m&&STYLES.includes(m[1])?m[1]:null;}
function active(cfg){return !!style(cfg);}
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
function readouts(state){
 const cfg=state.config,a=auxConfig(cfg.hudAuxConfig),v=state.aux||{},g=gauges(state),label=id=>{const l=LABEL[id];return language()==='ko'&&KO[l]?KO[l]:l;};
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
function frame(state,now){
 const cfg=state.config,rpm=isNum(state.rpm)?state.rpm:null,spec=shiftSpec(cfg,state.mode),g=gearOf(state.gear);
 const limiter=rpm!==null&&rpm>=cfg.maxRpm-50,flash=!!state.shift||limiter,blink=flash?state.flash!==false:true;
 return {d:{rpm,gear:g.gear,stage:g.stage},shift:spec.shift,redline:cfg.redlineRpm,max:cfg.maxRpm,blink,
  cue:{from:spec.shift-1500,at:spec.shift,shift:!!state.shift,limiter},down:0,peak:0,chip:null,shake:null,readouts:readouts(state),mode:g.mode,
  opts:{style:style(cfg)||'standard',palette:'colour',gear:true,rpm:true,bar:true,lights:true,gt3:true,dim:true,lightStyle:'gt3',clearLabels:false}};
}
function paint(target,state,k,ox,oy,now){const {DRAW}=kit();DRAW.drawLayer(DRAW.scaled(target,k,ox||0,oy||0),frame(state,now));}
function drawSized(state,w,h){const {Canvas}=kit(),cv=new Canvas(Math.max(1,Math.round(w||IW)),Math.max(1,Math.round(h||IH)));cv.clear([0,0,0,0]);if(state&&state.config)paint(cv,state,(w||IW)/IW);return cv;}
function draw(state){return drawSized(state,IW,IH);}
// Where it sits on the HUD: centred on the RPM face's placement, 400x130 at the default 75 % HUD size,
// moved and sized with the RPM gauge part (Position / size).
function rect(cfg,face){
 const k=face.w/600*(cfg.hudRpmGaugeWidthScale||100)/100,w=Math.round(IW*k),h=Math.round(IH*k);
 const x=Math.round(face.x+face.w/2-w/2+(cfg.hudRpmGaugeOffsetX||0)*face.w/800),y=Math.round(face.y+10*face.h/240+(cfg.hudRpmGaugeOffsetY||0)*face.h/240);
 return {x:Math.max(0,Math.min(800-w,x)),y:Math.max(0,Math.min(480-h,y)),w,h};
}
function key(state){const f=frame(state,0);return JSON.stringify([f.opts.style,f.d,f.shift,f.redline,f.max,f.cue,f.blink,f.readouts,f.mode]);}
module.exports={STYLES,NAMES,IW,IH,style,active,gearOf,readouts,frame,paint,draw,drawSized,rect,key};
