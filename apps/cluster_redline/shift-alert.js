'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Sport modes (and an unknown mode) keep the original alert: lights from 65 %
// of the shift RPM, yellow from 85 %, red at the shift RPM. Comfort, Eco and the
// other non-sport modes shift earlier: the comfort shift RPM is 90 % of the
// selected shift RPM (Petrol 5500 -> 5000) with lights from 50 % (2500), yellow
// from 80 % (4000) and red at 100 % (5000). A Comfort / Eco shift alert RPM set in the Basic settings
// (comfortShiftRpm) replaces that 90 % in every non-sport mode, with the same 50 % / 80 % steps.
function sportLike(mode){return mode===null||mode===undefined||/^(SPORT|PHEV_SPORT|BOOST)/.test(String(mode));}
function shiftSpec(cfg,mode){
 const sport=sportLike(mode),shift=sport?cfg.shiftRpm:cfg.comfortShiftRpm||Math.round(cfg.shiftRpm*0.9/100)*100;
 return {style:sport?'sport':'comfort',shift,start:shift*(sport?0.65:0.5),yellow:shift*(sport?0.85:0.8)};
}
function alertStage(state){const s=shiftSpec(state.config,state.mode);return state.rpm>=s.shift?'red':state.rpm>=s.yellow?'yellow':'green';}
function alertState(state){
 // Comfort lights its first segment as soon as the start RPM is passed; sport is unchanged.
 const s=shiftSpec(state.config,state.mode),f=clamp((state.rpm-s.start)/(s.shift-s.start),0,1),lit=state.shift?12:s.style==='comfort'?(state.rpm>s.start?Math.max(1,Math.floor(f*12)):0):Math.floor(f*12),stage=state.shift?'red':alertStage(state);
 return {lit,stage,visible:lit>0,color:stage==='red'?'#ff2a2a':stage==='yellow'?'#ffd522':'#19ee67'};
}
module.exports={alertStage,alertState,shiftSpec,sportLike};
