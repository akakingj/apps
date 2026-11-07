'use strict';
const {Canvas}=require('./kit/canvas');
const face=require('./hud-draw'),nav=require('./nav-draw');
const {placement}=require('./layout');
const W=800,H=480;
function blitScaled(dst,src,r) {
    for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++) {
        const s=(Math.min(src.h-1,Math.floor((y+0.5)*src.h/r.h))*src.w+Math.min(src.w-1,Math.floor((x+0.5)*src.w/r.w)))*4;
        const p=((y+r.y)*dst.w+x+r.x)*4,sa=src.d[s+3]/255;
        if(!sa)continue;
        const da=dst.d[p+3]/255,a=sa+da*(1-sa);
        for(let k=0;k<3;k++)dst.d[p+k]=Math.round((src.d[s+k]*sa+dst.d[p+k]*da*(1-sa))/a);
        dst.d[p+3]=Math.round(a*255);
    }
}
function draw(state) {
    const cv=new Canvas(W,H);cv.clear([0,0,0,0]);
    blitScaled(cv,face.draw(state),placement(state.config,'hud',face));
    if(state.config.hudNavigationEnabled&&state.navigation&&state.navigation.visible)blitScaled(cv,nav.draw(state.navigation),placement(state.config,'hudNav',nav));
    return cv;
}
function difference(previous,next) {
    const rects=[],parts=[],stride=W*4;
    for(let top=0;top<H;top+=60) {
        const bottom=Math.min(H,top+60);let left=W,right=-1,first=H,last=-1;
        for(let y=top;y<bottom;y++) {
            const row=y*stride;
            if(previous.slice(row,row+stride).equals(next.slice(row,row+stride)))continue;
            let a=0,b=W-1;
            while(a<W&&previous.readUInt32LE(row+a*4)===next.readUInt32LE(row+a*4))a++;
            while(b>a&&previous.readUInt32LE(row+b*4)===next.readUInt32LE(row+b*4))b--;
            left=Math.min(left,a);right=Math.max(right,b);first=Math.min(first,y);last=y;
        }
        if(last<first)continue;
        const r={x:left,y:first,w:right-left+1,h:last-first+1};rects.push(r);
        for(let y=first;y<=last;y++)parts.push(next.slice(y*stride+left*4,y*stride+(right+1)*4));
    }
    return {rects,pixels:Buffer.concat(parts)};
}
module.exports={draw,difference,W,H,fullTarget:true};
