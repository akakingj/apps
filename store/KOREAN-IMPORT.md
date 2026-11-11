# appsKOR 한국어 앱

MGU Store 소스: `jaimeen77-cmyk/apps`, 브랜치 `main`.
추가된 15개 앱은 이름에 `(한국어)`가 붙으며 한국어로 사전 빌드되어 있습니다.
기존 앱 목록은 유지합니다. Iterio 앱은 포함하지 않습니다.

원본: https://github.com/jaimeen77-cmyk/appsKOR_fork/tree/ecf2261a0154b9ff92ca7781b7e9b410023dc226
라이선스: 루트의 LICENSE.appsKOR. 패키지 내 글꼴 및 데이터 라이선스도 보존합니다.

원본에서 `python3 kit/tools/build.py --language ko --preview-only`로 빌드하고
`tools/prepare-korean-store.py`로 SDK 없는 배포 레이어를 생성했습니다.
15개 앱의 소스 일치, 체크섬, 한국어 글꼴, 설치 조립 검사를 통과했습니다.
차량에서 사용하는 SDK는 Store 설치 절차가 준비합니다. 실차 검증은 별도입니다.
