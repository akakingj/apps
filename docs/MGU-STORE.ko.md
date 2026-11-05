# MGU Store에 Jam 저장소 추가

이 저장소는 **Repo tree 방식**을 사용합니다. GitHub Release나 별도 catalog 주소를 만들 필요가 없습니다.

## 차량에서 등록

1. MGU Store를 열고 인터넷 연결을 확인합니다.
2. **Settings → Add source**를 선택합니다.
3. 다음 주소 또는 짧은 저장소 이름을 입력합니다.

```text
https://github.com/jaimeen77-cmyk/idrive7-apps-jam
```

```text
jaimeen77-cmyk/idrive7-apps-jam
```

4. 채널 선택 화면에서 **main** 브랜치를 선택합니다. Releases가 아닙니다.
5. **Check now**를 실행하고 Store 목록에서 다음 앱을 선택해 설치합니다.

| 앱 | Store 빌드 언어 | 시작 방식 | 필수 조건 |
|---|---|---|---|
| 아이드라이브 회로 | 한국어 | 앱 목록에서 수동 실행 | iDrive 7, mgu-deploy 0.7.17+ |
| 계기판 레드라인 | 한국어 | 백그라운드 자동 시작 | 위 조건 + cluster-render 0.3.10+ |

사용자님의 cluster-render **0.3.11**은 요구 버전을 충족합니다.
Store는 필요한 구성요소가 다른 등록 소스에서 제공되면 의존성으로 처리합니다.
cluster-render가 목록에 없으면 기본 `robertnisipeanu/idrive-apps` 소스가 등록되어 있는지도 확인하세요.

공개 저장소이므로 이 저장소를 읽기 위한 GitHub 토큰은 필요하지 않습니다.
이 작업으로 저장소 쪽 등록 준비를 완료한 것이며, 차량의 Add source 입력은 차량/폰 화면에서 진행합니다.

## 차량 화면에서 입력하기 어려우면

Store의 **Settings → Phone access → On**을 선택하고 QR 코드를 휴대전화로 여세요.
같은 차량 네트워크에서 폰 페이지의 소스 추가 기능을 사용할 수 있습니다.
차량에 따라 메뉴 번역이나 배치가 조금 다를 수 있습니다.

## 기존 수동 설치판이 있다면

Store가 다른 소스 또는 기존 설치와 ID 충돌로 판단하면 `cluster_redline2`처럼 별도 ID를 부여할 수 있습니다.
그 경우 이전 앱이 자동으로 교체되거나 설정이 자동으로 옮겨지는 것은 아닙니다.
두 계기판 앱이 동시에 화면을 요청하지 않도록 **기존 설치판의 스포츠 모드 자동 표시를 먼저 OFF**로 두고
Store판을 확인하세요. 새 설치판의 자동 표시가 꺼져 있으면 새 설치판에서 ON으로 바꿉니다.
정상 동작을 확인한 뒤 불필요한 설치판만 정리하면 됩니다.

## 이후 업데이트

`main`을 따라가므로 저장소 변경은 **Check now**로 확인합니다.
Store의 **Update**를 눌러 적용하며, 저장소가 바뀌었다고 차량에 자동 설치되지는 않습니다.
버전이 같아도 브랜치의 새 커밋은 revision으로 표시될 수 있습니다.

## 세 가지 방식 중 Repo tree를 선택한 이유

- Releases: 완성된 앱 패키지를 GitHub Release에 올리는 방식
- Catalog: 완성된 패키지의 주소·크기·해시를 catalog.json에 적는 방식
- **Repo tree: 이 저장소의 mgu-repo.json을 읽고 차량에서 현재 앱 소스를 빌드하는 방식**

이 저장소에는 앱 소스와 한국어 UI/런타임 템플릿만 공개합니다.
`store/runtime/*.tgz`는 **SDK와 앱 JavaScript가 없는 런타임 템플릿**으로, 차량에 직접 설치하는 파일이 아닙니다.
차량 빌드는 현재 저장소의 앱 JavaScript를 넣어 SDK 없는 패키지를 만들고,
MGU Store가 차량의 순정 donor 앱에서 SDK를 연결하여 설치합니다.
차량 빌드 자체는 Node 8로 실행하며 추가 다운로드나 Python이 필요하지 않습니다.

기존 PC의 `--language ko` / `make-car-kit` / `push-to-car` 흐름도 유지합니다.
일반 PC 빌드 결과에는 본인 SDK가 포함되므로 공개 저장소에 올리지 마세요.

## 유지보수자: Store 배포 갱신

앱 JavaScript만 수정한 경우에는 소스를 커밋하면 차량 빌드가 최신 코드를 사용합니다.
앱 버전은 app.json의 숫자형 `x.y.z`를 사용하며 Store 출력에는 `-ko.1` 접미사를 붙이지 않습니다.
화면은 한국어로 유지됩니다.

설정·신호 권한·화면 정의·번역을 바꾼 경우에는 기존 방식으로 한국어 앱을 빌드한 뒤 템플릿을 다시 준비하세요.

```sh
python tools/prepare-store.py --dist ../idrive7-apps/dist
```

`--dist`는 실제로 한국어 `.tgz`를 빌드한 폴더로 지정합니다.
이 도구는 SDK를 제외하고 `store/runtime/`만 갱신합니다.
변경한 템플릿·JSON 메타데이터·앱 소스를 함께 커밋하세요.
UI와 템플릿이 맞지 않으면 차량 빌드는 오래된 화면을 설치하지 않고 오류로 중지합니다.

## 검증 범위

MGU Store의 실제 repo 파서로 목록·버전·의존성을 검사하고,
두 앱의 SDK 없는 한국어 빌드, 충돌 ID의 UUID·아이콘 처리, 최신 소스 반영을 검사했습니다.
실제 차량의 Store에서 설치하는 과정은 아직 직접 검증하지 않았습니다.
