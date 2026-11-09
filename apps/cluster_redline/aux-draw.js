'use strict';
const {gauges}=require('./units');
const {auxConfig,metricSlots,LABELS}=require('./display-config');
const WHITE='#f4f7fb',BLUE='#1caeff',DIM='#b8c2d1';
function metric(state,id){
 const g=gauges(state),v=state.aux||{};
 if(id==='torque'||id==='power')return Object.assign({id,label:LABELS[id],minimum:0},g[id]);
 const spec={boost:[v.boost,'bar',2,0,2.5],gforce:[v.gforce,'g',2,0,2],outside:[v.outside,'°C',1,-40,60],oil:[v.oil,'°C',0,0,180]}[id];
 return {id,label:id==='outside'?'Outside temp':id==='oil'?'Oil temp':LABELS[id],value:spec&&spec[0],unit:spec&&spec[1],decimals:spec&&spec[2],minimum:spec&&spec[3],maximum:spec&&spec[4]};
}
function valid(v){return typeof v==='number'&&isFinite(v);}
function drawAux(cv,state,display,geometry){
 const selected=auxConfig(state.config[display+'AuxConfig']);if(selected.mode==='off')return;
 const h=display==='hud',columns=geometry||{left:h?64:200,right:h?452:658,width:h?160:230,top:h?100:310,bottom:h?188:422};
 const slots=metricSlots(selected.items),numberSize=h?26.4:32,labelSize=h?15.4:20,unitSize=h?12.1:14;
 slots.forEach(s=>{
  const item=metric(state,s.id),x=s.side?columns.right:columns.left,w=columns.width;
  const text=valid(item.value)?item.value.toFixed(item.decimals):'--';
  if(selected.mode==='values'){
   const y=s.rows===2?(h?(state.config.hudAlertStyle==='circle'?(s.row?184:126):(s.row?204:159)):(s.row?385:315)):h?(state.config.hudAlertStyle==='circle'?146:180):370;
   cv.text(item.label,x,y-(s.rows===2?25:h?46:55),labelSize,DIM,{font:'bold'});
   const uw=cv.textWidth(item.unit,unitSize,{literal:true});let size=h?(s.rows===2?30:59.4):(s.rows===2?40:64);
   while(size>16&&cv.textWidth(text,size,{font:'num',literal:true})+uw+5>w)size--;
   cv.text(text,x+w-uw-5,y,size,WHITE,{font:'num',literal:true,align:'right'});cv.text(item.unit,x+w,y,unitSize,DIM,{align:'right',literal:true});return;
  }
  const labelY=columns.top+15,y=columns.top+29,bh=h?28.8:26,gw=w*0.9,gx=x+(w-gw)/2;
  cv.text(item.label,x,labelY,labelSize,DIM,{font:'bold'});
  const uw=cv.textWidth(item.unit,unitSize,{literal:true});
  cv.text(text,x+w-uw-5,labelY,numberSize,WHITE,{font:'num',literal:true,align:'right'});cv.text(item.unit,x+w,labelY,unitSize,DIM,{align:'right',literal:true});
  const fraction=valid(item.value)?Math.max(0,Math.min(1,(item.value-item.minimum)/(item.maximum-item.minimum))):0;
  if(s.id==='outside'||s.id==='oil'){
   const r=bh/3,cy=y+bh/2,tx=gx+r*1.9,tw=gw-r*2.4;
   cv.arc(gx+r,cy,0,r,0,360,'#35404f');cv.roundRect(tx,y+bh/3,tw,bh/3,bh/6,'#28313e');
   if(valid(item.value)){cv.arc(gx+r,cy,0,r*0.65,0,360,BLUE);cv.fillRect(tx,cy-bh/12,tw*fraction,bh/6,BLUE);}
  }else if(s.id==='gforce'){
   const r=bh/2,cy=y+r,cx=gx+r;
   cv.arc(cx,cy,r-1,r,0,360,'#6e7e90');cv.line(cx-r,cy,cx+r,cy,1,DIM);cv.line(cx,cy-r,cx,cy+r,1,DIM);
   if(valid(item.value)&&valid(state.aux.gLong)&&valid(state.aux.gLat))cv.arc(cx+Math.max(-1,Math.min(1,state.aux.gLat))*r*0.75,cy-Math.max(-1,Math.min(1,state.aux.gLong))*r*0.75,0,3,0,360,BLUE);
   cv.line(gx+bh+8,cy,gx+gw,cy,3,'#28313e');if(fraction)cv.line(gx+bh+8,cy,gx+bh+8+(gw-bh-8)*fraction,cy,3,BLUE);
  }else{
   const slant=7,span=gw-slant;
   const band=(n,c)=>{if(n>0)cv.quad([[gx+slant,y],[gx+slant+n,y],[gx+n,y+bh],[gx,y+bh]],c);};
   band(span,'#1b212b');band(span*fraction,BLUE);
   if(valid(item.value))cv.line(gx+slant+span*fraction,y-1,gx+span*fraction,y+bh+1,1.5,WHITE);
   if(valid(item.peak))cv.line(gx+slant,y-2,gx+slant+span*Math.max(0,Math.min(1,item.peak/item.maximum)),y-2,2,'#ff2a2a');
  }
  [0,0.5,1].forEach(f=>{const px=gx+(gw-7)*f;cv.line(px,y+bh+3,px,y+bh+6,1,DIM);cv.text((item.minimum+(item.maximum-item.minimum)*f).toFixed(item.decimals),px,columns.bottom,h?13.2:14,DIM,{align:'center',font:'num',literal:true});});
 });
}
module.exports={drawAux,metric};
