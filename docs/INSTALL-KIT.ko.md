# 한국어 앱 설치 키트

두 앱 또는 선택한 한 앱을 하나의 ZIP으로 묶는 개인 설치용 키트입니다.
SDK가 포함된 설치 파일은 공개 GitHub에 올리지 마세요.

## 준비

- 본인 차량의 MGU/iDrive 7에 이미 사용 중인 SSH/SCP 접속 방법
- MGU의 `mgu-deploy 0.7.17` 이상
- 계기판 레드라인 포함 시 `cluster-render 0.3.10` 이상과 ID7 `map:1088x480` 지원
- 계기판 레드라인은 실차 검증 전 시험판입니다. 먼저 정차 상태에서 확인하세요.

## PC에서 만들기

소스 저장소 최상위 폴더에서:

```powershell
python tools/build-apps.py --project "../idrive7-apps"
```

기존 프로젝트에는 한국어 런타임·폰트와 본인 차량의 `oap-sdk`가 있어야 합니다.
SDK가 다른 위치에 있으면 `--sdk`를 추가하세요.
기본 결과는 `dist/idrive7-jam-ko-kit.zip`입니다.
`--apps idrive_circuit`이면 `dist/idrive_circuit-ko-kit.zip`,
`--apps cluster_redline`이면 `dist/cluster_redline-ko-kit.zip`이 생성됩니다.

미리보기 전용 `--preview-only`는 설치 ZIP을 만들거나 갱신하지 않습니다.
이번 명령이 출력한 결과 파일을 사용하세요.

## 차량으로 복사

ZIP을 풀고 **폴더 안의 파일 전부**를 MGU의 `/var/opt/idrive7-jam-kit/`에 복사하세요.
예시는 다음과 같습니다. 버전은 빌드 시점에 따라 달라집니다.

```text
kit.json
idrive_circuit@1.0.0-ko.1.mgu
cluster_redline@0.2.1-ko.1.mgu
check-kit.js
cluster-redline-preflight.js
install-on-mgu.sh
INSTALL.ko.md
SHA256SUMS
docs/
```

한 앱만 선택한 키트에는 해당 앱의 `.mgu`만 들어갑니다.
설치 도구는 폴더 전체의 `.mgu`를 검색하지 않고 `kit.json`에 지정한 파일만 처리하므로,
예전 버전의 파일이 같은 폴더에 남아 있어도 선택하지 않습니다.

## 먼저 검사

**MGU 쪽 터미널**에서 실행합니다.

```sh
cd /var/opt/idrive7-jam-kit
sh install-on-mgu.sh check
```

필수 도구 버전, 계기판용 신호 getter, 각 패키지의 SHA-256과 `mgu-deploy check`를 확인합니다.
검사 명령은 앱을 설치하지 않습니다. 오류가 있으면 먼저 해결하세요.
Circuit만 선택하면 cluster-render를 요구하지 않습니다.

## 설치

검사가 모두 통과한 뒤 root로 실행합니다.

```sh
sh install-on-mgu.sh install
```

모든 선택 패키지를 먼저 검사하고, 앱별로 순서대로 설치합니다.
설치는 하나의 원자적 작업이 아니므로 나중 앱에서 실패하면 앞 앱은 설치된 상태일 수 있습니다.
설치 도구의 메시지와 재시작 안내를 따르세요. 별도의 root 자동 시작 서비스를 만들지는 않습니다.

## 설치 후 앱별 동작

- **아이드라이브 회로:** 앱 목록에서 직접 여는 퍼즐입니다. 기본 설정에서 주행 중 입력을 잠급니다.
- **계기판 레드라인:** MGU 시작 시 백그라운드에서 시작합니다. 처음에는 화면을 표시하지 않으며,
  확인된 스포츠 모드와 최신 RPM이 있을 때만 중앙 지도 영역의 표시를 요청합니다.
  설정에서 엔진 프로필을 선택하세요. 사용자님의 2019 G20 330i는 가솔린입니다.
  자동 표시를 끄면 계기판 표시를 요청하지 않습니다.

기존 같은 앱 ID의 설치는 해당 앱을 갱신합니다. 한 앱용 키트는 다른 앱을 삭제하지 않습니다.
실차 자동 시작·절전 진입·계기판 경고 우선순위·순정 화면 복귀는 별도 검증이 필요합니다.

## 앱별 설명서

소스 저장소에서는 `apps/<앱ID>/README.ko.md`를 읽으세요.
압축을 푼 설치 키트에서는 `docs/<앱ID>/README.ko.md`에 들어 있습니다.
