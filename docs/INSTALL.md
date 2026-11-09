# Installation · MGU Store / iDrive 7

[한국어](INSTALL.ko.md) · [Redline user guide](CLUSTER-REDLINE.md) · [Screenshots](../screenshots/README.md)

This repository distributes **Cluster Redline 1.2.0** and **iDrive Circuit 1.0.0**, each in Korean and English. This guide covers app installation; it does not perform head-unit flashing or coding.

## Prerequisites

- iDrive 7 with MGU Store installed and online
- **Cluster renderer (`cluster-render`) 0.4.0 or newer** for Redline
- A parked vehicle with stable power through installation

The Store's normal screen renderer and Redline's `cluster-render` are separate components. Circuit alone does not need `cluster-render`. Store resolves requirements when a registered source provides them; otherwise register the appropriate renderer source first.

For MGU Store itself, follow [its developer's installation guide](https://github.com/robertnisipeanu/mgu-store).

## Install through MGU Store

1. Open **Settings → Add source**.
2. Enter repository `jaimeen77-cmyk/apps` and branch `main`.
3. Run **Check now / Refresh**. If Offline, connect the head unit to the internet in Settings first.
4. Choose the desired language listing below and select **Install**.
5. Follow the dependency-tool prompts. Restart the head unit after installation only when instructed.
6. Open the app from the vehicle's app list.

| Listing | Installed ID | Version |
|---|---|---|
| 계기판 레드라인 (한국어) | `cluster_redline` | 1.2.0 |
| Cluster Redline (English) | `cluster_redline_en` | 1.2.0 |
| 아이드라이브 회로 (한국어) | `idrive_circuit` | 1.0.0 |
| iDrive Circuit (English) | `idrive_circuit_en` | 1.0.0 |

Select the language in the listing; no PC language flag is needed. Store assembles the SDK-free UI/runtime with current app code and prepares the vehicle SDK through its existing installation process.

## First Redline setup

1. Confirm **v1.2.0** at the top of the app.
2. In **Basic settings**, choose the vehicle preset, units and shift-alert RPM.
3. In **HUD display setting / CLUSTER display setting**, select **Redline app** for the modes you want. HUD RPM defaults to Stock.
4. Use **Start app** for current output. Enable **App auto start** if it should run at the next process launch.
5. For cluster output, use BMW **Instrument cluster → Central display area → Map view or Off**. Assist and other apps may cover it.
6. Configure NAV and start phone guidance. Supported direction, distance and description appear only when received from the vehicle.

Korean and English are separate apps. If both are installed, use **Stop app** and turn **App auto start Off** in the unused edition to avoid output contention.

## Update, stop and remove

- Refresh the same `main` source, then use **Installed → Update**. Check the visible app version afterward.
- **Stop app** stops the live worker, subscriptions and rendering connections, keeping settings available for restarting.
- **App auto start** controls the next process launch, including after an update/restart. Turn it Off if output should remain stopped.
- Remove an app from **Installed**. Check Store's removal prompt for setting-retention behavior.

On its first launch, 1.2.0 applies the new NAV defaults and separates auxiliary placement into left/right controls. An existing 50px cluster adjustment is not applied twice. Subsequent component adjustments persist. Select Stock output or Stop app if an output covers another view.

## Troubleshooting

| Symptom | First checks |
|---|---|
| Empty listing | Internet connection, repository spelling, `main`, source refresh |
| Old settings after update | Visible version, installed language/ID and another edition running |
| Missing RPM | Start app, output choices for the current mode, renderer version and live vehicle signals |
| Covered by Assist/another app | BMW central-display choice and competing app output |
| Battery/voltage/economy shows `--` | Vehicle support and freshness; missing measurements are not estimated |
| HUD returns to stock guidance | Unsupported or stale guidance yields to stock. Delivery varies with phone/map app/version. |
| install failed / interface error | Keep the exact error/version; see the [installation diagnostics](REDLINE-INSTALL-FAILED.ko.md) |

For persistent issues, collect logs using the [log guide](COLLECT-CLUSTER-REDLINE.ko.md) and include settings screenshots. Gallery images are real app renders with example data, not vehicle captures. Vehicle-specific installation, signal delivery and display recovery still need real-car verification.

## Advanced: build on a PC

Merge the source overlay into a full upstream project using the [integration guide](JAM-INTEGRATION.ko.md). Run these commands **from the merged upstream project**, with your own extracted SDK available.

```powershell
python kit/tools/make_kit.py --language ko cluster_redline
```

Korean output is `dist/mgu-custom-apps-ko.tar.gz`. Omit `--language ko` for English (`dist/mgu-custom-apps.tar.gz`). Add `idrive_circuit` to include Circuit.

```powershell
powershell.exe -ExecutionPolicy Bypass -File ".\deploy\push-to-car.ps1" check -Key "C:\keys\id_rsa" -Ip "HEAD_UNIT_IP" -Kit ".\dist\mgu-custom-apps-ko.tar.gz"
powershell.exe -ExecutionPolicy Bypass -File ".\deploy\push-to-car.ps1" install -Key "C:\keys\id_rsa" -Ip "HEAD_UNIT_IP" -Kit ".\dist\mgu-custom-apps-ko.tar.gz"
```

Replace the key/IP and install the required `cluster-render` separately. PC packages can contain the SDK and must not be publicly redistributed.
