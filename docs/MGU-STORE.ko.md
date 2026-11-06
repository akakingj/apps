# MGU Store에 Jam 저장소 추가

이 저장소는 **Repo tree 방식**을 사용합니다. GitHub Release나 별도 catalog 주소를 만들 필요가 없습니다.

## 차량에서 등록

1. MGU Store를 열고 인터넷 연결을 확인합니다.
2. **Settings → Add source**를 선택합니다.
3. 다음 주소 또는 짧은 저장소 이름을 입력합니다.

```text
https://github.com/jaimeen77-cmyk/apps
```

```text
jaimeen77-cmyk/apps
```

4. 채널 선택 화면에서 **main** 브랜치를 선택합니다. Releases가 아닙니다.
5. **Check now**를 실행하고 Store 목록에서 다음 앱을 선택해 설치합니다.

| 앱 | Store 빌드 언어 | 시작 방식 | 필수 조건 |
|---|---|---|---|
| 아이드라이브 회로 (한국어) | 한국어 | 앱 목록에서 수동 실행 | iDrive 7, mgu-deploy 0.7.17+ |
| iDrive Circuit (English) | 영어 | 앱 목록에서 수동 실행 | 위와 동일 |
| 계기판 레드라인 (한국어) | 한국어 | 백그라운드 자동 시작 | 위 조건 + cluster-render 0.3.10+ |
| Cluster Redline (English) | 영어 | 백그라운드 자동 시작 | 위와 동일 |

## 언어 선택과 변경

Store 목록에서 원하는 언어가 붙은 앱을 선택합니다. 별도의 `--language` 입력은 필요 없습니다.
이미 이 저장소를 등록했다면 **Check now**로 영문판을 포함한 목록을 새로 받으세요.
Store 자체에 언어 선택 버튼을 추가하는 방식이 아니라 **두 언어판을 별도 항목으로 제공**합니다.
차량이나 Store의 표시 언어를 바꿔도 설치한 앱의 언어가 자동으로 바뀌지는 않습니다.

기존 한국어판 ID(`idrive_circuit`, `cluster_redline`)는 유지합니다.
영문판은 `idrive_circuit_en`, `cluster_redline_en`이며, 설정과 기록은 자동으로 옮겨지지 않습니다.
언어를 바꾸려면 사용할 언어판을 설치하고, 불필요한 기존 언어판은 제거하세요.
**계기판 레드라인은 사용할 언어판 하나만 앱 자동 켜짐을 켜세요.**
두 언어판을 모두 설치해 두면 백그라운드에서 각각 시작하므로, 사용하지 않는 쪽의 자동 표시는 먼저 OFF로 둡니다.

사용자님의 cluster-render **0.3.11**은 요구 버전을 충족합니다.
Store는 필요한 구성요소가 다른 등록 소스에서 제공되면 의존성으로 처리합니다.
cluster-render가 목록에 없으면 기본 `robertnisipeanu/idrive-apps` 소스가 등록되어 있는지도 확인하세요.

**레드라인 Install을 누르면 미설치 또는 요구 버전보다 낮은 cluster-render를 먼저 설치/업데이트한 뒤 앱을 설치합니다.**
호환 버전이 있으면 기존 렌더러를 공유합니다. 렌더러를 받을 소스가 없으면 앱 설치를 중단합니다.
[자동 선행 설치 안내와 검증](AUTO-RENDERER.ko.md)을 참고하세요.

공개 저장소이므로 이 저장소를 읽기 위한 GitHub 토큰은 필요하지 않습니다.
이 작업으로 저장소 쪽 등록 준비를 완료한 것이며, 차량의 Add source 입력은 차량/폰 화면에서 진행합니다.

## 차량 화면에서 입력하기 어려우면

Store의 **Settings → Phone access → On**을 선택하고 QR 코드를 휴대전화로 여세요.
같은 차량 네트워크에서 폰 페이지의 소스 추가 기능을 사용할 수 있습니다.
차량에 따라 메뉴 번역이나 배치가 조금 다를 수 있습니다.

## 기존 수동 설치판이 있다면

Store가 다른 소스 또는 기존 설치와 ID 충돌로 판단하면 `cluster_redline2`처럼 별도 ID를 부여할 수 있습니다.
그 경우 이전 앱이 자동으로 교체되거나 설정이 자동으로 옮겨지는 것은 아닙니다.
두 계기판 앱이 동시에 화면을 요청하지 않도록 **기존 설치판의 앱 자동 켜짐을 먼저 OFF**로 두고
Store판을 확인하세요. 새 설치판의 자동 표시가 꺼져 있으면 새 설치판에서 ON으로 바꿉니다.
정상 동작을 확인한 뒤 불필요한 설치판만 정리하면 됩니다.

## 이후 업데이트

계기판 레드라인 **0.8.7**은 Live Data 스타일의 기본/상세 설정 탭, 4개 차량 프리셋,
스포츠/전체 모드 선택, 실제 마력·토크 단위 환산을 제공합니다.
주황색 안내에 cluster-render 설치 필요를 표시하고 갱신 속도는 20fps로 고정합니다.
한국어·영어판 모두 0.8.7이며, [설치 안내·20fps 고정 업데이트](CLUSTER-REDLINE-0.8.3.ko.md)를 참고하세요.
순정 지도 교체는 표시 레이어를 지도 영역으로 고르고 중심 표시 영역은 지도 보기/꺼짐으로 설정합니다.
전면 중앙은 기존 꺼짐 안내를 유지합니다. 첫 픽셀 전송 순서를 보완했지만 초기 선점 지연·Assist 가림은 실차 확인이 필요합니다.

`main`을 따라가므로 저장소 변경은 **Check now**로 확인합니다.
Store의 **Update**를 눌러 적용하며, 저장소가 바뀌었다고 차량에 자동 설치되지는 않습니다.
버전이 같아도 브랜치의 새 커밋은 revision으로 표시될 수 있습니다.

## 세 가지 방식 중 Repo tree를 선택한 이유

- Releases: 완성된 앱 패키지를 GitHub Release에 올리는 방식
- Catalog: 완성된 패키지의 주소·크기·해시를 catalog.json에 적는 방식
- **Repo tree: 이 저장소의 mgu-repo.json을 읽고 차량에서 현재 앱 소스를 빌드하는 방식**

이 저장소에는 앱 소스와 한국어·영어 UI/런타임 템플릿만 공개합니다.
`store/runtime/*.tgz.part-*`는 **SDK와 앱 JavaScript가 없는 런타임 템플릿**으로, 차량에 직접 설치하는 파일이 아닙니다.
차량 빌드는 현재 저장소의 앱 JavaScript를 넣어 SDK 없는 패키지를 만들고,
MGU Store가 차량의 순정 donor 앱에서 SDK를 연결하여 설치합니다.
차량 빌드 자체는 Node 8로 실행하며 추가 다운로드나 Python이 필요하지 않습니다.

기존 PC의 `--language ko` / `make-car-kit` / `push-to-car` 흐름도 유지합니다.
일반 PC 빌드 결과에는 본인 SDK가 포함되므로 공개 저장소에 올리지 마세요.

## 유지보수자: Store 배포 갱신

앱 JavaScript만 수정한 경우에는 소스를 커밋하면 차량 빌드가 최신 코드를 사용합니다.
앱 버전은 app.json의 숫자형 `x.y.z`를 사용하며 Store 출력에는 `-ko.1` 접미사를 붙이지 않습니다.
Store에서 고른 언어판에 맞는 화면이 유지됩니다.
영문판의 작은 `store/apps/<id>_en/app.json`도 원본과 같은 버전이어야 하며,
아래 준비 도구가 이 버전과 아이콘을 동기화합니다. 앱 JavaScript는 복제하지 않습니다.

설정·신호 권한·화면 정의·번역을 바꾼 경우에는 기존 방식으로 두 언어의 앱을 빌드한 뒤 템플릿을 다시 준비하세요.

```sh
python tools/prepare-store.py --language ko --dist ../idrive7-apps/dist
python tools/prepare-store.py --language en --dist ../idrive7-apps/dist
```

`--dist`는 실제로 해당 언어의 `.tgz`를 빌드한 폴더로 지정합니다.
이 도구는 SDK를 제외한 `store/runtime/`과 작은 영문판 목록 파일 `store/apps/`를 갱신합니다.
변경한 템플릿·JSON 메타데이터·영문판 목록 파일·앱 소스를 함께 커밋하세요.
UI와 템플릿이 맞지 않으면 차량 빌드는 오래된 화면을 설치하지 않고 오류로 중지합니다.

## 검증 범위

MGU Store의 실제 repo 파서로 목록·버전·의존성을 검사하고,
두 앱 × 두 언어의 SDK 없는 빌드, 언어별 분리된 ID·UUID·아이콘,
Store의 실제 ID 충돌 처리와 최신 공용 소스 반영을 검사했습니다.
실제 차량의 Store에서 설치하는 과정은 아직 직접 검증하지 않았습니다.

[0.8.4: 실행 버전 확인 / Verify the running version](CLUSTER-REDLINE-0.8.4.ko.md)

[0.8.5 설치 실패 수정: 변속 프로그램 신호의 getter 요청 제거](CLUSTER-REDLINE-0.8.5.ko.md)

[0.8.7: 큰 설정 글자·터치 버튼 / Larger settings controls](CLUSTER-REDLINE-0.8.7.ko.md)
