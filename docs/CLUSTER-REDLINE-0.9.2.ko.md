# 계기판 레드라인 0.9.2: 클러스터 지도 선점 경로 수정

이번 변경은 **클러스터 출력**에 집중합니다. HUD의 그림·요청 플래그·네이티브 설정은 변경하지 않습니다.

## 변경

- 기본 출력은 **지도 영역 (권장)**입니다. Robertn의 기본 지도 출력과 같은 `map` 대상에
  `content`, `contend:true`로 요청합니다. 렌더러의 기본 `map_take_over_stock=1`과 함께
  순정 지도 영역의 선점을 요청합니다.
- 지도 출력에서 `guide_hold:true`를 사용합니다. Robertn의 기본 `hide_bmw_guidance=1`과 같이,
  렌더러가 지원하는 내비 안내 상자 때문에 지도 영역이 가려지는 것을 줄이기 위한 처리입니다.
- 기존 **전면 중앙** 설정은 최초 실행 때 한 번 **지도 영역**으로 옮깁니다.
  `_clusterMapV=1`로 이력을 저장하며, 이후 사용자가 전면 중앙을 다시 고르면 그 선택을 유지합니다.
  이미 지도 영역이나 HUD를 선택한 설정, 자동 켜짐 OFF, 회전수·프리셋·크기 등은 유지합니다.
- 상세설정의 상태에 **지도 표시 영역 확보 대기**, **순정 지도 영역 해제 대기**,
  **지도 표시 영역 확보됨**, **내비 안내 상자 숨김 사용 불가**를 구분해 표시합니다.
  ‘확보됨’은 네이티브 렌더러의 `shown` 보고이며, 실차에서 게이지가 보이는 것을 직접 확인했다는 뜻은 아닙니다.
- 스포츠 모드 종료(스포츠 모드만 선택 시), 앱 OFF, 엔진 정지·신호 소실 때 레이어를 해제합니다.
  지도 출력과 연결된 안내 hold의 해제는 기존 네이티브 렌더러가 처리합니다.

설정의 두 탭과 큰 글자·버튼, 투명 게이지 그림, 실제 D/S/M 기어 판독, 20fps 요청 상한은 유지합니다.
HUD를 선택해 둔 경우 클러스터를 시험하려면 **상세설정 → 표시 레이어 → 지도 영역 (권장)**을 선택하세요.

## 지도와 Assisted Driving View의 차이

`guide_hold`는 렌더러가 허용한 CarPlay 내비 안내 상자(기본 content `0x01000310`)를 대상으로 합니다.
일반적인 Assisted Driving View 전체나 모든 경로 미리보기 화면을 끄는 기능은 아닙니다.
렌더러는 허용된 안내 슬롯·내용, 경고 화면에 양보하는 처리와 mapping guard를 그대로 사용합니다.
이 앱은 임의의 슬롯·scene ID를 요청하거나 BMW 중심 표시 영역 메뉴를 쓰지 않습니다.

Robertn 앱의 안내와 같이 **계기판 → 중심 표시 영역은 지도 보기 또는 꺼짐**을 기준으로 확인하세요.
Assist/경로 미리보기에서 가려지는 문제까지 이번 변경으로 해결됐다고 주장하지 않습니다.
그 상태는 실제 슬롯 보고·로그와 함께 별도로 확인해야 합니다.

또한 네이티브 렌더러는 순정 HMI와의 선점 경쟁에서 정해진 간격으로 재시도합니다.
앱은 대기 중에 레이어를 계속 지웠다가 만드는 방식으로 그 간격을 우회하지 않습니다.
스포츠 모드 확인 지연과 네이티브 재시도 때문에 ‘항상 즉시 전환’을 보장하지 않습니다.

## 설치 및 확인

1. MGU Store에서 `jaimeen77-cmyk/apps` 소스의 main을 새로고침합니다.
2. 사용할 언어판을 **0.9.2**로 업데이트하고 상단 실행 버전을 확인합니다.
3. 표시 레이어가 **지도 영역 (권장)**인지 확인하고, 스포츠 모드만 설정이면 스포츠 모드에서 확인합니다.
4. 상세설정 아래 상태 문구를 확인합니다. 영역 확보 후 스포츠 모드를 벗어나거나 앱 OFF 시 해제되는지도 확인합니다.

순정 지도 영역 해제 대기가 계속되면 렌더러의 실제 `map_take_over_stock` 설정과 점유 상태가 필요합니다.
안내 상자 숨김 사용 불가는 렌더러 guard가 해당 기능을 비활성화한 경우이며 앱이 guard를 초기화하지 않습니다.
[로그 수집 안내](COLLECT-CLUSTER-REDLINE.ko.md)의 읽기 전용 도구를 사용하세요.
강제 선점·guide 설정이 소유자 구성에서 꺼져 있으면 앱이 이를 자동으로 덮어쓰지 않습니다.

## 검증 범위

검사는 새 지도 요청 플래그, 최초 한 번 설정 이동과 이후 선택 보존, HUD 유지,
표시 요청/확보/guard 상태 구분, 신호·모드 변경 시 해제, 한국어·영어 설정 화면을 대상으로 합니다.
업스트림의 실제 `SlotManager`를 호스트에서 실행하여 지도 선점, 안내 hold의 생성·해제,
지원 경고 화면에 양보하는 처리와 반복 요청 방지를 검사합니다.
가상의 표시 포트를 사용하므로 실제 차량·내비·Assisted Driving View를 실행한 검사는 아닙니다.

```sh
python tests/cluster-slot-takeover.test.py /path/to/robertnisipeanu/idrive-apps
node tests/cluster_redline/cluster-takeover.test.js
node tests/cluster_redline/target-migration.test.js /path/to/idrive7-apps /path/to/idrive7-apps/dist/cluster_redline
```

공개 Store 파일에는 SDK를 넣지 않습니다. PC 설치 파일에는 본인 SDK가 들어가므로 공개 저장소에 올리지 않습니다.

English: 0.9.2 defaults cluster output to the map target with contention and guide hold, matching upstream MapFeed's default path.
Old panel choices migrate once; later panel choices, HUD and other settings are retained. Status distinguishes a pending request from native slot acquisition.
The guide hold only hides supported maneuver panels. It does not promise to cover Assisted Driving View or guarantee instant arbitration.
Native guard, warning-yield rules and retry pacing remain in force. Physical vehicle visibility/restoration still need validation.

검사 기록: 한국어·영어 빌드/설정 화면/큰 터치 영역/설정 저장과 1회 이동, HUD 유지,
11개 신호·정책·렌더러 검사, 실제 wire의 guide_hold 플래그, 네이티브 슬롯 처리 34개 검사가 통과했습니다.
실차에 연결해 지도/Assist 가림과 순정 화면 복귀를 확인하지는 못했습니다.
현재 환경의 소켓·Node 자식 tar 실행 제한으로 Store 전체 설치 검사는 완료하지 못했으며,
공개 템플릿의 체크섬·언어·스키마와 설치 패키지의 현재 소스 포함 여부를 따로 확인합니다.
