# 계기판 레드라인1.0.6 — 휴대폰 길안내 상태 분리

사용자1.0.5 상태 사진에서 제공자 ANDROID_AUTO와 세 Guidance getter의 읽기 성공, native guidanceState INACTIVE, maneuver.visible=false / navigation_inactive를 확인했습니다. 순정 HUD로 바꾸면 같은 안드로이드 안내가 표시된다는 확인도 있습니다. 순정 내비 상태만으로 휴대폰 안내까지 꺼짐으로 판단하던 표시 조건을 수정했습니다.

Android Auto와 CarPlay의 별도 projectedGuidanceActive를 읽고, 현재 guidingProvider에 일치하는 최신 활성 신호로 안내 여부를 판단합니다. native guidanceState가 INACTIVE여도 해당 휴대폰 안내가 활성이고 실제로 읽은 회전·거리가 유효하면 합성합니다. 제공자 이름만으로 활성 상태를 추정하지 않습니다. projectedGuidanceMetadataAvailable도 진단에 기록하지만 이 플래그가 방향 데이터 자체는 아닙니다.

휴대폰 안내 종료·신호 만료·연결 끊김·제공자 변경 시 이전 화살표를 제거하며, 재활성화 후에는 새 방향을 받아야 합니다. 불명확하거나 읽을 수 없는 휴대폰 안내 상태에서는 순정 HUD를 보존합니다. 1.0.5의 반복 알림/오래된 읽기 경합 수정도 유지합니다.

양쪽 manager는 optional 읽기·구독 프록시입니다. 실제 카탈로그의 명명 인스턴스와 getter를 확인하고 미지원 입력은 제외합니다. notifier가 없으면 읽기만 사용하여 전체 RPM 앱 설치를 막지 않습니다. 스토어와 일반 설치기를 같은 규칙으로 검사합니다. 경로 설정·차량 메뉴·SOME/IP setter나 안내 시작/종료 메서드는 호출하지 않습니다.

상태 JSON의 projectedNavigation에 Android Auto와 CarPlay 각각의 연결·활성·메타데이터 상태와 입력 시각을 추가했습니다. 단위 검사와 실제 worker 모의 검사에서 사진의 native INACTIVE/휴대폰 ACTIVE 조합을 양쪽 제공자로 재현해 확인합니다. 실제 차량에서 추가 신호의 수신 및 회전 payload 유효성은 업데이트 후 확인이 필요합니다. 화면 배치·게이지·HUD 위치/크기 설정은 그대로 유지합니다.
