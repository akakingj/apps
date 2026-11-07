'use strict';
const assert=require('assert'),path=require('path');
const mark=require('../../apps/cluster_redline/m-mark');
const image=mark.raster(),px=(img,x,y)=>Array.from(img.d.slice((y*img.w+x)*4,(y*img.w+x)*4+4));
assert.strictEqual(image.w,88);assert.strictEqual(image.h,28);
assert.strictEqual(mark.raster(),image,'the unchanged mark is rendered once and cached');
assert.strictEqual(px(image,0,0)[3],0);
assert.strictEqual(px(image,56,26)[3],0,'the open M cutout stays transparent');
// All three filled stripe bodies are visible, not just strokes.
const blue=px(image,18,13),dark=px(image,33,13),red=px(image,47,13);
assert(blue[2]>200&&blue[1]>100&&blue[0]<100&&blue[3]===255);
assert(dark[2]>dark[1]&&dark[1]>dark[0]&&dark[2]<180&&dark[3]===255);
assert(red[0]>200&&red[1]<70&&red[2]<80&&red[3]===255);
let filledM=0,softEdges=0;
for(let y=0;y<image.h;y++)for(let x=0;x<image.w;x++){
 const p=px(image,x,y);if(x>=58&&p[3]===255)filledM++;if(p[3]>0&&p[3]<255)softEdges++;
}
assert(filledM>400,'the M must have a solid, broad body');assert(softEdges>40,'slanted boundaries must be anti-aliased');
const upper=px(image,85,3),middle=px(image,85,13),lower=px(image,85,22);
assert(upper[0]>middle[0]+70&&lower[0]>middle[0]+70,'silver has a dark middle and bright top/bottom');
assert(Math.abs(upper[0]-upper[2])<35&&Math.abs(lower[0]-lower[2])<35,'M body remains silver, not a coloured glyph');
assert.throws(()=>mark.raster(0,20));assert.throws(()=>mark.raster(Infinity,20));
if(process.argv[2]){
 const {Canvas}=require(path.join(path.resolve(process.argv[2]),'source/javascript/kit/canvas'));
 const cv=new Canvas(180,70);cv.clear([0,0,0,0]);mark.drawMark(cv,90,20);
 const x0=90-image.w/2;
 for(let y=0;y<cv.h;y++)for(let x=0;x<cv.w;x++){
  if(x<x0||x>=x0+image.w||y<20||y>=20+image.h)assert.strictEqual(px(cv,x,y)[3],0,'mark must preserve all pixels outside its bounds');
 }
}
console.log('PASS: filled silver/bevel M, three shaded stripes, anti-aliased transparent bounds and cached small render');
