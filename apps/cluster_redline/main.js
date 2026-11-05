'use strict';
const fs = require('fs');
const path = require('path');
const mgu = require('./kit/mgu');
const { Canvas } = require('./kit/canvas');
const { DEFAULTS, PROFILES, settings: effectiveSettings } = require('./policy');
const worker = require('./worker');
const REASONS = { disabled: '자동 표시 꺼짐', renderer_unavailable: '계기판 렌더러 연결 대기',
    profile_unknown: '엔진 프로필 확인 필요', hybrid_engine_stopped: '하이브리드 엔진 정지 · 표시 안 함',
    renderer_refused: '렌더러가 표시를 허용하지 않음', mode_unknown: '주행 모드 신호 대기', not_sport: '일반 모드 · 표시 안 함',
    rpm_unknown: '엔진 회전수 신호 대기', rpm_invalid: '회전수 값 확인 필요', engine_stopped: '엔진 정지 · 표시 안 함',
    stabilizing: '스포츠 모드 확인 중', sport: '스포츠 모드 · 표시 요청', stopped: '자동 시작 서비스 중지' };
const MODES = { SPORT: '스포츠', SPORT_PLUS: '스포츠 플러스', SPORT_INDIVIDUAL: '스포츠 개별 설정',
    COMFORT: '컴포트', COMFORT_PLUS: '컴포트 플러스', COMFORT_INDIVIDUAL: '컴포트 개별 설정',
    ECO_PRO: '에코 프로', ECO_PRO_PLUS: '에코 프로 플러스', ECO_PRO_INDIVIDUAL: '에코 프로 개별 설정', ADAPTIVE: '어댑티브' };
const LAYERS = { hidden: '표시 안 함', waiting: '표시 대기', shown: '표시 중', suspended: '표시 일시 중지' };
mgu.run({ async start(ctx) {
    // A different engine must not inherit the previous engine's manual limits.
    ctx.settings.onChange((key) => {
        if (key === 'engineProfile') ['shiftRpm', 'redlineRpm', 'maxRpm'].forEach((name) => ctx.settings.set(name, 0));
    });
    // This timer lives outside ctx.loop, which intentionally pauses with the UI.
    worker.start(ctx);
    async function render() {
        let state = null;
        try { state = JSON.parse(fs.readFileSync(path.join(ctx.dataDir, 'cluster-redline-status.json'), 'utf8')); } catch (e) {}
        if (state && (!isFinite(Date.parse(state.at)) || Date.now() - Date.parse(state.at) > 5000)) state = null;
        const cv = new Canvas(1600, 520);
        cv.clear('#0b0f15');
        cv.text('계기판 레드라인', 54, 74, 40, '#f3f5fa', { font: 'bold' });
        cv.text('자동 시작 · 스포츠 모드 전용', 54, 118, 25, '#8fabc4');
        cv.roundRect(48, 157, 1504, 221, 18, '#141e29');
        cv.text(state ? REASONS[state.reason] || state.reason : '자동 시작 서비스 연결 대기', 80, 217, 32, '#f3f5fa');
        const raw = {};
        Object.keys(DEFAULTS).forEach((k) => { raw[k] = ctx.settings.get(k); });
        const cfg = effectiveSettings(raw), profile = PROFILES[cfg.engineProfile];
        cv.text('주행 모드: ' + (state && MODES[state.mode] || '확인 중'), 80, 269, 25, '#a8bfd4');
        cv.text('계기판 상태: ' + (state && LAYERS[state.layerState] || '표시 안 함'), 80, 311, 25, '#a8bfd4');
        cv.text('프로필: ' + (profile ? profile.label : '확인 필요'), 820, 269, 25, '#a8bfd4');
        cv.text('변속 알림: ' + cfg.shiftRpm + ' rpm', 820, 311, 25, '#a8bfd4');
        cv.text('레드라인 / 눈금: ' + cfg.redlineRpm + ' / ' + cfg.maxRpm + ' rpm', 80, 353, 25, '#a8bfd4');
        cv.text('일반 모드·신호 끊김에서는 중앙 화면을 점유하지 않습니다.', 54, 437, 25, '#a8bfd4');
        cv.text('시동 후 앱을 열지 않아도 서비스가 표시 조건을 확인합니다.', 54, 479, 23, '#8194a8');
        await ctx.ui.image('MAIN_GFX', cv);
    }
    ctx.loop('MAIN', 2, render);
    await render();
} });
