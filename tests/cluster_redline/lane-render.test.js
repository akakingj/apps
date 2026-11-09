'use strict';
const assert=require('assert'),path=require('path'),root=path.join(path.resolve(process.argv[2]),'source/javascript');
const HUD=require(root+'/hud-compose'),LANE=require(root+'/lane-draw'),{decode}=require('../../apps/cluster_redline/lane-guidance'),{settings}=require('../../apps/cluster_redline/policy');
const lanes=Object.assign({visible:true},decode({rows:[{lanes:[{directionToFollow:'STRAIGHT_ON',isHighlighted:false},{directionToFollow:'RIGHT',isHighlighted:true}]}]}));
const nav={visible:true,maneuver:'RIGHT',distanceText:'300 m',description:'교차로',provider:'CAR_PLAY'},base={config:settings(),renderRpm:true,rpm:4000,gear:'M3',torqueNm:360,powerPS:205,aux:{},navigation:nav};
const plain=HUD.draw(base),withLanes=HUD.draw(Object.assign({},base,{navigation:Object.assign({},nav,{lanes})}));
assert(!Buffer.from(plain.d).equals(Buffer.from(withLanes.d)));
assert(Buffer.from(plain.d).slice(0,355*800*4).equals(Buffer.from(withLanes.d).slice(0,355*800*4)),'lane row does not alter RPM, text or the existing arrow');
assert(Buffer.from(HUD.draw(Object.assign({},base,{navigation:Object.assign({},nav,{lanes:{visible:false,lanes:lanes.lanes}})})).d).equals(Buffer.from(plain.d)));
const rpmOnly=HUD.draw(Object.assign({},base,{navigation:{visible:false}}));
assert(Buffer.from(HUD.draw(Object.assign({},base,{navigation:{visible:false,lanes}})).d).equals(Buffer.from(rpmOnly.d)),'lanes are not left behind without current guidance');
const a=Buffer.from(withLanes.d),b=Buffer.from(plain.d),copy=Buffer.from(a),delta=HUD.difference(a,b);let offset=0;
for(const r of delta.rects){assert(r.y>=355);for(let y=r.y;y<r.y+r.h;y++){const bytes=r.w*4;delta.pixels.copy(copy,(y*800+r.x)*4,offset,offset+bytes);offset+=bytes;}}
assert(copy.equals(b),'partial update fully erases vanished lane graphics');
const colors=['blue','white','gray'].map(color=>Buffer.from(LANE.draw(Object.assign({},lanes,{color})).d));assert(!colors[0].equals(colors[1])&&!colors[1].equals(colors[2]));
const reversed={visible:true,lanes:lanes.lanes.map((l,i)=>Object.assign({},l,{highlighted:i===0}))};assert(!colors[0].equals(Buffer.from(LANE.draw(Object.assign({},reversed,{color:'blue'})).d)),'recommendation changes visibly');
console.log('PASS: actual HUD lane composition, independent RPM/turn pixels, recommendation/colors and full alpha erasure');
