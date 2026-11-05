# 아이드라이브 회로

[English](README.md) | 한국어

BMW MGU / iDrive 7용 주차 전용 회로 퍼즐입니다. 타일을 회전해 배터리의 전력을
모든 차량 모듈에 연결하세요. 회로와 전력은 모두 게임 속 시뮬레이션입니다.

![한국어 퍼즐 화면](../../screenshots/idrive_circuit/preview-ko.png)

## 기능과 조작

- 튜토리얼 포함 30개 레벨, 되돌리기·힌트·다시 시작, 최소 회전수·별 평가, 진행 저장
- 터치와 iDrive 컨트롤러, 네 가지 색상 테마, GPU와 소프트웨어 렌더링
- GPU: 노브 회전으로 선택, 방향 밀기로 이동, 누르거나 터치해서 타일 회전
- 소프트웨어: 버튼 메뉴의 **다음 타일**, **회전** 사용
- 기본 **주차 중에만 실행** 설정에서 3 km/h를 넘으면 퍼즐 입력 잠금

차량 속도 신호를 읽지만 차량 제어 값을 쓰지 않습니다. 운전 중 퍼즐을 조작하지 마세요.

## PC 미리보기

한국어 지원이 있는 원본 프로젝트를 옆에 두고, 이 저장소 최상위 폴더에서 실행합니다.

```powershell
node kit/tools/test_idrive_circuit.js
python tools/build-apps.py --project "../idrive7-apps" --apps idrive_circuit --preview-only
node ../idrive7-apps/kit/tools/preview.js dist/idrive_circuit preview/idrive_circuit frames=3
```

PNG는 `preview/idrive_circuit/`에 생성됩니다. SDK 없이 확인할 수 있습니다.

## 이 앱만 설치용으로 빌드

```powershell
python tools/build-apps.py --project "../idrive7-apps" --apps idrive_circuit
```

본인 SDK가 필요하며 결과는 `dist/idrive_circuit-ko-kit.zip`입니다.
압축 안의 `INSTALL.ko.md`를 따라 검사·설치하세요.
설치 후 앱 목록에서 직접 실행합니다. 이 게임은 자동 시작하지 않습니다.

두 앱을 한 키트에 넣으려면 `--apps idrive_circuit`를 생략합니다.
함께 배포해도 게임이 계기판에 표시되거나 자동 시작하도록 바뀌지는 않습니다.
이 앱만 설치할 때는 `cluster-render`가 필요하지 않습니다.

## 원본에 소스만 복사

```powershell
python tools/install-overlay.py ../idrive7-apps --apps idrive_circuit
```

이후 원본 프로젝트의 도구로 빌드할 때도 한국어는 `--language ko`로 선택합니다.
소스와 런타임은 기존 MIT 라이선스와 출처 표시를 유지합니다.
