# 검사 기록

대상: 회로 퍼즐 1.0.0 한국어 빌드, 계기판 레드라인 0.2.1 한국어 빌드.

## 통과한 검사

- Circuit: 30개 레벨의 연결 규칙·해결 가능성·되돌리기·점수·진행 저장
- Cluster Redline: 표시 조건·오래된 신호 해제·프로필 전환·하이브리드 엔진 정지·재시동
- 실제 설정 UI: 기존 가솔린 수동값 유지, 프로필 전환 시 초기화와 저장
- 로컬 소켓: 렌더러 핸드셰이크, 부팅 시 레이어 없음, 픽셀 전송 후 표시, 해제·끊김 처리
- 실제 한글 렌더링: 계기판 화면·앱 상태 화면과 설정 글리프 확인
- 두 앱의 실제 SDK 포함 빌드: 한국어 카탈로그·폰트·소스·앱 ID·시작 방식 확인
- 통합 ZIP과 단독 앱 ZIP: 지정 앱만 포함, 파일 해시·설명서·압축 무결성 확인
- 공유 폴더에 예전 패키지가 있어도 manifest 지정 파일만 선택
- 잘못된 앱 ID·중복 앱·경로·시작 방식·변조 파일 거부
- Circuit 단독 키트에서 cluster-render 불필요
- 소스 복사: 선택 앱만 복사, 한국어 준비 상태·파일 충돌을 복사 전에 확인, --no-ko 유지
- Node 8.17에서 프로필 검사와 새 차량용 JavaScript 문법 검사
- 셸 문법과 문서의 로컬 링크 검사

기존 원본 프로젝트는 빌드 과정에서 변경하지 않았습니다.

## 재실행

아래 예시는 저장소 최상위 폴더 기준입니다.

```sh
python tools/build-apps.py --project ../idrive7-apps
node kit/tools/test_idrive_circuit.js
node tests/distribution.test.js
python tests/overlay.test.py
python tests/release.test.py ../idrive7-apps
```

`release.test.py`는 SDK를 포함하는 로컬 빌드 결과를 검사합니다.
인자를 주면 같은 출력 폴더에서 단독 앱을 차례로 빌드해 앱 선택을 추가 검사합니다.
차량이나 공개 저장소에 설치 패키지를 전송하지 않습니다.

```sh
node tests/cluster_redline/policy.test.js
node tests/cluster_redline/profiles.test.js
node tests/cluster_redline/worker.test.js
node tests/cluster_redline/preflight.test.js
node tests/cluster_redline/render.test.js
node tests/cluster_redline/profile-settings.test.js ../idrive7-apps
node tests/cluster_redline/protocol.test.js
```

호스트용 검사는 Node 18 이상을 사용하세요. 프로토콜 검사는 임시 로컬 소켓만 사용합니다.

## 미검증

**실차에서는 아직 시험하지 않았습니다.**
자동 시작, 차량 절전 진입·배터리 소모, 실제 신호 수신과 계기판 출력,
경고·길안내 우선순위와 순정 화면 복귀는 차량·펌웨어별 확인이 필요합니다.
