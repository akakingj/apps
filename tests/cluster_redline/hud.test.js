'use strict';
const assert=require('assert'),path=require('path');
const dir=path.join(path.resolve(process.argv[2]),'source/javascript');
const hud=require(path.join(dir,'hud-draw')),cluster=require(path.join(dir,'draw'));
const {settings}=require('../../apps/cluster_redline/policy');
const {placement}=require('../../apps/cluster_redline/layout');
const base={config:settings(),gear:'M1',rpm:4000,shift:false,flash:false,torqueNm:380,powerPS:216,torquePeak:410,powerPeak:250};
assert.deepStrictEqual([hud.W,hud.H],[800,240]);
const rect=placement(base.config,'hud',hud);
assert.deepStrictEqual([rect.x,rect.y,rect.w,rect.h],[100,50,600,180]);
assert(hud.layout.torqueLeft+hud.layout.miniWidth<hud.layout.rpmLeft);
assert(hud.layout.powerLeft>hud.layout.rpmRight);
assert(hud.layout.powerLeft+hud.layout.miniWidth<=hud.layout.right);
const before=hud.draw(base),frames=[];
for(const engineProfile of ['petrol','diesel','hybrid','m']) {
 const config=settings({engineProfile});
 for(const rpm of [0,700,3500,config.shiftRpm,config.redlineRpm,config.maxRpm])frames.push(hud.draw(Object.assign({},base,{config,rpm,shift:rpm>=config.shiftRpm,flash:true})));
}
for(const change of [{gear:'D10'},{gear:'P'},{torqueNm:null,powerPS:null},{torqueNm:210},{powerPS:100},{config:settings({torqueUnit:'kgfm',powerUnit:'kW'})}])frames.push(hud.draw(Object.assign({},base,change)));
function reconstruct(a,b,painter) {
 const aa=Buffer.from(a.d),bb=Buffer.from(b.d),copy=Buffer.from(aa),delta=painter.difference(aa,bb);let at=0;
 for(const r of delta.rects){assert(r.x>=0&&r.y>=0&&r.x+r.w<=painter.W&&r.y+r.h<=painter.H);for(let y=r.y;y<r.y+r.h;y++){const n=r.w*4;delta.pixels.copy(copy,(y*painter.W+r.x)*4,at,at+n);at+=n;}}
 assert(copy.equals(bb),'deltas must erase transparent pixels too');assert.strictEqual(at,delta.pixels.length);
 return delta;
}
for(const next of frames)reconstruct(before,next,hud);
const px=(cv,x,y)=>Array.from(cv.d.slice((y*cv.w+x)*4,(y*cv.w+x)*4+4));
for(const [x,y] of [[0,0],[799,239],[400,60]])assert.strictEqual(px(before,x,y)[3],0);
for(const rpm of [500,1500,2500,3500,4500,5500]) {
 const state=Object.assign({},base,{rpm:5900}),a=cluster.draw(state),b=hud.draw(state);
 const sample=(p)=>Math.round(p.left+(p.right-p.left-p.slant)*(rpm+200)/base.config.maxRpm+p.slant/2);
 const ac=px(a,sample(cluster.layout),132),bc=px(b,sample(hud.layout),92);
 // Different bar widths sample slightly different positions in the continuous ramp.
 assert(ac.slice(0,3).every((v,i)=>Math.abs(v-bc[i])<=6),'HUD/cluster share RPM-locked palette within raster sampling tolerance');
}
const zero=hud.draw(Object.assign({},base,{rpm:0}));assert.deepStrictEqual(px(zero,100,40),[0,0,0,255]);
const bright=hud.draw(Object.assign({},base,{rpm:5500,shift:true,flash:true})),dim=hud.draw(Object.assign({},base,{rpm:5500,shift:true,flash:false}));
assert(px(bright,100,40)[0]>220&&px(dim,100,40)[0]<150);
const blink=reconstruct(bright,dim,hud);assert(blink.rects.every(r=>r.y+r.h<=65));
assert(Buffer.from(bright.d).slice(155*hud.W*4).equals(Buffer.from(dim.d).slice(155*hud.W*4)),'RPM stays steadily red during LED flash');
console.log('PASS: prior800x240 HUD geometry, large side gauges and gaps, shared RPM palette, transparent edges and exact update/blink reconstruction across presets');
