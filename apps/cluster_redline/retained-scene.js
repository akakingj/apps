'use strict';
const {Canvas}=require('./kit/canvas'),{translated}=require('./component-canvas'),K=require('./render-state');
function intersection(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.w,b.x+b.w),bottom=Math.min(a.y+a.h,b.y+b.h);return right>x&&bottom>y?{x,y,w:right-x,h:bottom-y}:null;}
function bounds(b){const x=Math.floor(b.x),y=Math.floor(b.y);return {x,y,w:Math.ceil(b.x+b.w)-x,h:Math.ceil(b.y+b.h)-y};}
function same(a,b){return a&&b&&a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;}
function blend(dst,tile,r,clip){
 const area=intersection(r,clip);if(!area)return;
 const d=dst.d,s=tile.d;
 for(let y=area.y;y<area.y+area.h;y++)for(let x=area.x;x<area.x+area.w;x++){
  const p=(y*dst.w+x)*4,i=((y-r.y)*tile.w+x-r.x)*4,alpha=s[i+3];if(!alpha)continue;
  if(alpha===255||!d[p+3]){d[p]=s[i];d[p+1]=s[i+1];d[p+2]=s[i+2];d[p+3]=alpha;continue;}
  const a=alpha/255,da=d[p+3]/255,oa=a+da*(1-a);
  for(let k=0;k<3;k++)d[p+k]=Math.round((s[i+k]*a+d[p+k]*da*(1-a))/oa);d[p+3]=Math.round(oa*255);
 }
}
class RetainedScene{
 constructor(){this.nodes=new Map();this.surface=null;this.metrics={paints:0,hits:0,composites:0,clearedPixels:0};}
 begin(w,h){if(!this.surface||this.surface.w!==w||this.surface.h!==h){this.nodes.clear();this.surface=new Canvas(w,h);}this.order=[];this.changed=[];this.seen=new Set();}
 add(id,key,b,paint,project){
  const rawBounds=project.type==='scaled'?{x:b.x,y:b.y,w:Math.ceil(b.w),h:Math.ceil(b.h)}:bounds(b),geometry=JSON.stringify([rawBounds,project]),old=this.nodes.get(id),changed=!old||old.key!==key||old.geometry!==geometry;
  let node=old;
  if(changed){
   let image=old&&same(old.rawBounds,rawBounds)?old.image:new Canvas(rawBounds.w,rawBounds.h);
   if(!old||old.key!==key||!same(old.rawBounds,rawBounds)){image.clear([0,0,0,0]);paint(translated(image,-rawBounds.x,-rawBounds.y));this.metrics.paints++;}else this.metrics.hits++;
   const region=project.region(rawBounds),r=intersection(region,{x:0,y:0,w:this.surface.w,h:this.surface.h})||{x:0,y:0,w:0,h:0};
   const tile=old&&old.tile.w===r.w&&old.tile.h===r.h?old.tile:new Canvas(r.w,r.h);tile.clear([0,0,0,0]);
   let columns,rows;
   if(old&&old.geometry===geometry){columns=old.columns;rows=old.rows;}
   else{
    columns=new Int32Array(r.w);rows=new Int32Array(r.h);
    for(let x=0;x<r.w;x++){const sx=Math.round(project.sample(r.x+x,r.y,rawBounds)[0]-rawBounds.x);columns[x]=sx>=0&&sx<image.w?sx:-1;}
    for(let y=0;y<r.h;y++){const sy=Math.round(project.sample(r.x,r.y+y,rawBounds)[1]-rawBounds.y);rows[y]=sy>=0&&sy<image.h?sy*image.w:-1;}
   }
   const sourcePixels=new Uint32Array(image.d.buffer,image.d.byteOffset,image.d.length/4),targetPixels=new Uint32Array(tile.d.buffer,tile.d.byteOffset,tile.d.length/4);
   for(let y=0;y<r.h;y++){const row=rows[y],offset=y*r.w;for(let x=0;x<r.w;x++)targetPixels[offset+x]=row>=0&&columns[x]>=0?sourcePixels[row+columns[x]]:0;}
   node={id,key,geometry,rawBounds,image,tile,r,columns,rows};this.nodes.set(id,node);if(old)this.changed.push(old.r);this.changed.push(r);
  }else this.metrics.hits++;
  this.seen.add(id);this.order.push(node);
 }
 face(painter,state,rect,display){
  const pending=[],scaleX=rect.w/painter.W,scaleY=rect.h/painter.H;
  const collector={clear(){},textWidth:(...a)=>Canvas.prototype.textWidth.apply(this.surface,a),part:(cfg,d,name,b,paint,sub)=>{
   if(cfg[d+name+'Hidden'])return;
   const prefix=d+name,ox=cfg[prefix+'OffsetX']||0,oy=cfg[prefix+'OffsetY']||0,sx=(cfg[prefix+'WidthScale']||100)/100,sy=(cfg[prefix+'HeightScale']||100)/100;
   const normal=!ox&&!oy&&sx===1&&sy===1,id=d+'.'+name+'.'+(sub||''),key=K.partKey(state,d,name,sub);
   if(normal){
    const project={type:'base',rect,pw:painter.W,ph:painter.H,
     region:b=>({x:Math.floor(rect.x+b.x*scaleX),y:Math.floor(rect.y+b.y*scaleY),w:Math.ceil((b.x+b.w)*scaleX)-Math.floor(b.x*scaleX),h:Math.ceil((b.y+b.h)*scaleY)-Math.floor(b.y*scaleY)}),
     sample:(x,y)=>[Math.min(painter.W-1,Math.floor((x-rect.x+.5)/scaleX)),Math.min(painter.H-1,Math.floor((y-rect.y+.5)/scaleY))]};
    this.add(id,key,b,paint,project);
   }else{
    const r={x:Math.round(rect.x+(b.x+b.w*(1-sx)/2+ox)*scaleX),y:Math.round(rect.y+(b.y+b.h*(1-sy)/2+oy)*scaleY),w:Math.max(1,Math.round(b.w*sx*scaleX)),h:Math.max(1,Math.round(b.h*sy*scaleY))};
    pending.push(()=>this.addScaled(id,key,b,paint,r));
   }
  }};
  painter.draw(state,collector);pending.forEach(fn=>fn());
 }
 addScaled(id,key,b,paint,r){
  const project={type:'scaled',r,region:()=>r,sample:(x,y,raw)=>[raw.x+Math.min(raw.w-1,Math.floor((x-r.x+.5)*raw.w/r.w)),raw.y+Math.min(raw.h-1,Math.floor((y-r.y+.5)*raw.h/r.h))]};
  this.add(id,key,b,paint,project);
 }
 navigation(id,key,painter,state,r){this.addScaled('nav.'+id,JSON.stringify(key),{x:0,y:0,w:painter.W,h:painter.H},c=>{const im=painter.draw(state);c.blit(im,0,0);},r);}
 finish(){
  this.nodes.forEach((n,id)=>{if(!this.seen.has(id)){this.changed.push(n.r);this.nodes.delete(id);}});
  const regions=[];this.changed.forEach(r=>{if(!r.w||!r.h)return;let current=Object.assign({},r),again=true;while(again){again=false;for(let i=regions.length-1;i>=0;i--)if(intersection(current,regions[i])){const b=regions.splice(i,1)[0],x=Math.min(current.x,b.x),y=Math.min(current.y,b.y);current={x,y,w:Math.max(current.x+current.w,b.x+b.w)-x,h:Math.max(current.y+current.h,b.y+b.h)-y};again=true;}}regions.push(current);});
  regions.forEach(r=>{for(let y=r.y;y<r.y+r.h;y++)this.surface.d.fill(0,(y*this.surface.w+r.x)*4,(y*this.surface.w+r.x+r.w)*4);this.order.forEach(n=>blend(this.surface,n.tile,n.r,r));this.metrics.clearedPixels+=r.w*r.h;});
  if(regions.length)this.metrics.composites++;return this.surface;
 }
 stats(){let bytes=this.surface?this.surface.d.length:0;this.nodes.forEach(n=>{bytes+=n.image.d.length+n.tile.d.length+n.columns.byteLength+n.rows.byteLength;});return Object.assign({nodes:this.nodes.size,bytes},this.metrics);}
 reset(){this.nodes.clear();this.surface=null;}
}
module.exports={RetainedScene};
