'use strict';
// Sharper small text for this app's canvases.
// The kit bakes Korean glyphs at one size (36 px, regular weight) and scales them
// bilinearly; below half size that skips source pixels and breaks thin strokes.
// Area-average the glyph instead when it is reduced, and thicken Korean text that
// asks for the bold face (the Korean atlas has no bold weight). Idempotent.
let Canvas=null;
try{({Canvas}=require('./kit/canvas'));}catch(e){/* host tests load sources without the kit */}
const KOREAN=/[ᄀ-ᇿ㄰-㆏가-힣]/;
if(Canvas&&Canvas.prototype&&Canvas.prototype._blit&&!Canvas.prototype._redlineCrispText){
 const blit=Canvas.prototype._blit,text=Canvas.prototype.text;
 Canvas.prototype._blit=function(f,gx,gy,gw,gh,dx,dy,scale,c){
  if(!(scale<0.95))return blit.call(this,f,gx,gy,gw,gh,dx,dy,scale,c);
  const A=f.alpha,AW=f.atlasW,inv=1/scale,norm=scale*scale;
  const py0=Math.max(0,Math.floor(dy)),py1=Math.min(this.h,Math.ceil(dy+gh*scale)),px0=Math.max(0,Math.floor(dx)),px1=Math.min(this.w,Math.ceil(dx+gw*scale));
  for(let py=py0;py<py1;py++){
   const y0=(py-dy)*inv,y1=y0+inv,sy0=Math.max(0,Math.floor(y0)),sy1=Math.min(gh,Math.ceil(y1));
   for(let px=px0;px<px1;px++){
    const x0=(px-dx)*inv,x1=x0+inv,sx0=Math.max(0,Math.floor(x0)),sx1=Math.min(gw,Math.ceil(x1));let sum=0;
    for(let sy=sy0;sy<sy1;sy++){const wy=Math.min(y1,sy+1)-Math.max(y0,sy),row=(gy+sy)*AW+gx;
     for(let sx=sx0;sx<sx1;sx++)sum+=A[row+sx]*wy*(Math.min(x1,sx+1)-Math.max(x0,sx));}
    const v=sum*norm;if(v>0)this._blend(px,py,c,v>=255?1:v/255);
   }
  }
 };
 Canvas.prototype.text=function(str,x,y,size,c,opts){
  const w=text.call(this,str,x,y,size,c,opts);
  if(opts&&opts.font==='bold'&&KOREAN.test(String(str)))text.call(this,str,x+Math.max(0.5,size*0.045),y,size,c,opts);
  return w;
 };
 Canvas.prototype._redlineCrispText=true;
}
module.exports={KOREAN};
