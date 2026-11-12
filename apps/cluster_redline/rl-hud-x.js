'use strict';
// Cluster Redline's own layouts in the Redline layout family (redline-hud.js): M shift lights, data logger,
// analog needle, G-force + RPM rings, mode ribbon, hexagon and five dials. Drawn in a 1088x480 design space scaled to the
// layouts' 400x176 image, so the same frame (f) and element filter (f.only) work as for the other layouts.
// Readouts are the display's selected auxiliary items (f.readouts), like the other layouts.
const {language}=require('./strings');
const S=400/1088,IH=176,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),isNum=x=>typeof x==='number'&&isFinite(x);
const C={track:'#1b212b',dim:'#8d97a4',soft:'#c8d2df',text:'#f4f7fb',accent:'#ff6a1a',red:'#c4202f',redDim:'#3a1218',off:'#171c23'};
const want=(f,p)=>!f.only||f.only===p;
const rpmText=d=>isNum(d.rpm)?String(Math.round(d.rpm/10)*10):'----';
// Fraction of the way from the first light to the shift point, and whether the alert flashes now.
function cue(f){const c=f.cue,r=isNum(f.d.rpm)?f.d.rpm:0;return {p:clamp((r-c.from)/Math.max(1,c.at-c.from),0,1),flash:c.shift||c.limiter,on:f.blink!==false};}
function pill(cv,x,y,w,h,col){cv.fillRect(x+h/2,y,w-h,h,col);cv.circle(x+h/2,y+h/2,h/2,col);cv.circle(x+w-h/2,y+h/2,h/2,col);}
function ring(cv,cx,cy,r,w,col){cv.arc(cx,cy,r-w/2,r+w/2,0,360,col);}
// Drive-mode colour and name for the ribbon: Comfort blue, Sport orange, Eco green.
function drive(mode){const m=String(mode||'');if(/SPORT|BOOST/.test(m))return {col:'#ff6a1a',name:language()==='ko'?'스포츠':'SPORT'};
 if(/ECO/.test(m))return {col:'#2bd46a',name:language()==='ko'?'에코':'ECO'};if(m)return {col:'#3d8bff',name:language()==='ko'?'컴포트':'COMFORT'};return {col:'#ff6a1a',name:''};}
function readout(cv,it,x,y,ls,vs,align,col){if(!it)return;const o={align,font:'bold'};cv.text(it.label,x,y,ls,C.dim,o);cv.text(it.value,x,y+vs*0.95,vs,col||C.text,o);}

function drawShift(cv,f,h){
 const d=f.d,q=cue(f),lit=q.flash?15:Math.floor(q.p*15+1e-6);
 if(want(f,'alert'))for(let i=0;i<15;i++){const col=i<5?h.P.low:i<10?h.P.mid:h.P.high,on=i<lit&&(!q.flash||q.on);pill(cv,84+i*62,36,48,26,on?(q.flash?h.P.flash:col):C.off);}
 if(want(f,'gear'))cv.text(h.gearText(d),544,330,230,C.text,{align:'center',font:h.gearFont(f.opts)});
 if(want(f,'mode')&&f.mode)cv.text(f.mode,640,170,44,C.accent,{font:'bold'});
 if(want(f,'rpm'))cv.text(rpmText(d),544,395,46,'#9aa6b6',{align:'center',font:'bold',spacing:6});
 if(want(f,'read')&&f.readouts.length){const n=f.readouts.length;f.readouts.forEach((it,i)=>cv.text(it.label+' '+it.value,544+(i-(n-1)/2)*250,450,30,C.soft,{align:'center',font:'bold'}));}
}
function drawLogger(cv,f,h){
 const d=f.d,max=f.max;
 if(want(f,'gauge')){const r=isNum(d.rpm)?d.rpm:0;for(let i=0;i<40;i++){const v=i/40*max,col=v>=f.redline?h.P.high:v>=f.cue.from?h.P.mid:h.P.low;cv.fillRect(60+i*24.2,60,20,70,v<r?(f.cue.shift&&!f.blink?C.off:col):v>=f.redline?C.redDim:C.off);}
  for(let k=0;k*1000<=max;k++)cv.text(String(k),60+968*k*1000/max,166,26,C.dim,{align:k===0?'left':k*1000===max?'right':'center',font:'bold'});}
 if(want(f,'gear')){cv.polyline([[60,190],[310,190],[310,440],[60,440],[60,190]],4,C.accent);cv.text('GEAR',80,225,26,C.accent,{font:'bold'});cv.text(h.gearText(d),185,390,210,C.text,{align:'center',font:h.gearFont(f.opts)});}
 if(want(f,'mode')&&f.mode)cv.text(f.mode,292,225,30,C.accent,{align:'right',font:'bold'});
 if(want(f,'rpm')){cv.text('RPM',1028,232,26,C.dim,{align:'right',font:'bold'});cv.text(rpmText(d),1028,300,56,f.cue.shift?h.P.high:'#ffd522',{align:'right',font:'bold'});}
 [[350,232],[700,232],[350,362],[700,362]].forEach((p,i)=>{if(want(f,'read'+'ABCD'[i]))readout(cv,f.readouts[i],p[0],p[1],26,72,'left');});
}
function drawNeedle(cv,f,h){
 const d=f.d,max=f.max,cx=544,cy=430,A=v=>-90+180*clamp(v,0,max)/max,pt=(a,r)=>[cx+r*Math.sin(a*Math.PI/180),cy-r*Math.cos(a*Math.PI/180)];
 if(want(f,'gauge')){
  cv.arc(cx,cy,330,360,-90,90,C.track);cv.arc(cx,cy,330,360,A(f.redline),90,C.red);
  for(let k=0;k*1000<=max;k++){const a=A(k*1000),p=pt(a,360),q=pt(a,328),l=pt(a,292);cv.line(p[0],p[1],q[0],q[1],5,'#e6ecf3');cv.text(String(k),l[0],l[1]+12,34,k*1000>=f.redline?'#ff4a55':'#e6ecf3',{align:'center',font:'bold'});}
  const a=A(isNum(d.rpm)?d.rpm:0),tip=pt(a,320);cv.line(cx,cy,tip[0],tip[1],9,f.cue.shift&&f.blink?h.P.flash:'#ff7a1a');cv.circle(cx,cy,28,'#2a3039');ring(cv,cx,cy,26,4,'#ff7a1a');
 }
 if(want(f,'gear'))cv.text(h.gearText(d),544,345,130,C.text,{align:'center',font:h.gearFont(f.opts)});
 if(want(f,'mode')&&f.mode)cv.text(f.mode,600,255,36,C.accent,{font:'bold'});
 const at=[[60,415,'left'],[1028,415,'right'],[60,40,'left'],[1028,40,'right']];
 at.forEach((p,i)=>{if(want(f,'read'+'ABCD'[i]))readout(cv,f.readouts[i],p[0],p[1],26,40,p[2],C.soft);});
}
function drawRings(cv,f,h){
 const d=f.d,max=f.max,g=f.g||{};
 if(want(f,'gmeter')){const cx=290,cy=240;ring(cv,cx,cy,160,4,'#2a3039');ring(cv,cx,cy,80,3,'#1f252d');cv.line(130,cy,450,cy,3,'#1f252d');cv.line(cx,80,cx,400,3,'#1f252d');
  const lat=isNum(g.lat)?clamp(g.lat,-1.2,1.2):0,lon=isNum(g.long)?clamp(g.long,-1.2,1.2):0;cv.circle(cx+lat*150,cy-lon*150,16,'#ffd522');
  cv.text(isNum(g.total)?g.total.toFixed(2)+' G':'-- G',cx,455,34,'#ffd522',{align:'center',font:'bold'});}
 if(want(f,'gauge')){const cx=800,cy=240,A=v=>-135+270*clamp(v,0,max)/max,r=isNum(d.rpm)?d.rpm:0;
  cv.arc(cx,cy,144,176,-135,135,C.track);cv.arc(cx,cy,144,176,A(f.redline),135,C.redDim);
  if(r>0)cv.arc(cx,cy,144,176,-135,A(r),f.cue.shift?(f.blink?h.P.flash:C.track):r>=f.cue.from?h.P.mid:C.accent);}
 if(want(f,'gear'))cv.text(h.gearText(d),800,290,150,C.text,{align:'center',font:h.gearFont(f.opts)});
 if(want(f,'mode')&&f.mode)cv.text(f.mode,868,175,40,C.accent,{font:'bold'});
 if(want(f,'rpm'))cv.text(rpmText(d),800,440,40,'#9aa6b6',{align:'center',font:'bold',spacing:4});
 if(want(f,'read'))f.readouts.forEach((it,i)=>readout(cv,it,544,110+i*92,22,40,'center'));
}
function drawRibbon(cv,f,h){
 const d=f.d,dm=drive(f.drive),B=t=>{const u=1-t;return [u*u*u*60+3*u*u*t*330+3*u*t*t*520+t*t*t*1028,u*u*u*410+3*u*u*t*410+3*u*t*t*140+t*t*t*90];};
 if(want(f,'gauge')){const pts=[];for(let i=0;i<=64;i++)pts.push(B(i/64));cv.polyline(pts,40,C.track);
  const p=isNum(d.rpm)?clamp(d.rpm/f.max,0,1):0,n=Math.round(p*64);if(n>0)cv.polyline(pts.slice(0,n+1),40,f.cue.shift?(f.blink?h.P.flash:C.track):dm.col);}
 if(want(f,'gear'))cv.text(h.gearText(d),90,230,190,C.text,{font:h.gearFont(f.opts)});
 if(want(f,'mode')&&(dm.name||f.mode))cv.text(dm.name||f.mode,96,290,34,dm.col,{font:'bold',spacing:4});
 [[640,290],[850,290],[640,395],[850,395]].forEach((p,i)=>{if(want(f,'read'+'ABCD'[i]))readout(cv,f.readouts[i],p[0],p[1],26,52,'left');});
}
// Hexagon: an angular hexagonal tachometer (yellow, red past the redline) round a hexagonal gear cell,
// readouts in angled side boxes, two chevrons as the shift light.
// The part of a polyline between fractions t0 and t1 of its length.
function sub(pts,t0,t1){const seg=[];let total=0;for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);total+=l;}
 const d0=clamp(t0,0,1)*total,d1=clamp(t1,0,1)*total,at=(i,u)=>[pts[i][0]+(pts[i+1][0]-pts[i][0])*u,pts[i][1]+(pts[i+1][1]-pts[i][1])*u],out=[];let run=0;
 for(let i=0;i<seg.length;i++){const a=run,b=run+seg[i];if(b>=d0&&a<=d1){if(!out.length)out.push(at(i,(Math.max(d0,a)-a)/seg[i]));out.push(at(i,(Math.min(d1,b)-a)/seg[i]));}run=b;}
 return out.length?out:[pts[0],pts[0]];}
const pointAt=(pts,t)=>{const p=sub(pts,0,t);return p[p.length-1];};
function drawHexagon(cv,f,h){
 const d=f.d,max=f.max,q=cue(f),P=[[354,342],[354,158],[544,62],[734,158],[734,342]],r=isNum(d.rpm)?d.rpm/max:0,red=f.redline/max,YEL='#e8ff1a';
 if(want(f,'gauge')){
  cv.polyline([[544,30],[760,140],[760,360],[544,470],[328,360],[328,140],[544,30]],3,'#2a2f37');
  cv.polyline(P,22,C.track);cv.polyline(sub(P,red,1),22,C.redDim);
  if(r>0){const flash=q.flash&&!q.on;cv.polyline(sub(P,0,Math.min(r,red)),22,flash?C.track:q.flash?h.P.flash:YEL);if(r>red)cv.polyline(sub(P,red,r),22,flash?C.track:'#ff2a2a');}
  for(let k=0;k*1000<=max;k++){const p=pointAt(P,k*1000/max),x=p[0]+(544-p[0])*0.16,y=p[1]+(250-p[1])*0.16;cv.text(String(k),x,y+9,24,k*1000>=f.redline?'#ff4a55':'#e6ecf3',{align:'center',font:'bold'});}}
 if(want(f,'alert')){const lit=q.flash?(q.on?h.P.flash:C.off):q.p>=0.66?h.P.high:q.p>=0.33?h.P.mid:q.p>0?h.P.low:C.off;cv.quad([[300,40],[330,40],[316,62],[314,62]],lit);cv.quad([[758,40],[788,40],[774,62],[772,62]],lit);}
 if(want(f,'gear')){cv.polyline([[544,170],[613,210],[613,290],[544,330],[475,290],[475,210],[544,170]],3,YEL);cv.text(h.gearText(d),544,292,120,C.text,{align:'center',font:h.gearFont(f.opts)});}
 if(want(f,'mode')&&f.mode)cv.text(f.mode,624,206,32,YEL,{font:'bold'});
 if(want(f,'rpm'))cv.text(rpmText(d),544,385,40,q.flash?h.P.flash:YEL,{align:'center',font:'bold',spacing:4});
 const box=[[60,150,1],[60,270,1],[1028,150,-1],[1028,270,-1]];
 box.forEach((b,i)=>{if(!want(f,'read'+'ABCD'[i])||!f.readouts[i])return;const [x,y,s]=b;cv.polyline([[x,y],[x+190*s,y],[x+220*s,y+30],[x+220*s,y+90],[x+30*s,y+90],[x,y+60],[x,y]],3,'#2a2f37');
  readout(cv,f.readouts[i],x+20*s,y+35,22,44,s>0?'left':'right');});
}
// Five dials: a large round tachometer with a needle and red zone, the gear and RPM inside it, a row of
// shift lights, and four smaller round dials for the readouts.
function drawFiveDials(cv,f,h){
 const d=f.d,max=f.max,q=cue(f),cx=544,cy=240,R=185,A=v=>-135+270*clamp(v,0,max)/max,pt=(a,r)=>[cx+r*Math.sin(a*Math.PI/180),cy-r*Math.cos(a*Math.PI/180)];
 if(want(f,'gauge')){
  cv.circle(cx,cy,R,'#0d1014');ring(cv,cx,cy,R,5,'#5a616b');cv.arc(cx,cy,R-30,R-19,A(f.redline),135,'#e0262f');
  for(let k=0;k*1000<=max;k++){const a=A(k*1000),o=pt(a,R-2),i=pt(a,R-24),l=pt(a,R-46),hot=k*1000>=f.redline;cv.line(o[0],o[1],i[0],i[1],5,hot?'#e0262f':'#f2f4f7');cv.text(String(k),l[0],l[1]+11,30,hot?'#ff4a55':'#f2f4f7',{align:'center',font:'bold'});}
  for(let k=500;k<max;k+=1000){const a=A(k),o=pt(a,R-2),i=pt(a,R-13);cv.line(o[0],o[1],i[0],i[1],3,'#9aa6b6');}
  cv.text('1/min x1000',cx,200,17,C.dim,{align:'center'});
  const tip=pt(A(isNum(d.rpm)?d.rpm:0),R-26);cv.line(cx,cy,tip[0],tip[1],7,q.flash&&q.on?h.P.flash:'#ff2a1a');cv.circle(cx,cy,20,'#1a1e24');ring(cv,cx,cy,20,3,'#5a616b');}
 if(want(f,'alert')){const lit=q.flash?15:Math.floor(q.p*5+1e-6)*3;for(let i=0;i<5;i++){const col=i<2?h.P.low:i<4?h.P.mid:h.P.high,on=q.flash?q.on:i*3<lit;cv.circle(504+i*20,165,6,on?(q.flash?h.P.flash:col):C.off);}}
 if(want(f,'gear'))cv.text(h.gearText(d),cx,330,64,C.text,{align:'center',font:h.gearFont(f.opts)});
 if(want(f,'mode')&&f.mode)cv.text(f.mode,cx+40,300,26,C.accent,{font:'bold'});
 if(want(f,'rpm'))cv.text(rpmText(d)+' rpm',cx,372,26,'#9aa6b6',{align:'center',font:'bold',spacing:3});
 const dial=[[264,250,85,40],[824,250,85,40],[99,260,70,32],[989,260,70,32]];
 dial.forEach((g,i)=>{if(!want(f,'read'+'ABCD'[i])||!f.readouts[i])return;const [x,y,r,vs]=g;ring(cv,x,y,r,4,'#3a4048');readout(cv,f.readouts[i],x,y-12,r>80?20:18,vs,'center');});
}
const DRAW={shift:drawShift,logger:drawLogger,needle:drawNeedle,rings:drawRings,ribbon:drawRibbon,hexagon:drawHexagon,fivedial:drawFiveDials};
// Each layout draws in one pass (no separate background layer); the bg layer request draws nothing.
function drawX(cv,f,layer,h){if(layer==='bg')return;DRAW[f.opts.style](h.scaled(cv,S,0,0),f,h);}
module.exports={STYLES:Object.keys(DRAW),IH,drawX};
