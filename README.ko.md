# iDrive 7 Jam 앱 모음

[English](README.md) | 한국어

두 앱의 소스를 `apps/` 아래에 함께 배포합니다. 설명과 설치 후 동작은 앱별로 분리했습니다.

| 앱 | 한국어 설명서 | 영문 설명서 |
|---|---|---|
| 아이드라이브 회로 — 주차 전용 퍼즐 | [회로 퍼즐 안내](apps/idrive_circuit/README.ko.md) | [iDrive Circuit](apps/idrive_circuit/README.md) |
| 계기판 레드라인 — 스포츠 모드 RPM·변속 알림 | [계기판 레드라인 안내](apps/cluster_redline/README.ko.md) | [Cluster Redline](apps/cluster_redline/README.md) |

계기판 레드라인은 **실차 검증 전 시험판**입니다. 두 앱을 묶어 설치해도 각각 별도의 앱으로 실행됩니다.

## 두 앱을 한국어로 함께 빌드

한국어 런타임과 한글 폰트를 지원하는 기존 `idrive7-apps` 프로젝트가 필요합니다.
PC 도구는 Python 3.8 이상, Node.js 18 이상을 권장합니다.

```text
작업폴더/
├─ idrive7-apps/        ← 기존 프로젝트·한국어 지원·본인 차량의 oap-sdk
└─ idrive7-apps-jam/    ← 이 저장소
```

`idrive7-apps-jam` 폴더에서 PC 미리보기 빌드:

```powershell
python tools/build-apps.py --project "../idrive7-apps" --preview-only
node tools/cluster-redline-preview.js
node ../idrive7-apps/kit/tools/preview.js dist/idrive_circuit preview/idrive_circuit frames=3
```

- 계기판 화면: `preview/cluster_redline/index.html`
- 회로 퍼즐 화면: `preview/idrive_circuit/`의 PNG
- 미리보기 빌드에는 SDK가 필요하지 않습니다. 숫자는 데모이며 차량에 연결하지 않습니다.

본인 차량에서 추출한 SDK를 `../idrive7-apps/oap-sdk/`에 준비한 뒤 설치용 빌드:

```powershell
python tools/build-apps.py --project "../idrive7-apps"
```

SDK 위치가 다르면 `--sdk "C:/경로/oap-sdk"`를 추가하세요.
이 도구는 기존 프로젝트의 파일을 변경하지 않고, 임시 빌드 환경에 한국어 추가분을 합칩니다.

완성 파일은 **`dist/idrive7-jam-ko-kit.zip`**입니다.

- 두 앱의 한국어 `.mgu`, 파일명·SHA-256을 기록한 `kit.json`
- 두 앱을 검사하고 설치하는 `install-on-mgu.sh`
- 통합 설치 설명서와 앱별 영문·한국어 설명서
- 회로 퍼즐은 **수동 실행**, 계기판 레드라인만 **자동 시작**

한 앱만 만들려면 `--apps idrive_circuit` 또는 `--apps cluster_redline`을 추가하세요.
한 앱용 ZIP은 별도 이름으로 생성되며, 다른 앱을 포함하지 않습니다.
이전 빌드 ZIP이 남아 있다면 이번 명령이 출력한 파일명을 확인하세요.

## 차량에 설치

[설치 키트 안내](docs/INSTALL-KIT.ko.md)를 따르세요.
통합 키트에는 `mgu-deploy 0.7.17+`가 필요합니다. 계기판 레드라인을 포함하면
`cluster-render 0.3.10+`와 ID7 `map:1088x480` 지원도 필요합니다.
선택한 모든 앱의 검사를 통과한 뒤 설치를 시작합니다. 설치는 앱별 순차 처리이므로,
두 번째 앱 설치가 실패해도 첫 번째 앱은 이미 설치되어 있을 수 있습니다.

## 원본 프로젝트의 apps 아래로 복사하려면

```powershell
python tools/install-overlay.py ../idrive7-apps
```

기본값은 두 앱과 필요한 도구를 함께 복사하는 것입니다. `--apps`로 한 앱만 선택할 수 있습니다.
내용이 다른 기존 파일이 있으면 복사 전에 중지합니다. 내용을 확인한 뒤 갱신하려면 `--force`를 사용하세요.
대상 한국어 카탈로그를 변경하지 않으려면 `--no-ko`를 추가합니다.

복사 후에는 대상 폴더에서 다음 명령을 사용하세요.

```powershell
python tools/build-apps.py --project .
```

원본 `kit/tools/build.py`만 사용하면 계기판 레드라인의 자동 시작 메타데이터가 빠집니다.

## 공유할 파일

**한국어 소스 공유:** 이 GitHub 저장소 링크 또는 Code → Download ZIP.
앱 소스, 번역 추가분, 검사 도구, 라이선스와 한글 미리보기 이미지를 포함합니다.

**차량용 설치 파일:** 개인 PC에서 빌드한 설치 ZIP. SDK가 포함되므로 공개 저장소에 올리지 마세요.
이 저장소에는 SDK·설치 바이너리·차량 키를 포함하지 않습니다.

계기판 클라이언트의 출처·MPL-2.0 라이선스는
[NOTICE.cluster-redline.md](NOTICE.cluster-redline.md), `LICENSES/`에 있습니다.
