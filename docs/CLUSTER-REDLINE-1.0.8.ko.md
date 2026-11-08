# 계기판 레드라인 1.0.8 — HUD 안내 아이콘 진단

1.0.7 안내 중/종료 사진을 비교하면, 안내 중에는 Android Auto가 활성인데 pointOfInterest가 maneuver_unsupported로 거부되어 앱 HUD가 내려갑니다. 안내 종료 시 HUD는 shown/us로 복귀합니다. 이 버전은 동시 표시 해결을 주장하지 않는 진단 버전입니다.

이미 수신한 안내의 종류·분류·제공 거리·아이콘 핸들(id/url/valid/variant)을 상태 JSON의 maneuver.input에 기록합니다. serviceIconHandles와 descriptionIcons를 구분합니다. 도로명/설명문/POI 식별자/목적지/좌표는 제외하며 URL 인증값은 가립니다. 배열과 문자열 길이를 제한하고 제공자 변경·안내 비활성/만료 때 진단값도 해제합니다. 추가 SOME/IP 호출, 아이콘 URL 접속, 렌더러 정책 변경은 없습니다.

설치 후 안내가 진행 중이고 HUD가 순정 안내로 전환된 상태에서 기존 상태 JSON을 한 번 수집합니다. 특히 pointOfInterest의 아이콘과 제공 거리가 필요합니다. 이 값을 임의의 직진 화살표로 치환하지 않습니다. SDK 재추출은 필요 없습니다.

UI/색상/모드/앱 제어는1.0.7과 같습니다. 기존 한국어/영어 UI 템플릿은 버전을 제외한 정의 지문이 동일하여 재사용하고, Store 빌더가 현재 소스 및1.0.8 식별자를 적용합니다.
