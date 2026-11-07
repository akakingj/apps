'use strict';
const assert=require('assert'),path=require('path');
const {EventEmitter}=require('events'),{Controller}=require('../../apps/cluster_redline/controller'),{settings}=require('../../apps/cluster_redline/policy');
const stage=path.resolve(process.argv[2]),dir=path.join(stage,'source/javascript'),hud=require(path.join(dir,'hud-draw')),cluster=require(path.join(dir,'draw'));
class Client extends EventEmitter{
 constructor(targets){super();this.targets=targets;this.ready=true;this.next=0;this.made=[];this.active=new Set();}
 image(o){assert.strictEqual(this.active.size,0);this.made.push(o);const n=++this.next;this.active.add(n);return n}
 pixels(){}showWhenSent(){}set(){}drop(n){this.active.delete(n)}close(){}
}
const client=new Client('map:1088x480,panel:1920x720,hud:800x480'),c=new Controller(client,cluster,hud);
c.policy.modeSample(1,0);c.policy.rpmSample(5000,1000);c.gear='1';c.gearMode='M';assert(c.tick(1000).requested);
let state=c.tick(1050,{displayTarget:'hud'}),image=client.made[client.made.length-1];assert(state.requested);assert.strictEqual(state.gear,'M1');
assert.deepStrictEqual([image.target,image.iw,image.ih,image.x,image.y,image.w,image.h],['hud',800,240,100,50,600,180]);
assert.strictEqual(image.contend,false);assert.strictEqual(image.exclusive,false);assert.strictEqual(image.guide_hold,false);assert.strictEqual(image.prewarm,false);
for(const targets of ['map:1088x480','hud:353x203','']){const x=new Controller(new Client(targets),cluster,hud);x.policy.modeSample(1,0);x.policy.rpmSample(4000,1000);assert.strictEqual(x.tick(1000,{displayTarget:'hud'}).reason,'target_unavailable')}
const cfg=settings({displayTarget:'hud'}),base={config:cfg,gear:'M1',rpm:4000,shift:false,flash:false,torqueNm:380,powerPS:216,torquePeak:410,powerPeak:250};
const before=hud.draw(base),warn=hud.draw(Object.assign({},base,{rpm:5000})),red=hud.draw(Object.assign({},base,{rpm:5500,shift:true,flash:true})),dim=hud.draw(Object.assign({},base,{rpm:5500,shift:true,flash:false}));
const px=(cv,x,y)=>Array.from(cv.d.slice((y*hud.W+x)*4,(y*hud.W+x)*4+4));
assert.strictEqual(hud.alertStage(base),'green');assert.strictEqual(hud.alertStage(Object.assign({},base,{rpm:5000})),'yellow');
assert.deepStrictEqual(px(before,85,90),[25,238,103,255]);assert.deepStrictEqual(px(warn,85,90),[255,213,34,255]);
assert.deepStrictEqual(px(red,85,90),[255,42,42,255]);assert.notDeepStrictEqual(px(red,85,90),px(dim,85,90));
assert.deepStrictEqual(px(hud.draw(Object.assign({},base,{rpm:700})),85,40),[0,0,0,255]);
assert.strictEqual(px(before,0,0)[3],0);assert.strictEqual(px(before,790,235)[3],0);
const torque=hud.draw(Object.assign({},base,{torqueNm:210,torquePeak:450}));
const power=hud.draw(Object.assign({},base,{powerPS:180,powerPeak:290}));
const peak=hud.draw(Object.assign({},base,{torquePeak:480,powerPeak:295}));
const converted=hud.draw(Object.assign({},base,{config:settings({torqueUnit:'kgfm',powerUnit:'kW'})}));
const missing=hud.draw(Object.assign({},base,{torqueNm:null,powerPS:null}));
for(const [a,b] of [[before,red],[red,before],[red,dim],[before,hud.draw(Object.assign({},base,{gear:'D10'}))],
 [before,torque],[before,power],[before,peak],[before,converted],[converted,before],[before,missing],[missing,before]]){
 const aa=Buffer.from(a.d),bb=Buffer.from(b.d),copy=Buffer.from(aa),d=hud.difference(aa,bb);let off=0;
 for(const r of d.rects)for(let y=r.y;y<r.y+r.h;y++){const n=r.w*4;d.pixels.copy(copy,(y*hud.W+r.x)*4,off,off+n);off+=n;}
 assert(copy.equals(bb));assert.strictEqual(off,d.pixels.length);assert(d.pixels.length<aa.length/2);
}
// Value/peak changes stay in the corresponding mini-gauge region; neither
// a changing gauge nor changing RPM requires retransmitting its sibling.
for(const [next,left,right] of [[torque,0,hud.layout.rpmLeft],[power,hud.layout.rpmRight,630]]) {
 const d=hud.difference(Buffer.from(before.d),Buffer.from(next.d));
 assert(d.rects.length>0);for(const r of d.rects){assert(r.x>=left && r.x+r.w<=right && r.y>=155)}
}
const {Canvas}=require(path.join(dir,'kit/canvas')),originalText=Canvas.prototype.text;
let texts=[];
Canvas.prototype.text=function(value,x,y,size,color,opts){
 opts=opts||{};const width=this.textWidth(value,size,opts),left=opts.align==='right'?x-width:opts.align==='center'?x-width/2:x;
 texts.push({value:String(value),x,y,size,left,right:left+width});return originalText.apply(this,arguments);
};
try {
 for(const rpm of [700,1000,5500,9990,20000]){
  texts=[];hud.draw(Object.assign({},base,{rpm}));
  const digits=texts.find(t=>t.y===hud.layout.baseline&&t.size>24),suffix=texts.find(t=>t.value==='RPM');
  assert(digits&&suffix);assert(digits.left>=hud.layout.rpmLeft&&suffix.right<=hud.layout.rpmRight);
  assert(digits.left-(hud.layout.torqueLeft+hud.layout.miniWidth)>=12);
  assert(hud.layout.powerLeft-suffix.right>=12);
  const heads=texts.filter(t=>t.y===hud.layout.miniBaseline);
  assert(heads.some(t=>t.value==='Torque'));assert(heads.some(t=>t.value==='Power*'));
  for(const t of heads.concat(texts.filter(t=>t.y===hud.layout.miniLabels)))assert(t.left>=hud.layout.left&&t.right<=hud.layout.right,'mini values and scale labels must stay under the RPM bar');
  for(const left of [hud.layout.torqueLeft,hud.layout.powerLeft]){
   const head=heads.filter(t=>t.left>=left&&t.right<=left+hud.layout.miniWidth).sort((a,b)=>a.left-b.left);
   assert.strictEqual(head.length,3);assert(head[0].right+6<=head[1].left,'gauge label must clear its number');assert(head[1].right+3<=head[2].left,'unit must clear number');
  }
 }
 texts=[];hud.draw(Object.assign({},base,{config:settings({torqueUnit:'kgfm',powerUnit:'kW'})}));
 const header=texts.filter(t=>t.y===hud.layout.miniBaseline).map(t=>t.value);
 assert(header.includes('kgf·m')&&header.includes('kW'));
 assert(header.includes((380/9.80665).toFixed(1))&&header.includes((216*0.73549875).toFixed(0)),'displayed values must convert, not only unit labels');
 assert(texts.some(t=>t.y===hud.layout.miniLabels&&t.value===(cfg.torqueScale/9.80665).toFixed(1)));
 assert(texts.some(t=>t.y===hud.layout.miniLabels&&t.value===(cfg.powerScale*0.73549875).toFixed(0)));
}finally{Canvas.prototype.text=originalText}
c.policy.modeSample(4,1100);assert.strictEqual(c.tick(1100,{displayTarget:'hud'}).requested,false);assert.strictEqual(client.active.size,0);
console.log('PASS: compact slanted HUD, M1/right-side gear, 5500 threshold, green/yellow/red blink, native-guidance yield flags, flanking converted torque/power gauges with bounded text/gaps, exact metric/peak/unit deltas and release');
