'use strict';
// Reproducible screenshots from built app painters; all telemetry is example data.
// node tools/render-gallery.js <Korean stage> <English stage> <output folder>
const fs=require('fs'),path=require('path');
const [ko,en,dest]=process.argv.slice(2);if(!ko||!en||!dest)throw Error('Usage: <Korean stage> <English stage> <output folder>');
const output=path.resolve(dest);fs.mkdirSync(output,{recursive:true});const images=[];
function render(stage,language){
 const root=path.join(path.resolve(stage),'source/javascript'),{Canvas}=require(root+'/kit/canvas'),{SettingsPage}=require(root+'/settings-ui'),HUD=require(root+'/hud-compose'),CLUSTER=require(root+'/draw'),NAV=require(root+'/nav-draw'),{settings}=require(root+'/policy'),D=require(root+'/display-config');
 const spec=require(root+'/kit/app-spec.json'),values={};spec.settings.forEach(s=>values[s.key]=s.default);const store={schema:spec.settings,get:k=>values[k],set:(k,v)=>values[k]=v},page=new SettingsPage(store,null,spec.version.replace(/-ko\.1$/,''));
 const base={config:settings(),rpm:4000,gear:'M3',shift:false,flash:true,torqueNm:360,powerPS:240,torquePeak:400,powerPeak:260,aux:{boost:0.85,oil:95,outside:18,gforce:0.35,gLat:0.25,gLong:0.24,batteryCharge:78,batteryVoltage:14.25,economy:12.4},navigation:{visible:true,kind:'intersection',maneuver:'RIGHT',distanceText:'300 m',description:'교차로',provider:'ANDROID_AUTO'}};
 const save=(name,cv,title)=>{const file=name+'-'+language+'.png';fs.writeFileSync(path.join(output,file),cv.png());images.push({file,title,language,width:cv.w,height:cv.h});};
 const screen=(name,title)=>save(name,page.draw(new Canvas(1600,520)),title);
 const face=(display,changes)=>{const painter=display==='hud'?HUD:CLUSTER,s=Object.assign({},base,changes);if(painter.createCache)s.renderCache=painter.createCache();s.powerPS=s.torqueNm*s.rpm/9549.2966*1.3596216;s.powerPeak=Math.max(s.powerPeak,s.powerPS);const im=painter.draw(s),cv=new Canvas(im.w,im.h);cv.clear('#05080c');cv.blit(im,0,0);return cv;};
 for(const display of ['hud','cluster'])for(const style of ['circle','bar']){
  const config=settings({hudAlertStyle:style,clusterAlertStyle:style});save(display+'-'+style,face(display,{config}),display+' / '+style);
  for(const flash of [true,false])save(display+'-'+style+'-red-'+(flash?'on':'off'),face(display,{config,rpm:5650,shift:true,flash}),display+' / '+style+' / red '+(flash?'on':'off')+' at 5650rpm');
 }
 {
  const pairs=[['boost','torque'],['power','oil'],['gforce','outside'],['batteryCharge','batteryVoltage'],['economy','torque']];
  for(const display of ['hud','cluster']){
   for(const items of pairs)save(display+'-gauges-'+items.join('-'),face(display,{config:settings({[display+'AuxConfig']:JSON.stringify({mode:'gauges',items})})}),display+' / gauges '+items.join(', '));
   save(display+'-values-four',face(display,{config:settings({[display+'AuxConfig']:JSON.stringify({mode:'values',items:['boost','torque','batteryVoltage','economy']})})}),display+' / four text metrics');
  }
 }
 const tabs=['basic','hud','cluster','nav'];for(let i=0;i<4;i++){page.selectTab(i);screen('settings-'+tabs[i],tabs[i]+' settings');}
 for(const display of ['hud','cluster']){
  page.selectTab(display==='hud'?1:2);page.activate(2);screen('settings-'+display+'-metric-mode','Gauge / text selection');page.choose(1);['boost','torque','batteryVoltage','economy'].forEach(k=>page.toggleMetric(k));screen('settings-'+display+'-metric-picker','Ordered metric selection; commit only by OK');page.back();page.back();
  page.activate(3);screen('settings-'+display+'-design','RPM design selection');page.back();
  for(const style of ['circle','bar']){store.set(display+'AlertStyle',style);page.activate(4);screen('settings-'+display+'-position-'+style,display+' component positioning / '+style);page.back();}
  page.activate(4);const parts=D.partsFor(display,page.config());for(const key of display==='hud'?['Mark']:['MarkTop','MarkBottom']){page.selectLayoutPart(parts.findIndex(p=>p.key===key),true);page.choice=page.layoutPart;screen('settings-'+display+'-'+key.toLowerCase(),'M placement and independent line/M visibility');}page.back();
 }
 page.selectTab(3);page.activate(1);screen('settings-nav-colors','Gray / white / blue');page.back();page.activate(2);screen('settings-nav-direction','Direction offset (210,30), size 168×78');page.selectLayoutPart(1,true);page.choice=1;screen('settings-nav-text','Text offset (180,10), size 156×31');
 {
  const directions=['LEFT','RIGHT','STRAIGHT_ON','SLIGHT_LEFT','SLIGHT_RIGHT','UTURN_LEFT','UTURN_RIGHT','ROUNDABOUT','LANE_LEFT','LANE_RIGHT','ARRIVAL_LEFT','ARRIVAL_RIGHT'],sheet=new Canvas(960,640);sheet.clear('#05080c');
  directions.forEach((maneuver,i)=>{const x=i%4*240,y=Math.floor(i/4)*210;sheet.text(maneuver.replace(/_/g,' '),x+120,y+25,15,'#b8c2d1',{align:'center',literal:true});sheet.blit(NAV.draw({visible:true,maneuver,exitNumber:3,color:'blue',distanceText:'300 m'}),x,y+50);});save('navigation-directions',sheet,'Supported maneuver symbols; roundabout exit number is example data');
  const branches=['HIGHWAY_IN_LEFT','HIGHWAY_IN_STRAIGHT','HIGHWAY_IN_RIGHT','HIGHWAY_OUT_LEFT','HIGHWAY_OUT_STRAIGHT','HIGHWAY_OUT_RIGHT'],highway=new Canvas(840,380);highway.clear('#05080c');branches.forEach((branchType,i)=>{const x=i%3*280,y=Math.floor(i/3)*185;highway.text(branchType.replace('HIGHWAY_','').replace(/_/g,' '),x+140,y+25,16,'#b8c2d1',{align:'center',literal:true});highway.blit(NAV.draw({visible:true,kind:'branch',branchType,color:'blue',distanceText:'300 m'}),x+20,y+48);});save('navigation-highway',highway,'Six highway entry/exit direction diagrams, not map or lane images');
 }
}
render(ko,'ko');render(en,'en');fs.writeFileSync(path.join(output,'gallery.json'),JSON.stringify(images,null,2)+'\n');console.log('Rendered '+images.length+' screenshots to '+output);
