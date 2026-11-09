'use strict';
const assert=require('assert'),path=require('path');
const {decodeDart}=require('../../apps/cluster_redline/native-navigation');
const {decodeReply}=require('../../apps/cluster_redline/route-events');
const {settings}=require('../../apps/cluster_redline/policy');
const {placement}=require('../../apps/cluster_redline/layout');
const root=path.join(path.resolve(process.argv[2]),'source/javascript'),nav=require(path.join(root,'nav-draw')),hud=require(path.join(root,'hud-compose'));
const cases=[['HIGHWAY_IN_LEFT',3,'SLIGHT_LEFT','entry'],['HIGHWAY_IN_RIGHT',4,'SLIGHT_RIGHT','entry'],['HIGHWAY_IN_STRAIGHT',5,'STRAIGHT_ON','entry'],['HIGHWAY_OUT_LEFT',6,'SLIGHT_LEFT','exit'],['HIGHWAY_OUT_RIGHT',7,'SLIGHT_RIGHT','exit'],['HIGHWAY_OUT_STRAIGHT',8,'STRAIGHT_ON','exit']];
const payload=branchType=>({maneuver:{branch:{branchType,unreliable:false,formattedDistance:{distance:'300',unit:'METER'}}}});
const base={config:settings({hudAlertStyle:'circle'}),rpm:3860,gear:'M3',shift:false,flash:true,torqueNm:420,powerPS:180,torquePeak:450,powerPeak:200};
const without=hud.draw(base),images={};
function count(image,x0,y0,x1,y1){let n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(image.d[(y*image.w+x)*4+3])n++;return n;}
function reconstruct(a,b){const prev=Buffer.from(a.d),next=Buffer.from(b.d),delta=hud.difference(prev,next),copy=Buffer.from(prev);let at=0;for(const r of delta.rects)for(let y=r.y;y<r.y+r.h;y++){const bytes=r.w*4;delta.pixels.copy(copy,(y*hud.W+r.x)*4,at,at+bytes);at+=bytes;}assert(copy.equals(next));return delta;}
for(const [name,numeric,direction,action] of cases){
 const decoded=decodeDart(payload(name)),numbered=decodeDart(payload(numeric));
 assert.deepStrictEqual(numbered,decoded);assert.strictEqual(decoded.branchType,name);assert.strictEqual(decoded.maneuver,direction);
 const query=decodeReply({GuidanceEventListError:'NO_ERROR',viewContent:[{eventsInView:[payload(name).maneuver]}]});assert.deepStrictEqual(query.value,decoded);
 const state=Object.assign({visible:true,provider:'ANDROID_AUTO'},decoded),info=nav.highwayInfo(state);assert.strictEqual(info.action,action);assert.strictEqual(info.side,name.split('_').pop());
 const image=nav.draw(state);assert(count(image,0,0,104,112)>100,'highway diagram is drawn');assert(count(image,108,0,240,40)>10,'entry or exit notification is drawn');assert(count(image,108,45,240,105)>10,'distance remains visible');
 const full=hud.draw(Object.assign({},base,{navigation:state}));images[name]=full;
 assert(Buffer.from(full.d).subarray(0,220*800*4).equals(Buffer.from(without.d).subarray(0,220*800*4)),'navigation never rewrites the existing RPM/gauge region at default placement');
 const cleared=reconstruct(full,without);assert(cleared.rects.every(r=>r.y>=240));
 for(const config of [settings({hudNavOffsetX:80}),settings({hudNavWidthScale:150,hudNavHeightScale:150})]){
  const shifted=hud.draw(Object.assign({},base,{config,navigation:state}));reconstruct(full,shifted);
  const r=placement(config,'hudNav',nav);assert(r.x>=0&&r.y>=0&&r.x+r.w<=800&&r.y+r.h<=480);
 }
 assert(Buffer.from(hud.draw(Object.assign({},base,{config:settings({hudNavigationEnabled:false}),navigation:state})).d).equals(Buffer.from(hud.draw(Object.assign({},base,{config:settings({hudNavigationEnabled:false})})).d)));
 const bad=payload(name);bad.maneuver.branch.unreliable=true;assert.strictEqual(decodeDart(bad),null);
}
assert(!Buffer.from(images.HIGHWAY_IN_RIGHT.d).equals(Buffer.from(images.HIGHWAY_OUT_RIGHT.d)),'entry and exit cannot reuse one arrow image');
assert(!Buffer.from(images.HIGHWAY_IN_RIGHT.d).equals(Buffer.from(images.HIGHWAY_IN_LEFT.d)));
reconstruct(images.HIGHWAY_IN_RIGHT,images.HIGHWAY_OUT_RIGHT);
for(const name of ['FORK_RIGHT','BRANCH_LEFT','TRIPLE_FORK_STRAIGHT']){
 const state=Object.assign({visible:true},decodeDart(payload(name)));assert.strictEqual(nav.highwayInfo(state),null,'ordinary branch must not become a highway alert');
}
for(const state of [{kind:'intersection',branchType:'HIGHWAY_IN_RIGHT'}, {kind:'branch',branchType:'HIGHWAY_IN_UNKNOWN'},{}])assert.strictEqual(nav.highwayInfo(state),null);
const silent=nav.draw({visible:false,kind:'branch',branchType:'HIGHWAY_OUT_RIGHT'});assert(!silent.d.some(v=>v));
console.log('PASS: all six real-catalog highway variants, named/numeric and route-query decoding, distinct entry/exit direction diagrams, labels + distance, unchanged RPM, independent placement/scaling, erasure and invalid-data gates');
