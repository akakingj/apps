# 계기판 레드라인 0.9.1: HUD 출력 요청 수정

## 바뀐 점

0.9.0은 HUD 레이어를 `contend:false`로 요청했습니다. 업스트림 렌더러는 이 설정에서
순정 HMI가 해당 슬롯을 쓰고 있으면 슬롯이 빌 때까지 요청을 미룹니다.
0.9.1은 Robertn의 `native/waze-on-cluster/src/map_feed.cpp`와 같이 HUD도 `contend:true`로 요청합니다.
계기판 전면 중앙(panel)의 요청 방식과 그림은 바꾸지 않았습니다.

이는 **HUD 슬롯의 사용 요청**을 보내는 수정입니다. **내비 안내처럼 실제 HUD가 전환되는지,
사용자의 HUD가 이 슬롯을 보여주는지는 아직 확인하지 못했습니다.** 순정 내비 안내의 표시 영역과
렌더러의 `hud` 대상이 같다고 단정하지 않으며, 임의의 슬롯·scene ID를 시도하지 않습니다.

앱은 `hud_take_over_stock` 같은 렌더러 설정이나 BMW HUD 메뉴를 변경하지 않습니다.
업스트림 기본값 `hud_take_over_stock=0`에서는 `contend:true`여도 순정 화면을 강제로 해제하지 않습니다.
이미 소유자가 해당 설정을 1로 바꿨다면 네이티브 렌더러는 그 설정에 따라 동작합니다.
다른 앱이 사용 중인 슬롯과 잠긴 슬롯도 네이티브 렌더러의 기존 처리에 맡깁니다.

## 사용

MGU Store의 `jaimeen77-cmyk/apps` 소스를 새로고침하고 사용할 언어판을 **0.9.1**로 업데이트하세요.
상단 실행 버전을 확인한 뒤 **상세설정 → 표시 레이어 → HUD**를 선택합니다.
기본설정의 앱 자동 켜짐과 표시 모드 조건도 적용됩니다. 스포츠 모드만으로 설정했다면
컴포트 모드에서는 출력하지 않습니다. 이번 버전도 계기판/HUD 중 하나만 선택합니다.

## 계속 표시되지 않을 때 수집

로그 수집기에 HUD 설정(`hud_slot`, `hud_scene_id`, 크기, 강제 선점 설정 등)을 추가했습니다.
앱의 상태 파일에는 렌더러가 알린 실제 backend와 대상 목록도 기록합니다.
수집기는 읽기만 하며 설정 변경이나 서비스 재시작을 하지 않습니다.

기존 SSH 연결이 되는 Windows PowerShell에서 실행합니다. IP와 SSH 키 경로는 본인 값으로 바꾸세요.

```powershell
powershell -ExecutionPolicy Bypass -File tools\collect-cluster-redline.ps1 -CarIp 192.168.1.151 -IdentityFile "C:\BMW\본인경로\id_rsa" -OutputFile hud-report.txt
```

시작 전에 앱의 HUD를 선택하고, 약 55초 수집 중 컴포트 → 스포츠로 한 번 전환해 증상을 재현합니다.
생성된 `hud-report.txt`를 확인하면 아래 상태를 구분할 수 있습니다.

- `rendererTargets`에 `hud:800x480` 없음: 설치된 렌더러의 대상/크기를 확인해야 합니다.
- `targetName`이 `hud`가 아님: HUD 선택 또는 저장된 설정을 확인해야 합니다.
- `requested:false`: 앱 OFF·표시 모드·회전수 신호·렌더러 호환 여부를 `reason`으로 확인합니다.
- `waiting` / `parked`와 순정 화면 점유: 요청이 실제 표시로 이어지지 않은 상태입니다.
- `shown`: 네이티브 렌더러가 표시되었다고 보고한 상태입니다. 실제 앞유리에서 보이는지와 크기는 별도 확인합니다.

키 파일의 내용은 보내지 마세요. 수집 대상은 렌더러 상태/로그와 이 앱의 상태 파일이며 SDK나 차량 카탈로그는 포함하지 않습니다.

## 검사

업스트림의 실제 `SlotManager` 코드를 호스트에서 실행해, 순정 HMI가 HUD 슬롯을 점유한 가상 조건에서
기존 `contend:false`는 요청을 보내지 않고 `true`는 요청을 보내는지 검사합니다.
기본 강제 선점 OFF에서는 순정 화면을 해제하지 않는지, 출력 OFF 시 요청을 해제하는지도 검사합니다.
이 검사는 차량·순정 내비를 실행하는 검사가 아닙니다.

```sh
python tests/hud-slot-request.test.py /path/to/robertnisipeanu/idrive-apps
```

한국어·영어 패키지 빌드, HUD/기존 계기판/프레임 전송 순서/큰 설정 버튼/작업자/렌더러/로그 수집 회귀 검사와
위 네이티브 슬롯 요청 재현 검사가 통과했습니다. 실차 HUD 출력은 아직 확인하지 못했습니다.
화면 스키마와 번역은 0.9.0과 같아 SDK 없는 Store 템플릿을 재사용하며,
차량 Store 빌드가 현재 JavaScript와 0.9.1 버전을 넣습니다.

English: 0.9.1 requests HUD with `contend:true`, matching upstream MapFeed. It does not change native
`hud_take_over_stock` (default 0), force factory guidance off, or establish that BMW navigation uses the same HUD slot.
Host arbitration tests are separate from actual vehicle visibility. Capture the updated read-only report if HUD stays absent.
