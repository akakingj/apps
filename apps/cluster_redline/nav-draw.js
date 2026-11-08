'use strict';
const {Canvas}=require('./kit/canvas');
const W=240,H=112,WHITE='#f4f7fb';
function draw(state) {
    const cv=new Canvas(W,H);cv.clear([0,0,0,0]);
    if(!state||!state.visible)return cv;
    const dir=state.maneuver;
    const line=(points)=>cv.polyline(points,10,WHITE);
    const mirror=(points)=>points.map((p)=>[104-p[0],p[1]]);
    if(/^ARRIVAL_/.test(dir)) {
        // Arrival flag, never a turn arrow. Preserve the supplied roadside position.
        const x=dir==='ARRIVAL_LEFT'?25:dir==='ARRIVAL_RIGHT'?68:47;
        line([[x,92],[x,20]]);
        cv.polyline([[x,22],[x+28,28],[x+28,49],[x,43]],4,WHITE);
    } else if(/^LANE_/.test(dir)) {
        // Offset lane-change arrow differs from a90-degree intersection turn.
        let pts=[[76,90],[76,70],[28,45],[28,20]],head=[[10,38],[28,20],[46,38]];
        if(dir==='LANE_RIGHT'){pts=mirror(pts);head=mirror(head);}line(pts);line(head);
    } else if(dir==='ROUNDABOUT') {
        const pts=[];for(let i=0;i<=24;i++){const a=(i/24*1.7+0.15)*Math.PI;pts.push([52+27*Math.cos(a),48+27*Math.sin(a)]);}line(pts);
        cv.text(String(state.exitNumber),52,60,28,WHITE,{align:'center',font:'num'});
    } else if(dir==='STRAIGHT_ON') {line([[52,90],[52,20]]);line([[30,42],[52,20],[74,42]]);}
    else if(/UTURN/.test(dir)) {
        let pts=[[80,90],[80,40],[70,24],[43,24],[27,40],[27,69]],head=[[10,53],[27,70],[44,53]];
        if(dir==='UTURN_RIGHT'){pts=mirror(pts);head=mirror(head);}line(pts);line(head);
    } else if(/LEFT|RIGHT/.test(dir)) {
        const slight=/SLIGHT|KEEP/.test(dir);let pts=slight?[[76,90],[76,65],[28,20]]:[[78,90],[78,43],[23,43]];
        let head=slight?[[28,48],[28,20],[56,20]]:[[44,22],[23,43],[44,64]];
        if(/RIGHT/.test(dir)){pts=mirror(pts);head=mirror(head);}line(pts);line(head);
    } else return cv;
    const text=state.distanceText||'';let size=40;
    while(size>20&&cv.textWidth(text,size,{font:'num',literal:true})>130)size--;
    cv.text(text,108,67,size,WHITE,{font:'num',literal:true});
    return cv;
}
module.exports={draw,W,H};
