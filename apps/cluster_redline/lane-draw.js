'use strict';
const {Canvas}=require('./kit/canvas');
const W=240,H=72;
function arrow(cv,d,cx,color){
 const left=/LEFT/.test(d),right=/RIGHT/.test(d),sign=left?-1:1;
 const line=p=>cv.polyline(p,3,color);
 if(d==='STRAIGHT_ON'){line([[cx,49],[cx,18]]);line([[cx-6,25],[cx,18],[cx+6,25]]);}
 else if(/UTURN/.test(d)){const u=left?1:-1,pts=[[cx+u*7,49],[cx+u*7,29]];for(let i=1;i<=12;i++){const a=-Math.PI*i/12;pts.push([cx+u*7*Math.cos(a),29+7*Math.sin(a)]);}pts.push([cx-u*7,39]);line(pts);line([[cx-u*7-5,34],[cx-u*7,40],[cx-u*7+5,34]]);}
 else if(left||right){
  const slight=/SLIGHT/.test(d),endY=slight?17:29;
  line([[cx,49],[cx,35],[cx+sign*10,endY]]);
  line(slight?[[cx+sign*3,endY],[cx+sign*10,endY],[cx+sign*10,endY+8]]:[[cx+sign*4,endY-6],[cx+sign*10,endY],[cx+sign*4,endY+6]]);
 }
}
function draw(state){
 const cv=new Canvas(W,H);cv.clear([0,0,0,0]);
 if(!state||!state.visible||!Array.isArray(state.lanes)||!state.lanes.length)return cv;
 const cell=W/state.lanes.length,selected=state.color==='gray'?'#929aa3':state.color==='white'?'#f2f4f8':'#29c5ff';
 state.lanes.forEach((lane,i)=>{
  const x=Math.round(cell*(i+0.5));
  if(lane.highlighted)cv.polyline([[cell*i+2,57],[cell*(i+1)-2,57]],4,selected);
  if(i)cv.polyline([[cell*i,16],[cell*i,54]],1,'#4c5664');
  lane.other.forEach(d=>arrow(cv,d,x,'#55606e'));
  lane.directions.forEach(d=>arrow(cv,d,x,lane.highlighted?selected:'#75808e'));
  if(lane.blocked){cv.polyline([[x-6,27],[x+6,43]],3,'#75808e');cv.polyline([[x+6,27],[x-6,43]],3,'#75808e');}
 });return cv;
}
module.exports={W,H,draw};
