# iDrive Circuit for BMW iDrive 7

English | [한국어](reame_kor.md)

iDrive Circuit is a parked-only wiring puzzle for the BMW MGU / iDrive 7 custom-app environment. Rotate the circuit tiles until battery power reaches every vehicle module without leaving an open connection.

![iDrive Circuit Korean preview](screenshots/preview-ko.png)

## Features

- 30 levels, including guided tutorial boards
- Touchscreen and iDrive controller input
- Live visualization of powered paths, open connections, and completion state
- Undo, Hint, Restart, par scores, and one-to-three-star ratings
- Persistent puzzle progress, best scores, and level unlocks
- Four color themes and support for the 60 fps GPU renderer
- Software-rendering fallback when the GPU renderer is unavailable
- **Parked only** enabled by default; puzzle input locks above 3 km/h
- Optional Korean menus and game-status text

All circuits in the game are simulated. The app does not send vehicle-control writes over SOME/IP or UDS.

## Important notice

This repository is a source overlay for [cauliflowermossgrape/idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps). It cannot be installed on a vehicle by itself.

- This is an unofficial hobby project and is not affiliated with BMW.
- Root-shell access to the MGU head unit is required. This repository does not provide a root-access method.
- BMW's OAP SDK is copyrighted owner-supplied software and is not included.
- Vehicle keys, VINs, and provisioning files are not included.
- Always run the upstream `check` command before installation.
- Do not operate the game while driving.

## Requirements

1. A BMW with an MGU / iDrive 7 head unit
2. Root-shell access to the head unit
3. A Windows, macOS, or Linux computer
4. Python 3.6 or newer, Node.js 14 or newer, and OpenSSH
5. `oap-sdk/` extracted from your own head unit

Follow the [upstream requirements and SDK extraction guide](https://github.com/cauliflowermossgrape/idrive7-apps#2-what-you-need) for the vehicle-specific preparation.

## 1. Add the game to idrive7-apps

Clone the upstream project and this repository side by side:

```powershell
git clone https://github.com/cauliflowermossgrape/idrive7-apps.git
git clone https://github.com/jaimeen77-cmyk/idrive7-apps-jam.git
```

### Manual copy

For an English build, the minimum required step is to copy this directory:

```text
idrive7-apps-jam/apps/idrive_circuit
→
idrive7-apps/apps/idrive_circuit
```

Windows PowerShell:

```powershell
Copy-Item -Recurse .\idrive7-apps-jam\apps\idrive_circuit .\idrive7-apps\apps\
```

macOS/Linux:

```bash
cp -R idrive7-apps-jam/apps/idrive_circuit idrive7-apps/apps/
```

The following development files are optional:

```text
kit/icons/idrive_circuit.svg
kit/tools/test_idrive_circuit.js
```

### Automated overlay installer

The helper script copies the game, optional development files, and Korean translations into an upstream checkout:

```powershell
cd idrive7-apps-jam
python tools\install-overlay.py ..\idrive7-apps
```

macOS/Linux:

```bash
cd idrive7-apps-jam
python3 tools/install-overlay.py ../idrive7-apps
```

If `apps/idrive_circuit` already exists, inspect it before using `--force`. Add `--no-ko` if Korean translations should not be merged.

For a manual Korean setup, merge `localization/ko-additions.tsv` into `idrive7-apps/kit/runtime/locales/ko.tsv`, then run:

```powershell
python kit\tools\sync_locales.py ko
```

## 2. Prepare the BMW OAP SDK

Follow the upstream guide to copy the `x_call` app from your own head unit and extract the SDK. The upstream checkout must contain:

```text
idrive7-apps/
└─ oap-sdk/
   ├─ index.js
   ├─ package.json
   └─ source/
```

Do not upload `oap-sdk/` or an SDK-containing `.mgu` package to GitHub.

## 3. Test on the computer

Run these commands from the upstream `idrive7-apps` directory:

```powershell
node kit\tools\test_idrive_circuit.js
python kit\tools\build.py --preview-only idrive_circuit
node kit\tools\preview.js dist\idrive_circuit preview\idrive_circuit frames=3
```

For a Korean offline preview:

```powershell
python kit\tools\build.py --language ko --preview-only idrive_circuit
```

Live browser emulator:

```powershell
node kit\tools\emu.js idrive_circuit
```

Open `http://localhost:8077`. Mouse input acts as touch, the mouse wheel or `[`/`]` turns the controller, `Enter` presses it, and the arrow keys tilt it.

## 4. Build the vehicle kit

### Windows

English:

```powershell
deploy\make-car-kit.cmd idrive_circuit
```

Output:

```text
dist\mgu-custom-apps.tar.gz
```

Korean:

```powershell
deploy\make-car-kit.cmd --language ko idrive_circuit
```

Output:

```text
dist\mgu-custom-apps-ko.tar.gz
```

### macOS/Linux/WSL

```bash
deploy/make-car-kit.sh idrive_circuit
deploy/make-car-kit.sh --language ko idrive_circuit
```

## 5. Check compatibility and install

### Windows PowerShell — English kit

```powershell
powershell -ExecutionPolicy Bypass -File deploy\push-to-car.ps1 check `
  -Key <SSH-key-path> -Ip <head-unit-IP>

powershell -ExecutionPolicy Bypass -File deploy\push-to-car.ps1 install `
  -Key <SSH-key-path> -Ip <head-unit-IP>
```

### Windows PowerShell — Korean kit

```powershell
powershell -ExecutionPolicy Bypass -File deploy\push-to-car.ps1 check `
  -Kit dist\mgu-custom-apps-ko.tar.gz `
  -Key <SSH-key-path> -Ip <head-unit-IP>

powershell -ExecutionPolicy Bypass -File deploy\push-to-car.ps1 install `
  -Kit dist\mgu-custom-apps-ko.tar.gz `
  -Key <SSH-key-path> -Ip <head-unit-IP>
```

### macOS/Linux/WSL

English kit:

```bash
HU=root@<head-unit-IP> KEY=<SSH-key-path> deploy/push-to-car.sh check
HU=root@<head-unit-IP> KEY=<SSH-key-path> deploy/push-to-car.sh install
```

Korean kit:

```bash
KIT=dist/mgu-custom-apps-ko HU=root@<head-unit-IP> KEY=<SSH-key-path> deploy/push-to-car.sh check
KIT=dist/mgu-custom-apps-ko HU=root@<head-unit-IP> KEY=<SSH-key-path> deploy/push-to-car.sh install
```

If `check` reports an error, do not install until the cause has been resolved. The **iDrive Circuit** tile should appear in Apps approximately one or two minutes after installation.

## Controls

### Full-screen GPU renderer

- Turn controller: move through the tiles
- Tilt controller: move to the nearest tile in that direction
- Press controller: rotate the selected tile 90 degrees clockwise
- Touch a tile: rotate it directly

### Standard/software renderer

- **Next tile**: select the next tile
- **Rotate**: rotate the selected tile
- **Undo**, **Hint**, **Restart**, **Previous level**, and **Next level** work on both rendering paths

## Restore the stock system

The upstream `restore` command removes all custom apps and their associated hooks, then restores the original backup.

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\push-to-car.ps1 restore `
  -Key <SSH-key-path> -Ip <head-unit-IP>
```

macOS/Linux/WSL:

```bash
HU=root@<head-unit-IP> KEY=<SSH-key-path> deploy/push-to-car.sh restore
```

## Repository layout

```text
apps/idrive_circuit/            Game source and app icon
kit/icons/idrive_circuit.svg    Source artwork for the app tile
kit/tools/test_idrive_circuit.js
localization/ko-additions.tsv   Korean translation additions
tools/install-overlay.py        Safe overlay installer
screenshots/                    Offline renderer output
```

## Validation

- Connectivity, open-connection, and solution invariants for all 30 levels
- Every level verified solvable using only the Hint action
- Rotation, Undo, persistence, par, and star-score tests
- English and Korean offline-preview builds
- Upstream fixed-language layout tests for Korean and Chinese

## License and attribution

The game source is released under the MIT License. Its runtime and installation workflow are based on [cauliflowermossgrape/idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps). The upstream renderer and other components may have separate licenses; consult the upstream licensing documentation as well.


