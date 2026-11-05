# 계기판 레드라인

[English](README.md) | 한국어

기존 `idrive7-apps`에 함께 넣어 빌드·설치하는 앱입니다. ID는 `cluster_redline`, 버전은 **0.4.1**입니다.

![한글 변속 알림](../../screenshots/cluster_redline/sport-shift.png)

## 동작과 엔진 프로필

MGU 시작 시 앱만 백그라운드에서 자동 시작합니다. 계기판 기본 표시는 OFF이며,
스포츠·스포츠 플러스·스포츠 개별 설정과 최신 RPM을 확인하면 중앙 지도 영역에 표시를 요청합니다.
일반 모드·신호 끊김·엔진 정지에서는 레이어를 해제합니다.
앱 화면을 계속 열어둘 필요가 없으며 설정에서 자동 표시를 끌 수 있습니다.

| 엔진 프로필 | 변속 알림 | 레드라인 | 눈금 최대 |
|---|---:|---:|---:|
| 가솔린 (G20 330i 기준) | 6500 rpm | 6000 rpm | 7000 rpm |
| 디젤 | 4200 rpm | 5000 rpm | 6000 rpm |
| 하이브리드 | 6500 rpm | 7000 rpm | 8000 rpm |

차량별로 검증된 한계나 최적 변속 시점이 아닌 **표시용 초기값**입니다. 본인 차량에 맞게 조절하세요.
엔진 종류는 자동 감지하지 않습니다.
프로필을 바꾸면 수동 RPM 설정을 초기화하고 최신 신호를 다시 확인합니다.
하이브리드는 가솔린 기반 PHEV의 엔진 RPM용이며, 엔진 정지 시 숨깁니다.
전기 출력·회생·SOC·순수 전기차 화면은 포함하지 않습니다.

## 기존 명령으로 언어 선택·미리보기

추가 소스만 받았다면 먼저 [소스 합치기](../../docs/JAM-INTEGRATION.ko.md)를 한 번 진행하세요.
이후 **합쳐진 원본 프로젝트 최상위 폴더**에서:

```powershell
python kit/tools/build.py --language ko --preview-only cluster_redline
node kit/tools/preview.js dist/cluster_redline preview/cluster_redline-ui frames=3
node tools/cluster-redline-preview.js
```

기본은 영어이며 `--language ko`를 넣으면 한국어로 빌드합니다.
계기판 데모는 `preview/cluster_redline/index.html`, 앱 상태 화면은 `preview/cluster_redline-ui/`에서 확인합니다.
미리보기 실행 시 언어만 바꾸는 것이 아니라 **빌드할 때 언어를 선택**해야 합니다.

## 기존 앱들과 한 번에 배포

```powershell
python kit/tools/make_kit.py --language ko
```

앱 이름을 생략하면 기존 앱 전부와 새 두 앱을 한 번에 빌드합니다.
기존 `deploy\make-car-kit.cmd --language ko` 또는 `deploy/make-car-kit.sh --language ko`도 같습니다.
완성 파일은 **`dist/mgu-custom-apps-ko.tar.gz`**이며 기존 `push-to-car`로 검사·설치합니다.
[공통 설치 안내](../../docs/JAM-INTEGRATION.ko.md)를 따르세요.

별도 `mgu-deploy`는 필요하지 않습니다. 소스 합치기 도구가 기존 빌드·설치 도구의
앱별 시작 정보 처리를 보완하므로 이 앱만 자동 시작하고 Circuit과 기존 앱은 수동 실행합니다.
`cluster-render 0.3.10+`가 없거나 낮으면 기존 배포 검사에서 이 앱을 거부합니다.
다른 앱은 원본 배포 도구의 기존 처리 방식에 따라 설치할 수 있습니다.

## 신호와 화면 우선순위

RPM은 `actualValueRPMEngineCrankshaft × 0.25`, 모드는 `actualValueModeDrivingExperience`를 읽습니다.
스포츠 값 1·2·3과 대응하는 이름을 확인합니다. RPM은 1.8초, 모드는 3.5초 넘게 오래되면 숨깁니다.
엔진 100 rpm 미만, 유효하지 않은 값, 렌더러 연결 끊김에서도 숨깁니다.
차량 신호에는 쓰기 API를 사용하지 않으며 엔진·변속기·코딩을 제어하지 않습니다.

중앙 `map` 영역만 사용하고 전체 계기판 `panel`이나 HUD로 출력하지 않습니다.
스포츠 모드에서는 `z=100`의 콘텐츠 레이어를 독점 표시하여 낮은 우선순위의 지도 레이어보다 먼저 표시합니다. 렌더러의 overlay·alert 레이어는 위에 남습니다. `guide_hold=0`으로 순정 길안내 패널은 유지하도록 요청합니다.
`contend=1` 때문에 스포츠 모드에서는 중앙 순정 지도가 이 위젯으로 교체될 수 있습니다.
순정 경고·길안내 우선순위, 화면 복귀, 자동 시작과 절전 진입은 실차 검증이 필요합니다.

## 검사

저장소 최상위에서 `tests/cluster_redline/`의 Node 검사를 실행합니다.
렌더링·설정 검사는 먼저 이 앱의 미리보기 빌드를 하세요.
설정 검사는 `node tests/cluster_redline/profile-settings.test.js ../idrive7-apps`입니다.
계기판 클라이언트는 원본을 수정하지 않았으며 MPL-2.0 라이선스와 출처를 저장소에 포함했습니다.

## 0.4.0 수정

- 가솔린·하이브리드에서도 2000 rpm 변속 알림 설정 적용
- 설정값 도달 시 RPM 숫자를 빨간색으로 표시
- 원본 M 삼색 스타일의 LED·청색/보라색/적색 바와 하단 단수 표시
- 계기판 화면의 앱 이름과 하단 변속 문구 제거
- 단수는 실제 신호만 사용하며, 없으면 `--` 표시
- 렌더러의 현재/구형 메타데이터 경로를 확인하고 실제 버전과 지도 점유 상태 표시

[지도 우선 표시·버전 오류 확인 안내](../../docs/CLUSTER-REDLINE-0.4.0.ko.md)를 확인하세요.
순정 지도를 넘겨받으려면 렌더러의 `map_take_over_stock=1` 설정도 필요합니다.

0.4.1의 가솔린 기본값은 사용자 G20 330i 기준으로 눈금 최대 7000 rpm, 적색 구간 시작 6000 rpm입니다. 변속 알림은 별도 설정이며 적색 구간을 강제로 올리지 않습니다. 이전 수동값을 저장한 경우 설정에서 직접 변경하세요. 디젤·하이브리드 기본값은 유지합니다.
