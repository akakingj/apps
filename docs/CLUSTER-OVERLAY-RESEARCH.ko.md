# 순정 지도 / Assisted Driving View 위 표시 조사

2026-11-06에 공개 upstream main의 설명서와 DCSM 구현을 확인했습니다.
현재 앱은 투명한 전면 중앙 panel 또는 기존 map 영역을 사용하며,
이번 0.8.0은 새로운 전면 슬롯이나 순정 메뉴 변경 기능을 추가하지 않습니다.

## 확인한 내용

- [휴대폰 지도 앱](https://github.com/robertnisipeanu/idrive-apps/tree/main/apps/robertn_waze_cluster)은
  CarPlay / Android Auto 지도 영상을 받아 순정 지도와 같은 map 슬롯에 표시합니다.
  설명서는 중심 표시 영역을 Map view 또는 Off로 수동 선택하라고 안내하고,
  Route preview / Assisted Driving View에서는 순정 콘텐츠가 중앙을 차지한다고 명시합니다.
- [cluster-render 설명서](https://github.com/robertnisipeanu/idrive-apps/tree/main/native/cluster-render)는
  map `0x100`과 panel `0x203`을 구분합니다. panel은 순정 게이지 위, 경고등 아래로 설명되지만,
  이 차량의 모든 Assist 화면 위에서도 보인다는 검증 자료는 확인하지 못했습니다.
- [take_over 구현](https://github.com/robertnisipeanu/idrive-apps/blob/main/native/cluster-render/src/dcsm2_port.cpp)은
  순정 HMI의 콘텐츠를 `unmap_as`로 해제합니다. 중심 표시 영역 설정을 Off로 저장하는 호출이 아닙니다.
- map의 선점은 HMI가 약 100ms 안에 순정 지도를 다시 요청하는 경쟁이 있습니다.
  upstream 기록에도 선점 실패와 재시도가 있습니다. 반복 선점은 깜빡임의 원인 후보이며,
  z 숫자 증가는 같은 렌더러 장면 내부의 순서만 바꿉니다.
- panel의 기본 scene ID는 순정 음성 대화상자와도 겹칩니다.
  현재 앱은 stock panel을 강제 해제하지 않습니다.

## 다음에 구분할 사항

순정 중심 표시 Off / 지도 / Assist 각각에서 같은 앱의 전면 중앙 표시를 비교하고,
DCSM 슬롯 표의 표시 중 콘텐츠와 앱 target 상태를 같은 시점에 비교해야 합니다.
그러면 (1) 같은 슬롯을 순정 콘텐츠가 다시 차지하는지, (2) 다른 순정 장면이 위에 있는지,
(3) 전송·구독이 끊겨 앱 자체가 사라지는지를 나눌 수 있습니다.

차량에서는 아래 파일이 있는 경우 **읽기만** 해서 상태를 확인할 수 있습니다.
경로는 upstream 기본값이며 설치 버전/설정에 따라 없을 수 있습니다.

```sh
cat /run/cluster-render/status.txt
tail -n 160 /var/opt/cluster-render/log/cluster-render.log
```

새로운 슬롯·content class 조합이나 native compositor 경로가 실제로 지원되는지 확인되기 전에는
자동 복구를 약속하거나 임의의 슬롯/경고 콘텐츠를 해제하지 않습니다.
0.8.2의 지도 영역 모드는 중심 표시 영역 Map view/Off를 안내합니다. 전면 중앙은 Off 안내를 유지합니다.
첫 프레임 전송 순서 보완과 범위는 [0.8.2 안내](CLUSTER-REDLINE-0.8.2.ko.md)를 참고하세요.
