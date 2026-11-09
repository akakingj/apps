'use strict';
const {gauges}=require('./units');
const {auxConfig,metricSlots,LABELS}=require('./display-config');
const {part}=require('./component-canvas');
const WHITE='#f4f7fb',BLUE='#1caeff',DIM='#b8c2d1';
function metric(state,id){
 const g=gauges(state),v=state.aux||{};
 if(id==='torque'||id==='power')return Object.assign({id,label:LABELS[id],minimum:0},g[id]);
 const spec={boost:[v.boost,'bar',2,0,2.5],gforce:[v.gforce,'g',2,0,2],outside:[v.outside,'°C',1,-40,60],oil:[v.oil,'°C',0,0,180],batteryCharge:[v.batteryCharge,'%',0,0,100],batteryVoltage:[v.batteryVoltage,'V',2,0,18],economy:[v.economy,'km/L',1,0,50]}[id];
 return {id,label:id==='outside'?'Outside temp':id==='oil'?'Oil temp':LABELS[id],value:spec&&spec[0],unit:spec&&spec[1],decimals:spec&&spec[2],minimum:spec&&spec[3],maximum:spec&&spec[4]};
}
function valid(v){return typeof v==='number'&&isFinite(v);}
function valueY(h,cfg,s,shift){return (s.rows===2?(h?(cfg.hudAlertStyle==='circle'?(s.row?184:126):(s.row?204:159)):(s.row?385:315)):h?(cfg.hudAlertStyle==='circle'?146:180):370)+shift;}
function drawAux(cv,state,display,geometry){
 const cfg=state.config,selected=auxConfig(cfg[display+'AuxConfig']),h=display==='hud';
 const columns=geometry||{left:h?64:200,right:h?452:658,width:h?160:230,top:h?100:310,bottom:h?188:422};
 const slots=metricSlots(selected.items),numberSize=h?26.4:32,labelSize=h?15.4:20,unitSize=h?12.1:14,shift=columns.textShift||0;
 [0,1].forEach(side=>{
  const x=side?columns.right:columns.left,w=columns.width,group=slots.filter(s=>s.side===side);
  const top=Math.min(columns.top-20,...group.map(s=>valueY(h,cfg,s,shift)-(s.rows===2?25:h?46:55)-labelSize-8));
  const bottom=Math.max(columns.bottom+12,...group.map(s=>valueY(h,cfg,s,shift)+12));
  part(cv,cfg,display,side?'AuxRight':'AuxLeft',{x:x-10,y:top,w:w+20,h:bottom-top},c=>{
   if(selected.mode==='off')return;
   group.forEach(s=>{
    const item=metric(state,s.id),text=valid(item.value)?item.value.toFixed(item.decimals):'--';
    if(selected.mode==='values'){
     const y=valueY(h,cfg,s,shift);c.text(item.label,x,y-(s.rows===2?25:h?46:55),labelSize,DIM,{font:'bold'});
     const uw=c.textWidth(item.unit,unitSize,{literal:true});let size=h?(s.rows===2?30:59.4):(s.rows===2?40:64);
     while(size>16&&c.textWidth(text,size,{font:'num',literal:true})+uw+5>w)size--;
     c.text(text,x+w-uw-5,y,size,WHITE,{font:'num',literal:true,align:'right'});c.text(item.unit,x+w,y,unitSize,DIM,{align:'right',literal:true});return;
    }
    const labelY=columns.top+15,y=columns.top+29,bh=h?28.8:26,gw=w*0.9,gx=x+(w-gw)/2;
    c.text(item.label,x,labelY,labelSize,DIM,{font:'bold'});
    const uw=c.textWidth(item.unit,unitSize,{literal:true});
    if(s.id==='batteryVoltage'||s.id==='economy'){
     let size=h?36:42;while(size>16&&c.textWidth(text,size,{font:'num',literal:true})+uw+6>w)size--;
     c.text(text,x+w-uw-6,y+bh,size,WHITE,{font:'num',literal:true,align:'right'});c.text(item.unit,x+w,y+bh,unitSize,DIM,{align:'right',literal:true});return;
    }
    c.text(text,x+w-uw-5,labelY,numberSize,WHITE,{font:'num',literal:true,align:'right'});c.text(item.unit,x+w,labelY,unitSize,DIM,{align:'right',literal:true});
    const fraction=valid(item.value)?Math.max(0,Math.min(1,(item.value-item.minimum)/(item.maximum-item.minimum))):0;
    if(s.id==='outside'||s.id==='oil'){
     const r=bh/3,cy=y+bh/2,tx=gx+r*1.9,tw=gw-r*2.4;
     c.arc(gx+r,cy,0,r,0,360,'#35404f');c.roundRect(tx,y+bh/3,tw,bh/3,bh/6,'#28313e');
     if(valid(item.value)){c.arc(gx+r,cy,0,r*0.65,0,360,BLUE);c.fillRect(tx,cy-bh/12,tw*fraction,bh/6,BLUE);}
    }else if(s.id==='gforce'){
     c.fillRect(gx,y,gw,bh,'#1b212b');c.polyline([[gx,y],[gx+gw,y],[gx+gw,y+bh],[gx,y+bh],[gx,y]],1,DIM);
     c.line(gx+gw/2,y+3,gx+gw/2,y+bh-3,1,'#506176');
     if(valid(item.value)&&state.aux&&valid(state.aux.gLat)){const r=bh*0.28,cx=gx+gw/2+Math.max(-1,Math.min(1,state.aux.gLat/2))*(gw/2-r-3);c.arc(cx,y+bh/2,0,r,0,360,BLUE);}
    }else if(s.id==='batteryCharge'){
     const body=gw-7;c.roundRect(gx,y,body,bh,3,DIM);c.fillRect(gx+2,y+2,body-4,bh-4,'#1b212b');c.fillRect(gx+body,y+bh*0.3,6,bh*0.4,DIM);
     if(valid(item.value))c.fillRect(gx+4,y+4,(body-8)*fraction,bh-8,BLUE);
    }else{
     const slant=7,span=gw-slant,band=(n,color)=>{if(n>0)c.quad([[gx+slant,y],[gx+slant+n,y],[gx+n,y+bh],[gx,y+bh]],color);};
     band(span,'#1b212b');band(span*fraction,BLUE);
     if(valid(item.value))c.line(gx+slant+span*fraction,y-1,gx+span*fraction,y+bh+1,1.5,WHITE);
     if(valid(item.peak))c.line(gx+slant,y-2,gx+slant+span*Math.max(0,Math.min(1,item.peak/item.maximum)),y-2,2,'#ff2a2a');
    }
    [0,0.5,1].forEach(f=>{const px=gx+(gw-7)*f;c.line(px,y+bh+3,px,y+bh+6,1,DIM);c.text((s.id==='gforce'?(f-0.5)*4:item.minimum+(item.maximum-item.minimum)*f).toFixed(s.id==='gforce'?1:item.decimals),px,columns.bottom,h?13.2:14,DIM,{align:'center',font:'num',literal:true});});
   });
  });
 });
}
module.exports={drawAux,metric,valueY};
