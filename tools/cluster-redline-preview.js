'use strict';
// Host-only previews never connect to a renderer or a vehicle.
const fs = require('fs');
const path = require('path');
const stage = path.resolve(process.argv[2] || path.join(__dirname, '../dist/cluster_redline'));
const out = path.resolve(process.argv[3] || path.join(__dirname, '../preview/cluster_redline'));
const { draw } = require(path.join(stage, 'source/javascript/draw'));
const hud = require(path.join(stage, 'source/javascript/hud-draw'));
const { Canvas } = require(path.join(stage, 'source/javascript/kit/canvas'));
const { Policy, settings } = require(path.join(stage, 'source/javascript/policy'));
fs.mkdirSync(out, { recursive: true });
function scene(name, rpm, engineProfile, options) {
    const p = new Policy(); p.modeSample('SPORT_DYNAMIC', 0); p.rpmSample(rpm, 1000);
    const state = p.evaluate(1000, true, settings(Object.assign({ engineProfile: engineProfile || 'petrol' }, options || {})));
    state.gear = options && options.previewGear || (state.shift ? 'S4' : 'D4');
    state.flash = !!(options && options.previewFlash);
    state.torqueNm = state.shift ? 265 : 380;
    state.powerPS = state.torqueNm * rpm / 9549.2966 * 1.3596216;
    state.torquePeak = state.torqueNm; state.powerPeak = state.powerPS;
    const face = options && options.displayTarget === 'hud' ? hud.draw(state) : draw(state);
    fs.writeFileSync(path.join(out, name + '.png'), face.png());
    const preview = new Canvas(face.w, face.h); preview.clear('#05070b'); preview.blit(face, 0, 0);
    fs.writeFileSync(path.join(out, name + '-on-black.png'), preview.png());
}
scene('sport-rpm', 4200);
scene('sport-shift', 6500);
scene('g20-redzone', 6200);
scene('diesel-rpm', 3000, 'diesel');
scene('diesel-shift', 4200, 'diesel');
scene('hybrid-rpm', 3500, 'hybrid');
scene('threshold-2000-before', 1990, 'petrol', { shiftRpm: 2000 });
scene('threshold-2000-alert', 2000, 'petrol', { shiftRpm: 2000 });
scene('hud-rpm', 3500, 'petrol', { displayTarget: 'hud', previewGear:'D1' });
scene('hud-yellow', 5000, 'petrol', { displayTarget:'hud', previewGear:'S1' });
scene('hud-shift', 5500, 'petrol', { displayTarget:'hud', previewGear:'M1', previewFlash:true });
scene('hud-shift-dim', 5500, 'petrol', { displayTarget:'hud', previewGear:'M1', previewFlash:false });
scene('hud-park', 700, 'petrol', { displayTarget:'hud', previewGear:'P' });
const html = `<!doctype html><meta charset="utf-8"><title>계기판 레드라인 미리보기</title>
<style>body{background:#10151d;color:#ecf2fa;font:18px system-ui;max-width:1088px;margin:32px auto;padding:16px}img{max-width:100%}section{border:1px solid #34465b;padding:20px;margin:20px 0;border-radius:12px}.off{height:140px;display:grid;place-items:center;color:#a5b7cb;background:#0b0e12}p{line-height:1.6}</style>
<h1>계기판 레드라인</h1><p>실제 앱 렌더링 미리보기 · 데모 수치 · 내부 1088 × 480 / 기본 실차 표시 816 × 360 · 마력*은 토크와 RPM으로 계산한 PS입니다. 빈 배경은 투명합니다.</p>
<section><h2>부팅 · Comfort · Eco · 신호 없음</h2><div class="off">표시 OFF — 이 앱은 레이어를 만들지 않으며 순정 화면을 유지합니다.</div></section>
<section><h2>가솔린 · 스포츠 모드</h2><img src="sport-rpm.png" alt="가솔린 4200 rpm"><p>확인된 스포츠 모드와 최신 회전수 신호가 있을 때만 표시합니다.</p></section>
<section><h2>가솔린 · 변속 알림</h2><img src="sport-shift.png" alt="가솔린 6500 rpm 변속 알림"><p>기본 설정: 알림은 별도 설정 · G20 가솔린 레드라인 시작 6000 · 눈금 최대 7000 rpm.</p></section>
<section><h2>G20 · 6000 rpm부터 적색 구간</h2><img src="g20-redzone.png" alt="6200 rpm, 6000부터 적색 구간, 최대 눈금 7000 rpm"></section>
<section><h2>2000 rpm 설정 회귀 검사</h2><img src="threshold-2000-before.png" alt="1990 rpm 일반 표시"><img src="threshold-2000-alert.png" alt="2000 rpm 적색 회전수 알림"><p>설정한 2000 rpm에 도달하면 회전수가 빨간색으로 바뀝니다. 하단 단수는 데모 4단이며 실차에서는 읽은 신호만 표시합니다.</p></section>
<section><h2>디젤 · 스포츠 모드</h2><img src="diesel-rpm.png" alt="디젤 3000 rpm"><p>디젤 기본 설정: 알림 4200 · 레드라인 5000 · 눈금 6000 rpm. 차량별 조정이 필요합니다.</p></section>
<section><h2>디젤 · 변속 알림</h2><img src="diesel-shift.png" alt="디젤 4200 rpm 변속 알림"></section>
<section><h2>하이브리드 · 엔진 작동</h2><img src="hybrid-rpm.png" alt="하이브리드 3500 rpm"><p>엔진이 작동하고 스포츠 모드일 때 RPM을 표시합니다. 엔진이 정지하면 표시를 해제합니다. RPM만으로 전기 구동·회생 여부를 판정하지 않습니다.</p></section>
<p>스포츠 모드를 벗어나면 레이어를 해제합니다. 실제 표시는 차량·펌웨어·계기판 모드에 따라 검증해야 합니다.</p>`;
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('Preview:', path.join(out, 'index.html'));
