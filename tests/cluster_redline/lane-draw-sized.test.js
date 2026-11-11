'use strict';
// HUD lanes are painted at their final size and keep one arrow size for any lane count.
const assert=require('assert'),path=require('path'),root=path.join(path.resolve(process.argv[2]),'source/javascript');
const LANE=require(root+'/lane-draw'),D=require(root+'/display-config'),{settings}=require('../../apps/cluster_redline/policy');
const lane=(d,hl)=>({directions:[d],other:[],highlighted:!!hl,blocked:false});
for(const scale of [20,70,100,200]){
 const r=D.navRect(settings({hudLanesScale:scale}),'Lanes'),im=LANE.drawSized({visible:true,lanes:[lane('STRAIGHT_ON',true)],color:'blue'},r.w,r.h);
 assert.strictEqual(im.w,r.w);assert.strictEqual(im.h,r.h);
}
// Height of the highlighted (blue) straight arrow, measured in the tile.
function blueHeight(count){
 const lanes=Array.from({length:count},(_,i)=>lane('STRAIGHT_ON',i===0)),im=LANE.draw({visible:true,lanes,color:'blue'});let top=im.h,bottom=-1;
 for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++){const p=(y*im.w+x)*4;if(im.d[p+3]>200&&im.d[p+2]>200&&im.d[p]<120){top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 return bottom-top;
}
const sizes=[1,2,4,8].map(blueHeight);assert(sizes[0]>30,'arrow is drawn');sizes.forEach(h=>assert.strictEqual(h,sizes[0],'arrow size must not depend on the lane count: '+sizes));
console.log('PASS: lanes paint at the exact HUD rectangle for 20-200% and keep one arrow size for 1-8 lanes');
