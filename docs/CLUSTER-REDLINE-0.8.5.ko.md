# 계기판 레드라인 0.8.5: 설치 실패 수정

수동 설치 로그에서 원인이 확인됐습니다.

```text
Requested read for dataDisplayGearbox but no getter available
```

`de.bmw.infotainment.misc.MDrive.dataDisplayGearbox`는 해당 펌웨어에서 알림만 제공하는데,
0.8.4까지는 앱 manifest에서 읽기+구독(`rs`)을 요청했습니다.
차량의 SOME/IP 설정 생성기가 이 요청을 거부해 수동 설치가 중단됐습니다.
스토어에서도 같은 권한을 요청하므로 `UPDATE_FAILED`의 원인이 될 수 있습니다.

## 수정

- 요청을 **구독 전용(`s`)**으로 바꿨습니다. 쓰기나 차량 제어를 요청하지 않습니다.
- 한국어·영어 수동 설치본의 manifest를 다시 만들었습니다.
- 스토어 한국어·영어 런타임 템플릿과 체크섬도 다시 만들었습니다.
- 스토어는 해당 필드의 notifier가 없으면 선택적인 MDrive proxy를 제외합니다.
- 기본/상세 설정 탭과 실행 버전 배지, 기존 계기판 출력 처리는 유지합니다.

생성된 SOME/IP 설정에서 getter가 빠지므로 공통 신호 구독 코드도 이 필드를 읽거나 폴링하지 않습니다.
S/M 정보는 차량이 알림을 보내야 갱신됩니다. 신호가 없거나 아직 수신되지 않았다면 자동 S/M 표시가 제한될 수 있습니다.

## 설치

MGU Store에서 이 저장소의 **main → Check now → 0.8.5 업데이트**를 진행합니다.
수동 빌드는 이 소스 오버레이를 원본 프로젝트에 적용한 뒤 **반드시 다시 빌드하고 설치 키트를 다시 생성**합니다.
이미 만든 `dist/mgu-custom-apps-ko.tar.gz`에는 이전 0.8.4가 남아 있으므로 그대로 다시 전송하면 수정이 적용되지 않습니다.

```powershell
python tools/install-overlay.py ..\idrive7-apps-main --apps cluster_redline --force
cd ..\idrive7-apps-main
python kit/tools/build.py --language ko cluster_redline
python kit/tools/make_kit.py --language ko cluster_redline
```

기존에 쓰던 `deploy/push-to-car.ps1`의 check/install 명령으로 새 키트를 확인하고 설치합니다.
설치 후 앱 상단의 **v0.8.5** 또는 수동 한국어판의 **v0.8.5-ko.1**을 확인합니다.
위 키트 명령은 레드라인만 묶습니다. 기존 앱 전체를 함께 묶으려면 마지막 `cluster_redline`을 생략합니다.

## 검증

upstream의 실제 `check_signals.py`에 getter가 없고 notifier만 있는 테스트 카탈로그를 넣었습니다.
이전 `rs` 요청은 같은 `no getter` 검사에서 실패하고 수정한 `s` 요청은 통과하는지 검사합니다.
한국어·영어 `.mgu`/`.tgz` 네 파일의 실제 manifest도 확인합니다.
스토어 빌드는 선택 필드 없음 / notifier만 있음 / getter만 있고 notifier 없음을 각각 검사합니다.
이 검사는 공개 가능한 테스트 자료로 수행하며 차량 카탈로그나 SDK를 공개 저장소에 넣지 않습니다.

실차 설치 성공은 새 빌드로 재확인해야 합니다. 이전의 `UPDATE_FAILED` 요약만으로 다른 설치 오류까지 모두 해결됐다고 보장하지 않습니다.
