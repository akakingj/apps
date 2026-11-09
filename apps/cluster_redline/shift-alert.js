'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function alertStage(state){return state.rpm>=state.config.shiftRpm?'red':state.rpm>=state.config.shiftRpm*0.85?'yellow':'green';}
function alertState(state){
 const shift=state.config.shiftRpm,start=shift*0.65,lit=state.shift?12:Math.floor(clamp((state.rpm-start)/(shift-start),0,1)*12),stage=alertStage(state);
 return {lit,stage,visible:lit>0,color:stage==='red'?'#ff2a2a':stage==='yellow'?'#ffd522':'#19ee67'};
}
module.exports={alertStage,alertState};
