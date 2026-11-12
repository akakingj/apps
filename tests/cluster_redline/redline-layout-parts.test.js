'use strict';
// Redline app layouts on the HUD: each element (gear, drive mode, RPM alert, RPM number, RPM gauge, readouts)
// moves, sizes and hides on its own in Position / size, and is saved, loaded and reset with the other parts.
// Usage: node redline-layout-parts.test.js <built cluster_redline stage>
const assert=require('assert'),path=require('path'),root=path.join(path.resolve(process.argv[2]),'source/javascript');
const RL=require(root+'/redline-hud'),D=require(root+'/display-config'),{settings}=require(root+'/policy');
const {Canvas}=require(root+'/kit/canvas'),{blitScaled}=require(root+'/component-canvas'),{SettingsPage}=require(root+'/settings-ui');
const spec=require(root+'/kit/app-spec.json');
const AUX=JSON.stringify({mode:'values',items:['boost','torque','outside','oil']});
const stateOf=cfg=>({config:cfg,rpm:5200,gear:'M4',aux:{boost:1.2,outside:18,oil:95},mode:'SPORT'});
const layout={x:200,y:100,w:400,h:130};
function compose(state,at){const cv=new Canvas(800,480);cv.clear([0,0,0,0]);RL.placed(state,at||layout).forEach(e=>blitScaled(cv,RL.partPainter(state,e.id,e.b,e.r).draw(state),e.r));return cv;}
function litBox(cv,r){let n=0;for(let y=Math.max(0,r.y);y<Math.min(cv.h,r.y+r.h);y++)for(let x=Math.max(0,r.x);x<Math.min(cv.w,r.x+r.w);x++)if(cv.d[(y*cv.w+x)*4+3])n++;return n;}

// 1. At default positions every layout looks as the single Redline image did.
const expected={standard:['mode','gear','alert','gauge','read'],minimal:['mode','gear','alert'],wings:['mode','alert','gauge','gear'],digital:['mode','alert','gauge','gear','rpm','read'],
 vfd:['mode','alert','gauge','gear','rpm','read'],vector:['mode','gear','alert','gauge','read'],arc:['alert','gauge','gear','mode','readD','readA','readB','readC'],
 ramp:['gauge','readB','readC','readD','gear','mode','readA'],dial:['gauge','readB','readC','readD','gear','mode','readA'],
 shift:['alert','gear','mode','rpm','read'],logger:['gauge','gear','mode','rpm','readA','readB','readC','readD'],needle:['gauge','gear','mode','readA','readB','readC','readD'],
 rings:['gmeter','gauge','gear','mode','rpm','read'],ribbon:['gauge','gear','mode','readA','readB','readC','readD'],
 hexagon:['gauge','alert','gear','mode','rpm','readA','readB','readC','readD'],fivedial:['gauge','alert','gear','mode','rpm','readA','readB','readC','readD']};
RL.STYLES.forEach(st=>{
 const cfg=settings({hudDesign:'rl-'+st,hudAuxConfig:AUX}),state=stateOf(cfg);
 assert.deepStrictEqual(RL.elements(cfg).map(e=>e.id),expected[st],st+' elements');
 const ih=RL.heightOf(st),at={x:200,y:100,w:400,h:ih};assert.strictEqual(ih,['shift','logger','needle','rings','ribbon','hexagon','fivedial'].includes(st)?176:130);
 const a=new Canvas(800,480);a.clear([0,0,0,0]);blitScaled(a,RL.drawSized(state,400,ih),at);const b=compose(state,at);
 let worst=0;for(let i=0;i<a.d.length;i++)worst=Math.max(worst,Math.abs(a.d[i]-b.d[i]));
 assert(worst<=48,st+': default positions match the original image (worst channel difference '+worst+')');
 const off=settings({hudDesign:'rl-'+st,hudAuxConfig:JSON.stringify({mode:'off',items:['boost']})});
 assert(!RL.elements(off).some(e=>/^read/.test(e.id)),st+': no readout elements without readouts');
});

// 2. Move, size and hide one element; the others stay put.
const base=settings({hudDesign:'rl-standard',hudAuxConfig:AUX}),moved=settings(Object.assign({},base,{hudRlGearOffsetX:120,hudRlAlertHidden:true,hudRlReadWidthScale:150,hudRlReadHeightScale:100}));
assert.strictEqual(moved.hudRlReadHeightScale,150,'element size is uniform: height follows width');
const before=RL.placed(stateOf(base),layout),after=RL.placed(stateOf(moved),layout),at=(list,id)=>list.find(e=>e.id===id);
assert.strictEqual(at(after,'gear').r.x-at(before,'gear').r.x,120,'gear moved by its offset (400-unit image at scale 1)');
assert.deepStrictEqual(at(after,'gauge').r,at(before,'gauge').r,'other elements stay');
assert(!at(after,'alert'),'hidden element not drawn');
assert(Math.abs(at(after,'read').r.w-Math.round(at(before,'read').r.w*1.5))<=1,'readouts sized 150 %');
const cv=compose(stateOf(moved));assert(litBox(cv,at(after,'gear').r)>100,'moved gear is drawn where it went');
const hideAll=settings(Object.assign({},base,{hudRpmGaugeHidden:true}));assert.strictEqual(RL.elements(hideAll).length,5);assert(!D.faceVisible(hideAll,'hud'),'Whole layout hidden hides every element');
assert(D.faceVisible(base,'hud'));

// 3. Position / size: parts listed, uniform size, save / load / reset with the other parts.
const values={};spec.settings.forEach(s=>{values[s.key]=s.default;});values.hudDesign='rl-arc';values.hudAuxConfig=AUX;
const store={schema:spec.settings,get:k=>values[k],set:(k,v)=>{values[k]=v;},setMany(c){Object.assign(values,c);}};
const page=new SettingsPage(store,null,'test');page.selectTab(1);page.activate(page.keys().indexOf('layout'));
const parts=page.layoutParts();
assert.deepStrictEqual(parts.map(p=>p.key),['RpmGauge','RlGear','RlMode','RlAlert','RlGauge','RlReadA','RlReadB','RlReadC','RlReadD']);
assert.strictEqual(parts[0].label,'Whole layout');
page.selectLayoutPart(1,true);page.adjust(0,1);page.adjust(1,-1);
assert.strictEqual(values.hudRlGearOffsetX,10);assert.strictEqual(values.hudRlGearOffsetY,-10);
page.adjust(2,1);assert.strictEqual(values.hudRlGearWidthScale,105);assert.strictEqual(values.hudRlGearHeightScale,105,'one Size control');
page.toggleHidden(false);assert.strictEqual(values.hudRlGearHidden,true);
page.saveSlot(1);assert.strictEqual(JSON.parse(values.hudLayoutSlot1).values.hudRlGearOffsetX,10,'saved with the slot');
page.resetLayout();page.resetLayout();assert.strictEqual(values.hudRlGearOffsetX,0);assert.strictEqual(values.hudRlGearHidden,false,'reset to defaults');
page.loadSlot(1);assert.strictEqual(values.hudRlGearOffsetX,10);assert.strictEqual(values.hudRlGearWidthScale,105);assert.strictEqual(values.hudRlGearHidden,true,'loaded back');
assert(!spec.settings.some(s=>/^hudRl/.test(s.key)),'kept outside app.json: the Store settings templates stay valid');
// 4. The cluster: its own design, readouts and element settings; drawn element by element in the cluster area.
const CL=require(root+'/draw');
const cl=settings({clusterDesign:'rl-arc',clusterAuxConfig:AUX,hudDesign:'own'}),clState=Object.assign(stateOf(cl),{mode:'SPORT'});
assert(RL.active(cl,'cluster')&&!RL.active(cl,'hud'),'cluster and HUD designs are separate');
assert.deepStrictEqual(D.partsFor('cluster',cl).map(p=>p.key),['RpmGauge','RlGear','RlMode','RlAlert','RlGauge','RlReadA','RlReadB','RlReadC','RlReadD']);
const area={x:0,y:0,w:1088,h:480},lay=RL.rect(cl,area,'cluster');assert.deepStrictEqual([lay.w,lay.h],[800,260],'800x260 at 100 %');assert.strictEqual(lay.x,144);
const img=CL.draw(clState);assert.strictEqual(img.w,1088);
let lit=0;for(let i=3;i<img.d.length;i+=4)if(img.d[i])lit++;assert(lit>20000,'cluster layout drawn ('+lit+' px)');
const clMoved=settings(Object.assign({},cl,{clusterRlGearOffsetX:100,clusterRlReadDHidden:true}));
const p0=RL.placed(clState,lay,'cluster'),p1=RL.placed(Object.assign({},clState,{config:clMoved}),RL.rect(clMoved,area,'cluster'),'cluster');
assert.strictEqual(p1.find(e=>e.id==='gear').r.x-p0.find(e=>e.id==='gear').r.x,200,'cluster offsets in image units (x2 on the cluster)');
assert(!p1.find(e=>e.id==='readD'),'hidden on the cluster');
assert.strictEqual(RL.placed(stateOf(settings(Object.assign({},base,{clusterRlGearOffsetX:100}))),layout).find(e=>e.id==='gear').r.x,before.find(e=>e.id==='gear').r.x,'cluster settings leave the HUD alone');
// 5. Cluster Redline's five layouts: readouts follow the auxiliary setting, the rings read the G-force,
// the ribbon takes the drive mode's colour.
const demand=require(root+'/data-demand').demand;
const rings=settings({clusterDesign:'rl-rings',clusterAuxConfig:JSON.stringify({mode:'values',items:['oil']}),allClusterOutput:'redline',sportClusterOutput:'redline'});
assert(demand(rings,'SPORT').aux.has('gforce'),'G-force read for the G meter even when it is not a readout');
assert(!demand(settings(Object.assign({},rings,{clusterRlGMeterHidden:true})),'SPORT').aux.has('gforce'),'not with the G meter hidden');
assert.deepStrictEqual(D.partsFor('cluster',rings).map(p=>p.key),['RpmGauge','RlGear','RlMode','RlRpm','RlGauge','RlGMeter','RlRead']);
const labels=items=>RL.frame(stateOf(settings({clusterDesign:'rl-logger',clusterAuxConfig:JSON.stringify({mode:'values',items})})),0,'cluster').readouts.map(r=>r.label);
assert.notDeepStrictEqual(labels(['boost','torque']),labels(['oil','economy']),'readouts follow the chosen auxiliary items');assert.strictEqual(labels(['oil','torque','economy']).length,3);
const ribbon=mode=>{const st=Object.assign(stateOf(settings({hudDesign:'rl-ribbon'})),{mode,rpm:4000});const cv=new Canvas(800,480);cv.clear([0,0,0,0]);RL.placed(st,{x:200,y:100,w:400,h:176}).filter(e=>e.id==='gauge').forEach(e=>blitScaled(cv,RL.partPainter(st,e.id,e.b,e.r).draw(st),e.r));
 const n={};for(let i=0;i<cv.d.length;i+=4)if(cv.d[i+3]>200){const k=cv.d[i]>200&&cv.d[i+2]<80?'orange':cv.d[i+2]>200&&cv.d[i]<120?'blue':cv.d[i+1]>180&&cv.d[i]<120?'green':'';if(k)n[k]=(n[k]||0)+1;}return Object.keys(n).sort((x,y)=>n[y]-n[x])[0];};
assert.strictEqual(ribbon('SPORT'),'orange');assert.strictEqual(ribbon('COMFORT'),'blue');assert.strictEqual(ribbon('ECO_PRO'),'green');
console.log('PASS: Redline layouts split into elements matching the original image; each moves, sizes uniformly and hides; Whole layout still moves all; Position / size lists them and saves, loads and resets them; the same on the cluster with its own settings');
