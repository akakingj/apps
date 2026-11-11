'use strict';
const {Canvas}=require('./kit/canvas');
const face=require('./hud-draw'),nav=require('./nav-draw'),text=require('./nav-text');
const lanes=require('./lane-draw'),RL=require('./redline-hud');
const D=require('./display-config');
const {placement}=require('./layout');
const W=800,H=480;
const {blitScaled,drawWithParts}=require('./component-canvas');
function draw(state) {
    const cache=state.renderCache,cv=cache?(cache.begin(W,H),cache.surface):new Canvas(W,H);if(!cache)cv.clear([0,0,0,0]);
    if(state.renderRpm!==false){
        const at=placement(state.config,'hud',face);
        if(RL.active(state.config)){
            // A Redline app layout replaces the RPM face; painted at HUD size (no resampling).
            if(!state.config.hudRpmGaugeHidden){const r=RL.rect(state.config,at),painter={W:r.w,H:r.h,draw:v=>RL.drawSized(v,r.w,r.h)};if(cache)cache.navigation('redline',RL.key(state),painter,state,r);else blitScaled(cv,painter.draw(state),r);}
        }else drawWithParts(face,state,cv,at,'hud');
    }
    if(D.navAllowed(state.config,state.mode)&&state.navigation&&state.navigation.visible){
        const hasTurn=state.navigation.maneuverVisible!==false;
        // Painters with drawSized() paint at the final HUD size (1:1 copy, no resampling).
        const paintNav=(id,base,value)=>{const r=D.navRect(state.config,id),painter=base.drawSized?{W:r.w,H:r.h,draw:v=>base.drawSized(v,r.w,r.h)}:base;if(cache){const key=require('./render-state').navKey(state,id);if(key)cache.navigation(id,key,painter,value,r);}else blitScaled(cv,painter.draw(value),r);};
        if(hasTurn&&!state.config.hudNavHidden)paintNav('Direction',nav,Object.assign({},state.navigation,{color:state.config.navColor}));
        if(!state.config.hudLanesHidden&&state.navigation.lanes&&state.navigation.lanes.visible){
            paintNav('Lanes',lanes,Object.assign({},state.navigation.lanes,{color:state.config.navColor}));
        }
        if(hasTurn&&!state.config.hudTextHidden)paintNav('Text',text,state.navigation);
    }
    return cache?cache.finish():cv;
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
module.exports={draw,difference,W,H,fullTarget:true,key:state=>require('./render-state').key(state,'hud'),createCache:()=>new (require('./retained-scene').RetainedScene)()};
