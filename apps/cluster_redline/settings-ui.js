'use strict';
const {t}=require('./kit/i18n'),G=require('./kit/gauges'),{header}=require('./settings-chrome');
const {settings:effective,PROFILES}=require('./policy');
const D=require('./display-config'),HUD=require('./hud-draw'),CLUSTER=require('./draw'),NAV=require('./nav-draw');
const {measurePart}=require('./component-canvas'),{placement}=require('./layout'),NAV_TEXT=require('./nav-text');
const W=1600,H=520,TABS=['Basic settings','HUD display setting','CLUSTER display setting','NAV display setting'];
const GROUPS=[['autoStart','appEnabled','engineProfile','powerUnit','torqueUnit','shiftRpm'],['sportHudOutput','allHudOutput','aux','design','layout'],['sportClusterOutput','allClusterOutput','aux','design','layout'],['navDisplayMode','navColor','layout']];
const RENDERER_NOTICE='Install Cluster renderer (cluster-render) from MGU Store first.';
const MAP_WARNING='Set Central display area to Map view or Off. Assist or route preview may cover the widget.';
const HUD_WARNING='HUD navigation shows received turn guidance; unavailable data preserves stock guidance.';
function options(item,cfg){
 if(!item)return [];
 if(item.type==='bool')return [[false,'Off'],[true,'On']];
 if(item.type==='choice')return item.options||[];
 const range=PROFILES[cfg.engineProfile]&&PROFILES[cfg.engineProfile].ranges[item.key];
 return (item.steps||[]).filter(v=>!range||!v||v>=range[0]&&v<=range[1]).map(v=>[v,v===0?'Preset default':String(v)+' '+(item.unit||'')]);
}
function vector(cv,x,y,s){
 return {text:(v,a,b,z,c,o)=>cv.text(v,x+a*s,y+b*s,z*s,c,o),textWidth:(v,z,o)=>cv.textWidth(v,z*s,o)/s,
  line:(a,b,c,d,w,k)=>cv.line(x+a*s,y+b*s,x+c*s,y+d*s,w*s,k),polyline:(p,w,c)=>cv.polyline(p.map(v=>[x+v[0]*s,y+v[1]*s]),w*s,c),
  quad:(p,c)=>cv.quad(p.map(v=>[x+v[0]*s,y+v[1]*s]),c),arc:(a,b,r0,r1,f,l,c)=>cv.arc(x+a*s,y+b*s,r0*s,r1*s,f,l,c),
  fillRect:(a,b,w,h,c)=>cv.fillRect(x+a*s,y+b*s,w*s,h*s,c),roundRect:(a,b,w,h,r,c)=>cv.roundRect(x+a*s,y+b*s,w*s,h*s,r*s,c),
  blit:(im,a,b)=>{for(let row=0;row<im.h;row++)for(let col=0;col<im.w;col++){const p=(row*im.w+col)*4;if(im.d[p+3])cv.fillRect(x+(a+col)*s,y+(b+row)*s,s,s,Array.from(im.d.slice(p,p+4)));}}};
}
class SettingsPage{
 constructor(settings,changed,version){this.settings=settings;this.changed=changed||(()=>{});this.version=version;this.tab=0;this.focus=0;this.open=null;this.choice=0;this.layoutPart=0;this.layoutParam=0;this.draft=null;this.layoutActions=[];}
 config(){const raw={};this.settings.schema.forEach(s=>{raw[s.key]=this.settings.get(s.key);});return effective(raw);}
 display(){return this.tab===2?'cluster':'hud';}
 keys(){return GROUPS[this.tab];}
 item(){const key=this.keys()[this.focus];if(['aux','design','layout'].includes(key))return {key,label:{aux:'Auxiliary information',design:'Design',layout:'Position / size'}[key],type:'action'};return this.settings.schema.find(s=>s.key===key);}
 selectTab(i){this.tab=Math.max(0,Math.min(3,i|0));this.focus=0;this.open=null;this.draft=null;this.choice=0;this.changed();}
 back(){if(this.open==='auxSelect'){this.open='auxMode';this.draft=null;this.choice=0;}else{this.open=null;this.draft=null;}this.changed();}
 move(delta){
  if(!this.open)this.focus=(this.focus+delta+this.keys().length)%this.keys().length;
  else{const n=this.open==='layout'?this.layoutActions.length:this.open==='auxMode'||this.open==='design'?2:this.open==='auxSelect'?D.METRICS.length+1:options(this.item(),this.config()).length;this.choice=(this.choice+delta+Math.max(1,n))%Math.max(1,n);}
  this.changed();
 }
 value(item,cfg){
  if(item.key==='aux'){const a=D.auxConfig(cfg[this.display()+'AuxConfig']);return t(a.mode==='values'?'Text':'Gauges')+' · '+a.items.map(k=>t(D.LABELS[k])).join(' / ');}
  if(item.key==='design')return t(cfg[this.display()+'AlertStyle']==='circle'?'Circle beside gear':'Top alert bar');
  if(item.key==='layout')return t('Adjust');
  if(item.key==='appEnabled')return t(cfg.appEnabled?'Running':'Stopped');
  if(item.key==='shiftRpm'&&!this.settings.get(item.key))return cfg.shiftRpm+' rpm';
  const selected=options(item,cfg).find(o=>o[0]===this.settings.get(item.key));return selected?t(selected[1]):t('Check required');
 }
 change(delta){if(this.open==='layout'){this.adjust(this.layoutParam,delta);return;}const item=this.item(),list=options(item,this.config());if(!list.length){this.activate();return;}const at=list.findIndex(o=>o[0]===this.settings.get(item.key));this.settings.set(item.key,list[(at+delta+list.length)%list.length][0]);this.changed();}
 activate(index){
  if(index!==undefined)this.focus=index;const item=this.item();if(!item)return;
  this.choice=0;
  if(item.key==='aux')this.open='auxMode';
  else if(item.key==='design'){this.open='design';this.choice=this.config()[this.display()+'AlertStyle']==='circle'?1:0;}
  else if(item.key==='layout'){this.open='layout';this.layoutPart=0;this.layoutParam=0;}
  else if(item.type==='bool'){this.change(1);return;}
  else{this.open=item.key;this.choice=Math.max(0,options(item,this.config()).findIndex(o=>o[0]===this.settings.get(item.key)));}
  this.changed();
 }
 choose(index){
  if(this.open==='layout'){const a=this.layoutActions[index];if(a)a.act();return;}
  if(this.open==='auxMode'){this.draft={mode:index===1?'values':'gauges',items:[]};this.open='auxSelect';this.choice=0;this.changed();return;}
  if(this.open==='auxSelect'){if(index===D.METRICS.length)this.commitAux();else this.toggleMetric(D.METRICS[index]);return;}
  if(this.open==='design'){this.settings.set(this.display()+'AlertStyle',index===1?'circle':'bar');this.open=null;this.changed();return;}
  const list=options(this.item(),this.config());if(!list[index])return;
  this.settings.set(this.item().key,list[index][0]);if(this.item().key==='navDisplayMode')this.settings.set('hudNavigationEnabled',true);this.open=null;this.changed();
 }
 toggleMetric(id){if(!this.draft||!D.METRICS.includes(id))return;const a=this.draft.items,i=a.indexOf(id);if(i>=0)a.splice(i,1);else if(a.length<(this.draft.mode==='gauges'?2:4))a.push(id);this.changed();}
 commitAux(){if(!this.draft||!this.draft.items.length)return;this.settings.set(this.display()+'AuxConfig',JSON.stringify(this.draft));this.open=null;this.draft=null;this.changed();}
 button(cv,targets,label,x,y,w,h,act,on,id){
  const layoutFocus=this.open==='layout'&&targets.length===this.choice,focused=layoutFocus&&!/^part/.test(id||'')||this.open==='auxSelect'&&(id==='metric-'+D.METRICS[this.choice]||id==='ok'&&this.choice===D.METRICS.length);
  cv.roundRect(x,y,w,h,6,on||focused?'#57202d':'#252a31');if(layoutFocus&&/^part/.test(id||'')&&!on)cv.polyline([[x+2,y+2],[x+w-2,y+2],[x+w-2,y+h-2],[x+2,y+h-2],[x+2,y+2]],2,'#9bacc4');let size=30;while(size>18&&cv.textWidth(t(label),size)>w-24)size--;
  if(label==='−'||label==='+'){cv.line(x+w/2-17,y+h/2,x+w/2+17,y+h/2,3,'#f3f5f7');if(label==='+')cv.line(x+w/2,y+h/2-17,x+w/2,y+h/2+17,3,'#f3f5f7');}
  else cv.text(label,x+w/2,y+h/2+size*0.36,size,'#f3f5f7',{align:'center',font:'bold'});targets.push({x,y,w,h,act,label,id:id||label});
 }
 draw(cv,status,liveState){
  this.liveState=liveState||null;
  const cfg=this.config(),targets=[],theme={bg:'#090b0e',text:'#f3f5f7',dim:'#8d97a4',sel:'#f32b40',accent:'#f32b40'};cv.clear(theme.bg);
  const badges=this.version?[{text:'v'+this.version,color:'#8d97a4'}]:[];
  if(cv.chrome)G.frame(cv,theme,TABS,this.tab,badges);else{header(cv,theme,0,0,W,80,'Cluster Redline',TABS,this.tab,badges,true,false);(cv.tabRects||[]).forEach(r=>targets.push(Object.assign({},r,{act:()=>this.selectTab(r.i),label:TABS[r.i],id:'tab'+r.i})));}
  if(this.open==='layout')this.drawLayout(cv,cfg,targets);
  else if(this.open==='auxMode')this.drawAuxMode(cv,cfg,targets);
  else if(this.open==='auxSelect')this.drawAuxSelect(cv,cfg,targets);
  else if(this.open==='design')this.drawDesign(cv,cfg,targets);
  else if(this.open==='navColor')this.drawColors(cv,cfg,targets);
  else if(this.open)this.drawChoices(cv,cfg,targets);
  else this.drawRows(cv,cfg,targets,status);
  cv.targets=targets.map((r,i)=>Object.assign({key:this.tab+':'+(this.open||'rows')+':'+i,run:r.act},r));return cv;
 }
 drawRows(cv,cfg,targets,status){
  let y=100;
  this.keys().forEach((key,i)=>{
   const item=['aux','design','layout'].includes(key)?{key,label:{aux:'Auxiliary information',design:'Design',layout:'Position / size'}[key]}:this.settings.schema.find(s=>s.key===key);
   const h=this.tab===0?(key==='autoStart'?112:58):68;
   if(i===this.focus){cv.gradientRect(78,y,1460,h-1,[[0,'#30131a'],[1,'#090b0e']]);cv.fillRect(78,y+8,4,42,'#f32b40');}
   const label=/^sport/.test(key)?'Sport mode RPM display':/^all/.test(key)?'All modes RPM display':item.label;
   cv.text(label,100,y+39,32,'#f3f5f7');
   if(key==='appEnabled'){
    [[true,'Start app'],[false,'Stop app']].forEach((v,n)=>this.button(cv,targets,v[1],990+n*278,y+3,260,50,()=>{this.settings.set(key,v[0]);this.changed();},cfg.appEnabled===v[0],'operation-'+v[0]));
   }else{
    let size=30,value=this.value(item,cfg);while(size>18&&cv.textWidth(value,size)>850)size--;
    cv.text(value,1480,y+39,size,'#c1cddd',{align:'right'});targets.push({x:78,y,w:1460,h:h-1,act:()=>this.activate(i),label,id:key});
   }
   if(key==='autoStart'){cv.text(RENDERER_NOTICE,100,y+72,24,'#ff9e36');cv.text(cfg.sportHudOutput==='redline'||cfg.allHudOutput==='redline'?HUD_WARNING:MAP_WARNING,100,y+101,23,'#ff9e36');}
   cv.line(84,y+h-1,1536,y+h-1,0.6,'#292d34');y+=h;
  });
  if(this.tab===1||this.tab===2)cv.text('All modes Redline also applies in Sport.',84,492,23,'#91a1b6');
  if(this.tab===3)cv.text(HUD_WARNING,84,390,25,'#91a1b6');
 }
 backButton(cv,targets){this.button(cv,targets,'Back',1210,448,326,64,()=>this.back(),false,'back');}
 drawChoices(cv,cfg,targets){
  const item=this.item(),list=options(item,cfg),start=Math.max(0,Math.min(list.length-4,this.choice-1));cv.text(item.label,100,126,32,'#ef4050');
  list.slice(start,start+4).forEach((o,row)=>{const i=start+row,y=148+row*72;this.button(cv,targets,o[1],84,y,1452,68,()=>this.choose(i),this.choice===i,'choice'+i);});this.backButton(cv,targets);
 }
 drawAuxMode(cv,cfg,targets){
  cv.text('Auxiliary information',100,126,32,'#ef4050');
  ['Gauges','Text'].forEach((name,i)=>this.button(cv,targets,name,84+i*740,180,712,110,()=>this.choose(i),this.choice===i,'aux-mode'+i));
  cv.text('Select items on the next screen. Changes apply only after OK.',100,360,26,'#a8b6c8');this.backButton(cv,targets);
 }
 drawAuxSelect(cv,cfg,targets){
  const draft=this.draft,limit=draft.mode==='gauges'?2:4;cv.text(t(draft.mode==='gauges'?'Select gauges':'Select text items')+' (1–'+limit+')',100,128,32,'#ef4050',{literal:true});
  D.METRICS.forEach((id,i)=>{const index=draft.items.indexOf(id),x=84+(i%3)*490,y=152+Math.floor(i/3)*82;
   this.button(cv,targets,(index>=0?(index+1)+'. ':'')+t(D.LABELS[id]),x,y,464,70,()=>this.toggleMetric(id),index>=0,'metric-'+id);
  });
  cv.text('Selection order sets the left and right positions.',100,410,24,'#a8b6c8');
  this.button(cv,targets,'OK',84,448,326,64,()=>this.commitAux(),draft.items.length>0,'ok');this.backButton(cv,targets);
 }
 preview(cv,cfg,x,y,width,display){
  const painter=display==='cluster'?CLUSTER:HUD,clean=Object.assign({},cfg);
  D.PARTS.forEach(p=>['OffsetX','OffsetY','WidthScale','HeightScale'].forEach(k=>{clean[display+p+k]=D.defaults[display+p+k];}));
  const s=width/painter.W,state={config:clean,rpm:Math.round(cfg.shiftRpm*0.92/10)*10,gear:'M3',shift:false,flash:true,torqueNm:300,powerPS:180,torquePeak:380,powerPeak:220,aux:{boost:0.85,oil:95,outside:18,gforce:0.35,gLat:0.25,gLong:0.24}};
  const target=vector(cv,x,y,s);target.part=(cfg,d,name,bounds,paint)=>paint(vector(cv,x+(cfg[d+name+'OffsetX']||0)*s,y+(cfg[d+name+'OffsetY']||0)*s,s));painter.draw(state,target);
 }
 previewHUD(cv,cfg,x,y,width){this.preview(cv,cfg,x,y,width,'hud');}
 drawDesign(cv,cfg,targets){
  const display=this.display();['Top alert bar','Circle beside gear'].forEach((label,i)=>{
   const x=84+i*740;this.button(cv,targets,label,x,106,712,64,()=>this.choose(i),this.choice===i,'design'+i);
   const preview=Object.assign({},cfg);preview[display+'AlertStyle']=i?'circle':'bar';this.preview(cv,preview,x+10,182,display==='cluster'?590:690,display);
  });this.backButton(cv,targets);
 }
 drawColors(cv,cfg,targets){
  [['gray','Gray'],['white','White'],['blue','Blue']].forEach((o,i)=>{
   const x=84+i*490;this.button(cv,targets,o[1],x,112,464,70,()=>this.choose(i),this.choice===i,'color'+i);
   NAV.draw({visible:true,maneuver:'RIGHT',color:o[0],distanceText:'300 m'},vector(cv,x+75,225,1.25));
  });this.backButton(cv,targets);
 }
 adjust(param,delta){
  this.layoutParam=param;const cfg=this.config(),nav=this.tab===3;
  const prefix=nav?(this.layoutPart===1?'hudText':'hudNav'):this.display()+D.partsFor(this.display(),cfg)[this.layoutPart].key;
  if(param<2){const key=prefix+(param?'OffsetY':'OffsetX');this.settings.set(key,Math.max(-1000,Math.min(1000,cfg[key]+delta*10)));}
  else if(nav){const key=this.layoutPart===1?'hudTextScale':'navUniformScale';this.settings.set(key,Math.max(20,Math.min(200,cfg[key]+delta*5)));}
  else{const suffix=param===2?'WidthScale':'HeightScale',other=prefix+(param===2?'HeightScale':'WidthScale'),key=prefix+suffix;this.settings.set(key,Math.max(20,Math.ceil(cfg[other]/1.3/5)*5,Math.min(200,Math.floor(cfg[other]*1.3/5)*5,cfg[key]+delta*5)));}
  this.changed();
 }
 drawLayout(cv,cfg,targets){
  const local=[],nav=this.tab===3,display=this.display(),parts=nav?[{key:'Direction',label:'Direction'},{key:'Text',label:'Text'}]:D.partsFor(display,cfg);
  this.layoutPart=Math.min(this.layoutPart,parts.length-1);
  parts.forEach((p,i)=>this.button(cv,local,p.label,84+(i%4)*368,98+Math.floor(i/4)*64,350,54,()=>{this.layoutPart=i;this.choice=i;this.changed();},this.layoutPart===i,'part'+i));
  const selected=parts[this.layoutPart].key,prefix=nav?(this.layoutPart===1?'hudText':'hudNav'):display+selected;
  cv.text('Position',100,245,30,'#b8c5d4');
  const btn=(label,x,y,act,id)=>this.button(cv,local,label,x,y,110,58,act,false,id);
  btn('Up',300,260,()=>this.adjust(1,-1),'up');btn('Left',170,330,()=>this.adjust(0,-1),'left');btn('Right',430,330,()=>this.adjust(0,1),'right');btn('Down',300,400,()=>this.adjust(1,1),'down');
  const rows=nav?['Size']:['Width','Height'];rows.forEach((label,i)=>{
   const y=240+i*90,key=nav?(this.layoutPart===1?'hudTextScale':'navUniformScale'):prefix+(i?'HeightScale':'WidthScale');
   cv.text(label,790,y+20,28,'#b8c5d4');btn('−',1010,y+30,()=>this.adjust(i+2,-1),'size-minus'+i);btn('+',1140,y+30,()=>this.adjust(i+2,1),'size-plus'+i);cv.text(String(cfg[key])+' %',1500,y+75,32,'#f3f5f7',{align:'right',font:'num'});
  });
  let width,height;
  if(nav){const painter=this.layoutPart===1?NAV_TEXT:NAV,scale=cfg[this.layoutPart===1?'hudTextScale':'navUniformScale']/100;width=Math.min(800,Math.round(painter.W*scale));height=Math.min(480,Math.round(painter.H*scale));}
  else{const painter=display==='hud'?HUD:CLUSTER,b=measurePart(painter,{config:cfg,rpm:0,gear:this.liveState&&this.liveState.gear||'--'},display,selected,cv)||{w:0,h:0},r=placement(cfg,display==='hud'?'hud':cfg.displayTarget==='panel'?'panel':'map',painter);width=Math.round(b.w*cfg[prefix+'WidthScale']/100*r.w/painter.W);height=Math.round(b.h*cfg[prefix+'HeightScale']/100*r.h/painter.H);}
  cv.text('X '+cfg[prefix+'OffsetX']+' · Y '+cfg[prefix+'OffsetY']+' · '+width+' × '+height+' px',84,500,23,'#ffad45',{literal:true});
  cv.text(nav?'Width and height scale together.':'Width / height difference limited to 30%.',790,440,18,'#a8b6c8');
  if(!nav&&/^Mark/.test(selected)){
   [['LineHidden','Hide line','Show line'],['Hidden','Hide M mark','Show M mark']].forEach((v,i)=>this.button(cv,local,cfg[prefix+v[0]]?v[2]:v[1],650+i*280,448,260,56,()=>{this.settings.set(prefix+v[0],!this.config()[prefix+v[0]]);this.changed();},cfg[prefix+v[0]],'toggle-'+v[0]));
  }
  this.layoutActions=local;targets.push.apply(targets,local);this.backButton(cv,targets);
 }

}
module.exports={SettingsPage,GROUPS,TABS,options,W,H,MAP_WARNING,HUD_WARNING,RENDERER_NOTICE,WARNING:MAP_WARNING};
