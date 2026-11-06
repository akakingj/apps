# 레드라인 UPDATE_FAILED 설치 로그 수집

`the app manager could not update cluster_redline 0.8.4: UPDATE_FAILED; the previous version was kept`
는 차량 앱 관리자가 교체에 실패했고 설치 도구가 이전 버전을 유지했다는 뜻입니다.
이 메시지만으로 manifest, 펌웨어 호환성, 설치 환경 중 어느 것이 원인인지 확정할 수 없습니다.
스토어가 0.8.4와 올바른 커밋을 표시한다면 소스 선택은 확인된 상태입니다.

## Windows에서 받기

1. 기존 차량 SSH 접속이 되는 네트워크에 PC를 연결합니다.
2. `tools/collect-redline-install.ps1`을 PC에 저장하고 그 폴더에서 PowerShell을 엽니다.
3. 평소 쓰는 차량 IP와 키 파일 경로로 아래 자리표시자를 바꿉니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\collect-redline-install.ps1 -CarIp "차량IP" -IdentityFile "C:\BMW\기존키경로\id_rsa"
```

실행 후 같은 폴더에 생긴 **cluster-redline-install-report-날짜-시간.txt**를 전달합니다.
기존 로그를 읽으므로 재설치나 스포츠 모드 전환을 다시 할 필요는 없습니다.
이 도구는 차량 파일을 쓰거나 앱을 삭제·설치하거나 서비스를 재시작하지 않습니다.
`ExecutionPolicy Bypass`는 이 PowerShell 프로세스에만 적용합니다.

## 이미 SSH 터미널에 연결했다면

먼저 아래 명령의 결과만 확인할 수 있습니다.

```sh
tail -n 200 /tmp/mgu-updater.log
```

## 수집 항목

- 스토어 현재/직전 로그의 마지막 300줄씩
- 앱 관리자가 남긴 `mgu-deploy-inplace.json` 결과/설치 추적(파일당 최대 64KiB)
- 설치 도구·스토어 백엔드·계기판 렌더러 버전 메타데이터
- 설치된 레드라인의 ID·버전·설정 키·이전/새 시작 화면 구분
- 실제 시작 파일의 SHA-256, 해당 앱 UID의 프로세스 PID/이름/메모리/시작 tick, 앱 로그 끝부분
- 레드라인이 사용하는 차량 인터페이스/필드의 존재 여부

차량 인터페이스 카탈로그 전체, SDK, 인증 키 파일은 수집하지 않습니다.
기본 설치 경로에 파일이 없으면 `..._NOT_FOUND`를 기록합니다.
소스의 원격 수집 스크립트를 테스트용 파일 구조에서 실행해 검증했으며,
이 환경에서는 Windows PowerShell 및 실차 SSH 실행은 확인하지 못했습니다.
