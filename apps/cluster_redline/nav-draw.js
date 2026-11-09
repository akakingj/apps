'use strict';
const {Canvas}=require('./kit/canvas');
const W=240,H=112,WHITE='#f4f7fb',ARROW='#37c6ff';
function highwayInfo(state) {
    if(!state||state.kind!=='branch'||typeof state.branchType!=='string')return null;
    const match=/^HIGHWAY_(IN|OUT)_(LEFT|RIGHT|STRAIGHT)$/.exec(state.branchType);
    if(!match)return null;
    return {action:match[1]==='IN'?'entry':'exit',side:match[2],label:match[1]==='IN'?'Highway entry':'Highway exit'};
}
function highwayDiagram(cv,info,color) {
    const mirror=points=>info.side==='LEFT'?points.map(p=>[104-p[0],p[1]]):points;
    const road=(x)=>{
        [x-14,x+14].forEach(edge=>cv.line(edge,8,edge,102,2,'#80909d'));
        for(let y=12;y<100;y+=20)cv.line(x,y,x,y+8,1,'#80909d');
    };
    // A conceptual entry/exit direction, not a map or a claim about lane count.
    const main=info.side==='STRAIGHT'?52:info.action==='entry'?76:28;
    road(info.side==='LEFT'?104-main:main);
    let path,head;
    if(info.side==='STRAIGHT') {
        path=[[52,100],[52,18]];head=[[36,34],[52,18],[68,34]];
    }else if(info.action==='entry') {
        path=[[22,100],[22,80],[76,42],[76,16]];head=[[60,32],[76,16],[92,32]];
    }else {
        path=[[28,100],[28,64],[82,18]];head=[[56,18],[82,18],[82,44]];
    }
    cv.polyline(mirror(path),8,color);cv.polyline(mirror(head),8,color);
}
function highwayPanel(cv,state,info) {
    highwayDiagram(cv,info,state.color==='gray'?'#929aa3':state.color==='white'?WHITE:ARROW);
    let size=22;
    while(size>14&&cv.textWidth(info.label,size,{font:'bold'})>130)size--;
    cv.text(info.label,108,32,size,WHITE,{font:'bold'});
    const text=state.distanceText||'';size=40;
    while(size>20&&cv.textWidth(text,size,{font:'num',literal:true})>130)size--;
    cv.text(text,108,84,size,WHITE,{font:'num',literal:true});
}
function draw(state,target) {
    const cv=target||new Canvas(W,H);if(!target)cv.clear([0,0,0,0]);
    if(!state||!state.visible)return cv;
    const highway=highwayInfo(state);
    if(highway){highwayPanel(cv,state,highway);return cv;}
    const dir=state.maneuver;
    const color=state.color==='gray'?'#929aa3':state.color==='white'?WHITE:ARROW;
    const line=(points)=>cv.polyline(points,10,color);
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
        let pts=[[79,90],[79,42]],head=[[9,55],[25,73],[41,55]];
        for(let i=1;i<=24;i++){const a=-Math.PI*i/24;pts.push([52+27*Math.cos(a),42+27*Math.sin(a)]);}
        pts.push([25,73]);
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
module.exports={draw,W,H,highwayInfo};
