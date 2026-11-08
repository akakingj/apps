# 계기판 레드라인1.0.9 — 별도 HUD 안내 읽기 경로

1.0.8 사진에서 공통 conclusiveDart가 SERVICE_AREA 종류의 pointOfInterest이며, 거리 문자열과 아이콘 목록이 비어 있음을 확인했습니다. 이 샘플에는 회전 안내가 없습니다. 빈 POI를 직진으로 추측하거나 임의의 거리로 바꾸지 않습니다.

원본 SDK에 정의된 GuidanceRenderedContent의 기존 registeredViews를 읽고, getViewConfig에서 targetUI=HUD인 뷰의 getViewContent.associatedEvent를 확인하는 별도 경로를 추가했습니다. HIGH_GUIDING 유형과 유효한 Ramses scene ID, 지원하는 방향/거리, 현재 안내 제공자의 최신 활성 상태를 요구합니다. 유효한 회전 안내가 있을 때 기존 HUD 레드라인과 한 이미지로 합성합니다. 공통 빈 POI의 반복 수신만으로 이 합성 화면을 내리지 않도록 보완했습니다.

새 뷰 등록·설정 변경·스트림 요청은 하지 않으며 CID/계기판 뷰의 안내는 사용하지 않습니다. 동일한 HUD 뷰가 서로 다른 화살표를 제공하면 임의 선택하지 않습니다. 안내 종료·제공자 전환·연결 소실·응답 만료·앱 중지 후 이전 데이터를 재사용하지 않습니다. API가 없거나 읽을 수 없으면 기존 순정 HUD 양보 동작을 유지합니다.

이 경로는 스키마와 모의 응답으로 검증한 시도이며 실차 데이터 제공 여부와 동시 표시 성공은 아직 확인되지 않았습니다. 상태에 hudGuidance(연결/읽기 상태, 뷰별 targetUI/contentType/kind)와 commonManeuver를 추가해 다음 결과를 구분합니다.

Store/PC 설치 모두 명명 인스턴스·registeredViews getter·두 읽기 메서드가 없으면 이 선택적 프록시를 제외합니다. 한국어·영어 빌드, 실제 worker 경합/복귀, 기존 UI·출력과 설치 필터 검사를 수행합니다. 클러스터 동작과 게이지 배치는1.0.7과 같습니다.
