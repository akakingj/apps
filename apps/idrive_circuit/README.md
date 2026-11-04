# iDrive Circuit

A parked-only wiring puzzle for the BMW MGU / iDrive 7 custom-app kit.

Rotate the circuit tiles until power reaches every vehicle module with no open connection. The app includes 30 deterministic levels, undo, one-step hints, par scores, one-to-three-star results, automatic progress saving, and a software-renderer fallback.

## Controls

- Full-screen GPU renderer: turn the iDrive controller to move through tiles, push it towards a neighbouring tile, and press to rotate clockwise. A touchscreen tap rotates a tile directly.
- Standard/software renderer: use **Next tile** and **Rotate** in the HMI button bar.
- **Undo**, **Hint**, **Restart**, **Previous level** and **Next level** are available on both paths.
- With **Parked only** enabled (the default), every puzzle action is disabled above 3 km/h.

The game simulates its own circuit. It does not send vehicle, SOME/IP or UDS write commands.

## Files

- `app.json` — manifest, vehicle-speed permission, screens and settings.
- `main.js` — HMI integration, rendering, input, progress and parked-only guard.
- `puzzle.js` — pure rotation, connectivity, power, undo, hints and scoring rules.
- `levels.js` — three tutorial boards plus 27 deterministic generated boards.
- `icon.png` — 140 × 140 app tile; source artwork is `kit/icons/idrive_circuit.svg`.

## Develop and test

```powershell
node kit\tools\test_idrive_circuit.js
python kit\tools\build.py --preview-only idrive_circuit
node kit\tools\preview.js dist\idrive_circuit preview\idrive_circuit frames=3
```

For a Korean offline preview:

```powershell
python kit\tools\build.py --language ko --preview-only idrive_circuit
```

An installable `.mgu` requires `oap-sdk/` extracted from the owner's head unit, as described in the repository's main README. The offline preview does not require that SDK.

