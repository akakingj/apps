# iDrive 7 Jam 앱 모음

계기판 레드라인 **1.0.6**: 순정 내비 상태와 Android Auto·CarPlay 안내 활성 상태를 분리했습니다. [수정 안내](docs/CLUSTER-REDLINE-1.0.6.ko.md).

계기판 레드라인 **1.0.5**: 반복 알림에 의한 길안내 읽기 누락과 이전 응답이 최신 화살표를 덮는 오류를 수정했습니다. [수정 안내](docs/CLUSTER-REDLINE-1.0.5.ko.md).

계기판 레드라인 **1.0.4**: 이전 HUD 배치·토크/마력 크기 복원, 공통 RPM 색상과 HUD 길안내·별도 위치/크기 조절을 추가했습니다. [변경 안내](docs/CLUSTER-REDLINE-1.0.4.ko.md).

만든이：jaimeen shim

코딩나눔터(https://cafe.naver.com/codingbmw) : 서울||잼님

네이버블로그(https://blog.naver.com/jaimeen77/224465347509)

문의사항은 코딩나눔터나 네이버블로그를 통해 문의 주세요.

1.0.3은 엔진 작동 후 신선한 0rpm에서도 화면을 유지합니다. HUD 색상·배치를 클러스터와 공유하고 위아래 M을 금속 질감으로 변경했습니다. HUD 높이는 비율에 맞게 353px로 바뀌었습니다. [변경 안내](docs/CLUSTER-REDLINE-1.0.3.ko.md).

[English](README.md) | 한국어

기존 `idrive7-apps`의 **빌드·언어 선택·전체 앱 배포 방식**에 맞춘 추가 앱입니다.

계기판 레드라인 **1.0.3**: 스포츠/전체 모드별 HUD·계기판 출력 선택, 위치·가로·세로 크기 조절, 색이 변하는 HUD와 가솔린 기본 알림 5500rpm을 반영했습니다. 순정 HUD 안내를 막을 수 있던 경쟁 요청을 수정했습니다. 읽을 수 있는 최신 회전 안내를 합성하고, 안내 데이터가 없으면 순정 HUD를 보존합니다. [변경·검사 안내](docs/CLUSTER-REDLINE-1.0.0.ko.md).

| 앱 | 한국어 설명서 | 영문 설명서 |
|---|---|---|
| 아이드라이브 회로 | [회로 퍼즐](apps/idrive_circuit/README.ko.md) | [Circuit](apps/idrive_circuit/README.md) |
| 계기판 레드라인 | [계기판 레드라인](apps/cluster_redline/README.ko.md) | [Cluster Redline](apps/cluster_redline/README.md) |

## MGU Store에서 바로 설치

이 저장소는 **Repo tree 방식**을 지원합니다.
차량 Store에서 **Settings → Add source**를 열고
`jaimeen77-cmyk/apps`을 입력한 뒤 **main → Check now**를 선택하세요.
목록에서 각 앱의 **한국어 / English** 버전을 선택해 설치합니다.
별도 빌드 명령은 필요 없으며, SDK는 차량에 있는 것을 Store가 연결합니다.
기존 한국어판은 유지됩니다. 영문판은 별도 앱과 설정으로 설치됩니다.
계기판 레드라인은 사용할 언어판 하나만 스포츠 모드 자동 표시를 켜세요.

[Store 등록·기존 설치판 처리 안내](docs/MGU-STORE.ko.md)를 확인하세요.
공개 저장소라 이 소스를 읽기 위한 GitHub 토큰은 필요하지 않습니다.
`store/runtime/*.tgz.part-*`는 SDK가 없는 준비용 템플릿이며 일반 PC 설치 키트와 구분됩니다.

## 한 번 합친 뒤 기존 명령 사용

전체 원본이 포함된 통합 소스를 받았다면 아래 합치기 단계는 생략합니다.
추가 소스만 받은 경우에는 두 저장소를 나란히 두고, 이 저장소에서 한 번 실행하세요.

```powershell
python tools/install-overlay.py ../idrive7-apps
```

이후에는 **합쳐진 `idrive7-apps` 폴더**에서 실행합니다.

### 한국어 미리보기

```powershell
python kit/tools/build.py --language ko --preview-only idrive_circuit cluster_redline
node kit/tools/preview.js dist/idrive_circuit preview/idrive_circuit frames=3
node kit/tools/preview.js dist/cluster_redline preview/cluster_redline-ui frames=3
```

기본 언어는 영어입니다. `--language ko`를 생략하고 다시 빌드하면 영어로 표시합니다.
미리보기 명령에 언어만 넣는 것이 아니라 **빌드할 때 언어를 선택**합니다.
계기판 위젯 데모는 `node tools/cluster-redline-preview.js`로 생성합니다.

### 기존 앱까지 전부 한 번에 묶기

Windows:

```powershell
deploy\make-car-kit.cmd --language ko
```

macOS/Linux:

```sh
deploy/make-car-kit.sh --language ko
```

앱 이름을 생략하면 `apps/`의 **기존 앱 전부 + Circuit + Cluster Redline**을 빌드합니다.
완성 파일은 기존과 같은 **`dist/mgu-custom-apps-ko.tar.gz`**입니다.
두 앱만 만들려면 명령 끝에 `idrive_circuit cluster_redline`을 추가하세요.
영어 전체 키트는 `--language ko`를 생략합니다.

### 기존 방식으로 검사·설치

```powershell
powershell -ExecutionPolicy Bypass -File deploy\push-to-car.ps1 check -Kit dist\mgu-custom-apps-ko.tar.gz -Key <SSH키경로> -Ip <헤드유닛IP>
powershell -ExecutionPolicy Bypass -File deploy\push-to-car.ps1 install -Kit dist\mgu-custom-apps-ko.tar.gz -Key <SSH키경로> -Ip <헤드유닛IP>
```

[합치기·미리보기·설치 상세 설명](docs/JAM-INTEGRATION.ko.md)을 확인하세요.
기존 백업·검사·복구 흐름을 사용하며 별도 `mgu-deploy`는 필요하지 않습니다.

소스 합치기 도구가 기존 빌드와 설치 도구의 자동 시작 정보 처리를 보완합니다.
Circuit과 기존 앱은 수동 실행을 유지하고, Cluster Redline만 백그라운드 자동 시작합니다.
계기판 레드라인에는 `cluster-render 0.4.0+`가 필요하며, **실차 검증 전 시험판**입니다.

소스 저장소·소스 ZIP은 공개 공유할 수 있습니다.
설치 키트·`.mgu`·`.tgz`에는 본인 SDK가 포함되므로 공개 저장소에 올리지 마세요.
검사 결과는 [검사 기록](docs/VALIDATION.ko.md)에 있습니다.

[0.8.4: 실행 버전 확인 / Verify the running version](docs/CLUSTER-REDLINE-0.8.4.ko.md)

[0.8.5 설치 실패 수정: 변속 프로그램 신호의 getter 요청 제거](docs/CLUSTER-REDLINE-0.8.5.ko.md)

[0.8.7: 큰 설정 글자·터치 버튼 / Larger settings controls](docs/CLUSTER-REDLINE-0.8.7.ko.md)

## HUD·계기판 설정 (1.0.1)

상세설정에서 HUD·계기판 출력을 각각 선택하고 위치·크기를 조절합니다. 순정 HUD 안내가 우선입니다. [현재 앱 설명서](apps/cluster_redline/README.ko.md).

[1.0.1: HUD guidance, torque/power and recovery notes](docs/CLUSTER-REDLINE-1.0.1.ko.md)

[1.0.2 설치 보완: 내비 신호의 Main_Instance를 명시하고 해당 인스턴스/getter가 없으면 선택적 요청을 제외합니다. 실차 설치 확인은 필요합니다.](docs/CLUSTER-REDLINE-1.0.2.ko.md)
