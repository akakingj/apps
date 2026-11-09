'use strict';
const {Canvas}=require('./kit/canvas');
const W=240,H=48;
function draw(state){
 const cv=new Canvas(W,H);cv.clear([0,0,0,0]);
 if(!state||!state.visible||typeof state.description!=='string'||!state.description)return cv;
 let text=state.description,size=34;
 while(size>16&&cv.textWidth(text,size,{font:'bold',literal:true})>W-16)size--;
 while(text.length&&cv.textWidth(text,size,{font:'bold',literal:true})>W-16)text=Array.from(text).slice(0,-2).join('')+'…';
 cv.text(text,W/2,37,size,'#f4f7fb',{font:'bold',align:'center',literal:true});return cv;
}
module.exports={draw,W,H};
