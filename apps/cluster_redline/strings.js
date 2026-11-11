'use strict';
// Korean text for labels added after the Store runtime templates were generated.
// The templates carry the settings schema and locale catalog (their fingerprint
// covers app.json and localization/ko-additions.tsv), so these few strings are
// translated here; when the templates are next regenerated they can move into
// localization/ko-additions.tsv.
let t=v=>String(v),getLanguage=()=>'en';
try{({t,getLanguage}=require('./kit/i18n'));}catch(e){/* host tests load sources without the kit */}
const KO={
 'Clock':'시계','Gauges only':'게이지 전용','Clock time':'시계 시간','UTC+9 (Korea)':'UTC+9 (한국)','Head unit time':'헤드유닛 시간',
 'Save / load':'저장 / 불러오기','Save / load positions':'위치 저장 / 불러오기','Reset to defaults':'기본값으로 초기화',
 'Press again to reset':'한 번 더 누르면 초기화','Press again to reset to defaults':'한 번 더 누르면 기본값으로 초기화',
 'Slot':'슬롯','Saved':'저장됨','Empty':'비어 있음','Save':'저장','Load':'불러오기',
 'Saved to slot':'저장 완료 · 슬롯','Loaded slot':'불러오기 완료 · 슬롯','Slot is empty':'빈 슬롯입니다',
 'Navigation preview':'길안내 미리보기','Moving parts are shown while adjusting.':'조정 중인 항목은 데이터가 없어도 화면에 표시됩니다.'
};
function tr(value){return getLanguage()==='ko'&&Object.prototype.hasOwnProperty.call(KO,value)?KO[value]:t(value);}
module.exports={tr,KO};
