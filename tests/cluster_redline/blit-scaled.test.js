'use strict';
// blitScaled must stay bit-identical to the original per-pixel "source over" formula.
const assert=require('assert'),path=require('path');
const root=path.join(path.resolve(process.argv[2]),'source/javascript'),{blitScaled}=require(root+'/component-canvas');
function reference(dst,src,r){
 if(!r.w||!r.h)return;
 for(let y=Math.max(0,r.y);y<Math.min(dst.h,r.y+r.h);y++)for(let x=Math.max(0,r.x);x<Math.min(dst.w,r.x+r.w);x++){
  const i=(Math.min(src.h-1,Math.floor((y-r.y+0.5)*src.h/r.h))*src.w+Math.min(src.w-1,Math.floor((x-r.x+0.5)*src.w/r.w)))*4;
  const a=src.d[i+3]/255;if(!a)continue;const p=(y*dst.w+x)*4,da=dst.d[p+3]/255,oa=a+da*(1-a);
  for(let k=0;k<3;k++)dst.d[p+k]=Math.round((src.d[i+k]*a+dst.d[p+k]*da*(1-a))/oa);dst.d[p+3]=Math.round(oa*255);
 }
}
let seed=12345;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
function image(w,h,mode){
 const d=new Uint8Array(w*h*4);
 for(let i=0;i<w*h;i++){const m=rnd(),a=mode==='opaque'?255:mode==='clear'?0:m<.3?0:m<.6?255:Math.floor(rnd()*256);d[i*4]=rnd()*256;d[i*4+1]=rnd()*256;d[i*4+2]=rnd()*256;d[i*4+3]=a;}
 return {w,h,d};
}
const modes=['mixed','opaque','clear','mixed'];
for(let n=0;n<1500;n++){
 const src=image(1+Math.floor(rnd()*80),1+Math.floor(rnd()*60),modes[n%4]),expected=image(1+Math.floor(rnd()*90),1+Math.floor(rnd()*60),modes[(n>>2)%4]);
 const actual={w:expected.w,h:expected.h,d:Uint8Array.from(expected.d)};
 const r={x:Math.floor(rnd()*140)-40,y:Math.floor(rnd()*100)-30,w:Math.floor(rnd()*120),h:Math.floor(rnd()*80)};
 reference(expected,src,r);blitScaled(actual,src,r);
 assert.deepStrictEqual(Buffer.from(actual.d),Buffer.from(expected.d),'blitScaled differs from reference for case '+n+' '+JSON.stringify(r));
}
console.log('PASS: blitScaled is pixel-identical to the reference formula (opaque, transparent, translucent, clipped and empty rectangles)');
