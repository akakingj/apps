# 레드라인 설치 시 렌더러 자동 선행 설치

MGU Store에서 한국어 또는 영어 레드라인의 **Install**을 누르면 필요한 렌더러를 먼저 처리합니다.
앱이 렌더러를 다운로드하거나 설치 명령을 실행하는 것이 아니라,
Store의 설치 관리자가 등록된 소스에서 의존성을 찾아 순서대로 설치합니다.

| 렌더러 상태 | Store 설치 순서 |
|---|---|
| 미설치 | cluster-render → 레드라인 |
| 0.3.10보다 낮은 버전 | cluster-render 업데이트 → 레드라인 |
| 0.3.10 이상 설치됨 | 기존 렌더러 공유 → 레드라인만 설치 |
| 설치 가능한 렌더러를 등록 소스에서 찾지 못함 | 설치 계획을 중단하고 필요한 버전을 안내 |
| 해당 차량 세대와 맞지 않는 렌더러만 있음 | 설치 계획 중단 |

호환 버전이 있으면 최신 렌더러로 무조건 올리지 않습니다.
예를 들어 0.3.11은 요구 조건을 충족하므로 그대로 사용합니다.
업데이트가 필요한 기존 렌더러는 Store가 해당 렌더러의 원래 소스에서 찾습니다.

## 렌더러를 받을 소스

기본 소스의 `robertnisipeanu/idrive-apps`가 필요합니다. 현재 Store의 기본 소스에 포함돼 있지만,
사용자가 삭제한 기본 소스는 자동으로 다시 추가하지 않습니다.

렌더러를 찾을 수 없다는 오류가 나오면 Store의 Sources에 아래 저장소가 있는지 확인하고,
없으면 추가한 뒤 **Releases → Check now**를 선택합니다.

```text
robertnisipeanu/idrive-apps
```

레드라인 자체는 기존 Jam 저장소의 **main** 브랜치에서 설치합니다.
등록된 소스 중 사용 가능한 렌더러가 있어야 자동 선행 설치가 가능합니다.

## 배포 설정

`mgu-repo.json`의 `cluster_redline`과 `cluster_redline_en` 양쪽 모두 다음을 선언합니다.

```json
"requires": {
  "mgu-deploy": "0.7.17",
  "cluster-render": "0.3.10"
}
```

Store가 렌더러를 먼저 설치하고 요구 버전 충족을 확인한 다음 앱 설치를 진행합니다.
같은 설치 대기열에서 두 언어판이 같은 렌더러를 요구해도 렌더러는 한 번만 대기열에 들어갑니다.
실제로 사용할 레드라인 언어판은 하나만 자동 표시를 켜세요.

이 자동 처리는 **MGU Store 소스 설치**에 해당합니다. PC에서 `.mgu`를 직접 배포하는 기존 방식은
기존 안내대로 렌더러가 먼저 준비돼 있어야 합니다.

## 검증

실제 upstream Store의 `requirementMet`, `findRequirement`, `installPlan`, `request`,
`enqueue` 등을 그대로 실행해 두 언어의 설치 대기열을 검사했습니다.
소스 파싱도 Store의 `repoCatalog`를 사용합니다. 차량이나 설치 데몬은 실행하지 않습니다.

검사한 Store 소스: `native/mgu-updater/js/updater.js` blob
`0d97aff7d2a119271ce44e2ac08c1762fa2284fa`.

```sh
MGU_STORE_UPDATER_JS=/path/to/mgu-store/native/mgu-updater/js node tests/renderer-dependencies.test.js
```

확인한 항목: 미설치, 구버전, 호환 버전 재사용, 다른 소스의 렌더러 사용,
배포 도구 선행 업데이트, 중복 설치 방지, 누락 소스와 세대/버전 불일치 중단.
실차에서 직접 설치한 검증은 별도입니다.
