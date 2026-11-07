'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const redColor='#ff2a2a', trackColor='#1b212b', redlineTrackColor='#4c1621';
function mix(a,b,t) { return '#'+[0,1,2].map((i)=>Math.round(parseInt(a.slice(1+i*2,3+i*2),16)*(1-t)+parseInt(b.slice(1+i*2,3+i*2),16)*t).toString(16).padStart(2,'0')).join(''); }
function ramp(stops,t) { const f=clamp(t,0,1)*(stops.length-1),i=Math.min(stops.length-2,Math.floor(f));return mix(stops[i],stops[i+1],f-i); }
function warmStart(cfg) { return Math.max(0,Math.min(4000,cfg.redlineRpm-1000)); }
function colorAt(rpm,cfg) {
    const r=clamp(rpm,0,cfg.maxRpm),start=warmStart(cfg);
    if(r>=cfg.redlineRpm)return redColor;
    if(r<start)return ramp(['#266be7','#328aff','#40a0ff','#4aaaff'],r/Math.max(1,start));
    return ramp(['#718bff','#a46cff','#ce4de6','#ef3d93',redColor],(r-start)/Math.max(1,cfg.redlineRpm-start));
}
module.exports={colorAt,warmStart,redColor,trackColor,redlineTrackColor};
