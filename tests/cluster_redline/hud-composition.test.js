'use strict';
const assert=require('assert'),path=require('path');
const root=path.join(path.resolve(process.argv[2]),'source/javascript');
const paint=require(path.join(root,'hud-compose')),navPaint=require(path.join(root,'nav-draw'));
const {settings}=require('../../apps/cluster_redline/policy');
const {placement}=require('../../apps/cluster_redline/layout');
const base={config:settings(),rpm:5200,gear:'S4',torqueNm:320,powerPS:220,torquePeak:400,powerPeak:240,shift:false,flash:false};
const nav={visible:true,maneuver:'RIGHT',distanceText:'300 m',provider:'ANDROID_AUTO'};
const off=paint.draw(base),on=paint.draw(Object.assign({},base,{navigation:nav}));
assert(!Buffer.from(off.d).equals(Buffer.from(on.d)));
const rect=placement(base.config,'hudNav',navPaint);
assert.deepStrictEqual([rect.x,rect.y,rect.w,rect.h],[280,240,240,112]);
function check(a,b) {const old=Buffer.from(a.d),next=Buffer.from(b.d),restored=Buffer.from(old),delta=paint.difference(old,next);let offset=0;for(const r of delta.rects){for(let y=r.y;y<r.y+r.h;y++){const n=r.w*4;delta.pixels.copy(restored,(y*paint.W+r.x)*4,offset,offset+n);offset+=n;}}assert(restored.equals(next));return delta;}
const erased=check(on,off);assert(erased.rects.every(r=>r.y>=240),'clearing navigation must not rewrite RPM/gauges');
for(const change of [{hudNavOffsetX:100},{hudNavOffsetY:-100},{hudNavWidthScale:150,hudNavHeightScale:150}]) {
 const next=paint.draw(Object.assign({},base,{navigation:nav,config:settings(change)}));check(on,next);
 // HUD Redline above navigation is bit-identical despite independent nav movement/scaling.
 if(!change.hudNavOffsetY)assert(Buffer.from(on.d).slice(0,220*800*4).equals(Buffer.from(next.d).slice(0,220*800*4)));
}
assert(Buffer.from(paint.draw(Object.assign({},base,{navigation:nav,config:settings({hudNavigationEnabled:false})})).d).equals(Buffer.from(off.d)));
for(const dir of ['LEFT','RIGHT','STRAIGHT_ON','SLIGHT_LEFT','SLIGHT_RIGHT','UTURN_LEFT','UTURN_RIGHT','ROUNDABOUT']) {
 const image=navPaint.draw(Object.assign({},nav,{maneuver:dir,exitNumber:3}));assert(image.d.some((v,i)=>i%4===3&&v>0));
}
console.log('PASS: actual navigation composition, independent placement/scaling, unchanged RPM area, full alpha erasure and every supported arrow');
