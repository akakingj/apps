# 표준 빌드·배포 검사 기록

대상: Circuit 1.0.0, Cluster Redline 0.4.0. 원본 프로젝트의 표준 도구를 사용했습니다.

## 통과한 검사

- 원본 `build.py` 기본 영어 빌드와 `--language ko` 한국어 빌드
- 실제 영어·한국어 계기판 데모와 한국어 앱 상태 화면 렌더링
- 기존 `test_ko.py`: 전체 17개 앱의 한국어 메뉴·폰트·레이아웃과 신호·설정 값 불변성
- Circuit: 30개 레벨 해결 가능성·회전·되돌리기·점수·진행 저장
- Cluster Redline: 스포츠 판정·신호 만료·프로필 전환·엔진 정지·재시동·설정 저장
- 임시 로컬 소켓의 렌더러 프로토콜 검사
- 표준 `make_kit.py --language ko`: 기존 앱과 새 두 앱, 총 17개를 한 키트로 빌드
- 키트의 원래 배포 스크립트·KIT_SUMS·패키지 언어·폰트·시작 방식·라이선스 확인
- 실제 표준 설치 함수의 임시 OAP 폴더 검사: 기본 수동 실행, 자동 시작 레지스트리,
  custom_apps 목록 저장, 기존 수동 항목의 자동 시작 갱신
- 필수 cluster-render 버전이 없거나 낮을 때 해당 앱 거부; 일반 앱에는 요구하지 않음
- 원본 파일 구조가 다르면 소스 복사 전에 중지, 선택 앱 복사, 재실행, 충돌·--no-ko 처리
- 차량용 JavaScript의 Node 8.17 호환 검사와 셸 문법 검사

설치 함수 검사는 PC의 임시 폴더에서 파일 처리와 레지스트리 생성만 검사합니다.
차량 서비스·프로세스·소유권·ACL과 통신하지 않습니다.

## 재실행

소스를 합친 전체 프로젝트 최상위 폴더 기준:

```sh
python kit/tools/test_ko.py
node kit/tools/test_idrive_circuit.js
python tests/standard-installer.test.py .
node tests/metadata.test.js .
python tests/standard-kit.test.py .
```

`standard-kit.test.py` 실행 전에는 본인 SDK로 전체 한국어 키트를 빌드해야 합니다.
추가 소스 저장소에서 설치 함수·키트 검사를 실행할 때는 `.` 대신 합쳐진 프로젝트 경로를 사용하세요.
소스 복사 검사는 `python tests/overlay.test.py 원본프로젝트경로`입니다.

Cluster Redline의 나머지 검사는 `tests/cluster_redline/`의 Node 검사입니다.
호스트 검사는 Node 18 이상을 사용합니다. 렌더링·설정 검사는 한국어 빌드 후 실행하세요.

## 실차에서는 미검증

자동 시작, 절전 진입·배터리 소모, 실제 신호 수신, 계기판 표시와 순정 화면 복귀,
경고·길안내 우선순위는 실제 차량에서 아직 확인하지 않았습니다.

## 0.4.0 회귀 검사

2000 rpm 설정의 세 엔진 프로필 적용, 실제 설정 UI 저장, worker의 실시간 설정 변경,
알림 시 실제 RPM 픽셀의 적색 변화, 제목·변속 문구 제거, 단수 enum 두 종류와 provider 끊김,
지도 레이어의 contend/exclusive/z 및 스포츠 해제 시 drop을 검사합니다.
렌더러의 두 메타데이터 경로·구버전 거부, 읽기 전용 진단, 설정 백업·복원과 사용자 변경 보호도 검사합니다.
지도 가림 문제가 실차에서 해결되었는지는 아직 재검증하지 않았습니다.
