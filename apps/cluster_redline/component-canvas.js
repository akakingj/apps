'use strict';
const {Canvas}=require('./kit/canvas');
function blitScaled(dst,src,r){
 if(!r.w||!r.h)return;
 for(let y=Math.max(0,r.y);y<Math.min(dst.h,r.y+r.h);y++)for(let x=Math.max(0,r.x);x<Math.min(dst.w,r.x+r.w);x++){
  const i=(Math.min(src.h-1,Math.floor((y-r.y+0.5)*src.h/r.h))*src.w+Math.min(src.w-1,Math.floor((x-r.x+0.5)*src.w/r.w)))*4;
  const a=src.d[i+3]/255;if(!a)continue;const p=(y*dst.w+x)*4,da=dst.d[p+3]/255,oa=a+da*(1-a);
  for(let k=0;k<3;k++)dst.d[p+k]=Math.round((src.d[i+k]*a+dst.d[p+k]*da*(1-a))/oa);dst.d[p+3]=Math.round(oa*255);
 }
}
function translated(cv,x,y){
 return {textWidth:(v,s,o)=>cv.textWidth(v,s,o),text:(v,a,b,s,c,o)=>cv.text(v,a+x,b+y,s,c,o),
  line:(a,b,c,d,w,t)=>cv.line(a+x,b+y,c+x,d+y,w,t),polyline:(p,w,c)=>cv.polyline(p.map(v=>[v[0]+x,v[1]+y]),w,c),
  quad:(p,c)=>cv.quad(p.map(v=>[v[0]+x,v[1]+y]),c),arc:(a,b,r0,r1,s,e,c)=>cv.arc(a+x,b+y,r0,r1,s,e,c),
  fillRect:(a,b,w,h,c)=>cv.fillRect(a+x,b+y,w,h,c),roundRect:(a,b,w,h,r,c)=>cv.roundRect(a+x,b+y,w,h,r,c),blit:(im,a,b)=>cv.blit(im,a+x,b+y)};
}
function part(cv,cfg,display,name,bounds,paint){
 const visiblePaint=c=>{if(!cfg[display+name+'Hidden'])paint(c);};
 if(typeof cv.part==='function'){cv.part(cfg,display,name,bounds,visiblePaint);return;}
 if(cfg[display+name+'Hidden'])return;
 const prefix=display+name,x=cfg[prefix+'OffsetX']||0,y=cfg[prefix+'OffsetY']||0,sx=(cfg[prefix+'WidthScale']||100)/100,sy=(cfg[prefix+'HeightScale']||100)/100;
 if(!x&&!y&&sx===1&&sy===1){paint(cv);return;}
 const image=new Canvas(Math.ceil(bounds.w),Math.ceil(bounds.h));image.clear([0,0,0,0]);paint(translated(image,-bounds.x,-bounds.y));
 const r={x:Math.round(bounds.x+bounds.w*(1-sx)/2+x),y:Math.round(bounds.y+bounds.h*(1-sy)/2+y),w:Math.round(bounds.w*sx),h:Math.round(bounds.h*sy)};
 if(cv.d){blitScaled(cv,image,r);return;}
 // Native settings previews use default component transforms (no image opcode).
 const resized=new Canvas(r.w,r.h);blitScaled(resized,image,{x:0,y:0,w:r.w,h:r.h});cv.blit(resized,r.x,r.y);
}
function drawWithParts(painter,state,dst,rect,display){
 const base=new Canvas(painter.W,painter.H),pending=[];base.clear([0,0,0,0]);
 base.part=(cfg,d,name,bounds,paint)=>{
  if(cfg[d+name+'Hidden'])return;
  const key=d+name,ox=cfg[key+'OffsetX']||0,oy=cfg[key+'OffsetY']||0,sx=(cfg[key+'WidthScale']||100)/100,sy=(cfg[key+'HeightScale']||100)/100;
  if(!ox&&!oy&&sx===1&&sy===1){paint(base);return;}
  const image=new Canvas(Math.ceil(bounds.w),Math.ceil(bounds.h));image.clear([0,0,0,0]);paint(translated(image,-bounds.x,-bounds.y));
  const gx=rect.w/painter.W,gy=rect.h/painter.H;
  pending.push({image,r:{x:Math.round(rect.x+(bounds.x+bounds.w*(1-sx)/2+ox)*gx),y:Math.round(rect.y+(bounds.y+bounds.h*(1-sy)/2+oy)*gy),w:Math.max(1,Math.round(bounds.w*sx*gx)),h:Math.max(1,Math.round(bounds.h*sy*gy))}});
 };
 painter.draw(state,base);blitScaled(dst,base,rect);
 // Modified parts use the full HUD target, rather than disappearing at the
 // edge of the original RPM-face rectangle when moved towards navigation.
 pending.forEach(p=>blitScaled(dst,p.image,p.r));
}
function measurePart(painter,state,display,name,textCanvas){
 let bounds=null;const noop=()=>{},cv={clear:noop,text:noop,line:noop,polyline:noop,quad:noop,arc:noop,fillRect:noop,roundRect:noop,blit:noop,textWidth:(v,s,o)=>textCanvas.textWidth(v,s,o),part:(cfg,d,n,b)=>{if(d===display&&n===name)bounds=b;}};
 painter.draw(state,cv);return bounds;
}
module.exports={part,blitScaled,translated,drawWithParts,measurePart};
