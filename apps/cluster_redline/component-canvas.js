'use strict';
const {Canvas}=require('./kit/canvas');
// Nearest-neighbour scaled "source over" blit. Output is bit-identical to the original
// per-pixel formula; the source column table is computed once per call instead of once per
// pixel, and fully opaque source pixels / empty destination pixels are copied directly.
function blitScaled(dst,src,r){
 if(!r.w||!r.h)return;
 const x0=Math.max(0,r.x),x1=Math.min(dst.w,r.x+r.w),y0=Math.max(0,r.y),y1=Math.min(dst.h,r.y+r.h);
 if(x0>=x1||y0>=y1)return;
 const sd=src.d,dd=dst.d,sw=src.w,sh=src.h,dw=dst.w,n=x1-x0,cols=new Int32Array(n);
 for(let c=0;c<n;c++)cols[c]=Math.min(sw-1,Math.floor((x0+c-r.x+0.5)*sw/r.w))*4;
 for(let y=y0;y<y1;y++){
  const row=Math.min(sh-1,Math.floor((y-r.y+0.5)*sh/r.h))*sw*4;
  for(let c=0,p=(y*dw+x0)*4;c<n;c++,p+=4){
   const i=row+cols[c],sa=sd[i+3];if(!sa)continue;
   if(sa===255||!dd[p+3]){dd[p]=sd[i];dd[p+1]=sd[i+1];dd[p+2]=sd[i+2];dd[p+3]=sa;continue;}
   const a=sa/255,da=dd[p+3]/255,oa=a+da*(1-a);
   dd[p]=Math.round((sd[i]*a+dd[p]*da*(1-a))/oa);dd[p+1]=Math.round((sd[i+1]*a+dd[p+1]*da*(1-a))/oa);dd[p+2]=Math.round((sd[i+2]*a+dd[p+2]*da*(1-a))/oa);dd[p+3]=Math.round(oa*255);
  }
 }
}
function translated(cv,x,y){
 return {textWidth:(v,s,o)=>cv.textWidth(v,s,o),text:(v,a,b,s,c,o)=>cv.text(v,a+x,b+y,s,c,o),
  line:(a,b,c,d,w,t)=>cv.line(a+x,b+y,c+x,d+y,w,t),polyline:(p,w,c)=>cv.polyline(p.map(v=>[v[0]+x,v[1]+y]),w,c),
  quad:(p,c)=>cv.quad(p.map(v=>[v[0]+x,v[1]+y]),c),arc:(a,b,r0,r1,s,e,c)=>cv.arc(a+x,b+y,r0,r1,s,e,c),
  fillRect:(a,b,w,h,c)=>cv.fillRect(a+x,b+y,w,h,c),roundRect:(a,b,w,h,r,c)=>cv.roundRect(a+x,b+y,w,h,r,c),blit:(im,a,b)=>cv.blit(im,a+x,b+y)};
}
function part(cv,cfg,display,name,bounds,paint,sub){
 const visiblePaint=c=>{if(!cfg[display+name+'Hidden'])paint(c);};
 if(typeof cv.part==='function'){cv.part(cfg,display,name,bounds,visiblePaint,sub);return;}
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
 if(state.renderCache){state.renderCache.face(painter,state,rect,display);return;}
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
// What changed between two frames (RGBA, w x h) as at most `max` rectangles and their rows packed one rectangle
// after another, for the renderer. Rows are scanned in bands; within a band the changed columns are grouped into
// runs (gaps shorter than `gap` joined), so an arc's ends or two readouts do not drag the whole width along; then
// the rectangles are merged, cheapest union first, down to `max` (the renderer client falls back to a whole frame
// beyond 16 pending rectangles).
function dirtyRects(previous,next,w,h,opt){
 const o=opt||{},band=o.band||20,gap=o.gap||24,max=o.max||12,stride=w*4;
 const aligned=previous.byteOffset%4===0&&next.byteOffset%4===0;
 const A=aligned?new Uint32Array(previous.buffer,previous.byteOffset,w*h):null,B=aligned?new Uint32Array(next.buffer,next.byteOffset,w*h):null;
 const cols=new Uint8Array(w);let rects=[];
 for(let top=0;top<h;top+=band){
  const bottom=Math.min(h,top+band);let first=-1,last=-1,lo=w,hi=-1;cols.fill(0);
  for(let y=top;y<bottom;y++){
   const off=y*stride;if(previous.compare(next,off,off+stride,off,off+stride)===0)continue;
   if(first<0)first=y;last=y;const row=y*w;
   for(let x=0;x<w;x++){const same=aligned?A[row+x]===B[row+x]:previous.readUInt32LE((row+x)*4)===next.readUInt32LE((row+x)*4);if(!same){cols[x]=1;if(x<lo)lo=x;if(x>hi)hi=x;}}
  }
  if(first<0)continue;
  let x=lo;while(x<=hi){if(!cols[x]){x++;continue;}let end=x,blank=0;for(let k=x+1;k<=hi;k++){if(cols[k]){end=k;blank=0;}else if(++blank>=gap)break;}
   rects.push({x,y:first,w:end-x+1,h:last-first+1});x=end+1;}
 }
 const union=(a,b)=>{const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};};
 const area=r=>r.w*r.h,overlap=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
 // overlapping rectangles are always merged (rows must not be sent twice), then the cheapest pairs
 for(let again=true;again;){again=false;for(let i=0;i<rects.length&&!again;i++)for(let j=i+1;j<rects.length;j++)if(overlap(rects[i],rects[j])){rects[i]=union(rects[i],rects[j]);rects.splice(j,1);again=true;break;}}
 while(rects.length>max){let best=null,cost=Infinity;
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const u=union(rects[i],rects[j]),c=area(u)-area(rects[i])-area(rects[j]);if(c<cost){cost=c;best=[i,j,u];}}
  rects[best[0]]=best[2];rects.splice(best[1],1);
  for(let again=true;again;){again=false;for(let i=0;i<rects.length&&!again;i++)for(let j=i+1;j<rects.length;j++)if(overlap(rects[i],rects[j])){rects[i]=union(rects[i],rects[j]);rects.splice(j,1);again=true;break;}}
 }
 rects.sort((a,b)=>a.y-b.y||a.x-b.x);
 let size=0;rects.forEach(r=>{size+=r.w*r.h*4;});const px=Buffer.allocUnsafe(size);let at=0;
 rects.forEach(r=>{for(let y=r.y;y<r.y+r.h;y++){const s=(y*w+r.x)*4;next.copy(px,at,s,s+r.w*4);at+=r.w*4;}});
 return {rects,pixels:px};
}
module.exports={dirtyRects,part,blitScaled,translated,drawWithParts,measurePart};
