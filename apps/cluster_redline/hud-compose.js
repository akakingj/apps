'use strict';
const {Canvas}=require('./kit/canvas');
const face=require('./hud-draw'),nav=require('./nav-draw'),text=require('./nav-text');
const {placement}=require('./layout');
const W=800,H=480;
const {blitScaled,drawWithParts}=require('./component-canvas');
function draw(state) {
    const cv=new Canvas(W,H);cv.clear([0,0,0,0]);
    if(state.renderRpm!==false)drawWithParts(face,state,cv,placement(state.config,'hud',face),'hud');
    if(state.config.hudNavigationEnabled&&state.navigation&&state.navigation.visible){
        blitScaled(cv,nav.draw(Object.assign({},state.navigation,{color:state.config.navColor})),placement(state.config,'hudNav',nav));
        const scale=state.config.hudTextScale/100,w=Math.round(text.W*scale),h=Math.round(text.H*scale);
        blitScaled(cv,text.draw(state.navigation),{x:Math.round((W-w)/2+state.config.hudTextOffsetX),y:Math.round(240+state.config.hudTextOffsetY),w,h});
    }
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
