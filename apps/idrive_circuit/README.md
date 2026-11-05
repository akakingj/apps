# iDrive Circuit

English | [한국어](README.ko.md)

A parked-only circuit puzzle for BMW MGU / iDrive 7. Rotate wiring tiles until
battery power reaches every simulated vehicle module without an open connection.
Includes 30 levels, touch and iDrive-controller input, Undo, Hint, Restart,
PAR scores, stars, saved progress, four themes and software/GPU rendering paths.

The default **Parked only** guard disables puzzle actions above 3 km/h.
The puzzle is simulated; the app sends no SOME/IP or UDS vehicle-control writes.

## Controls

- GPU: turn the controller to select a tile, tilt towards a neighbouring tile,
  press to rotate clockwise, or touch a tile directly.
- Software: use **Next tile** and **Rotate** in the button bar.
- Undo, Hint, Restart, Previous level and Next level work on both paths.

## Korean preview and build

Run from the source repository root with a Korean-enabled upstream checkout beside it:

```powershell
node kit/tools/test_idrive_circuit.js
python tools/build-apps.py --project "../idrive7-apps" --apps idrive_circuit --preview-only
node ../idrive7-apps/kit/tools/preview.js dist/idrive_circuit preview/idrive_circuit frames=3
```

Without `--preview-only`, your own upstream `oap-sdk` is required and the result
is `dist/idrive_circuit-ko-kit.zip`. Circuit stays **manually started**.

```powershell
python tools/build-apps.py --project "../idrive7-apps" --apps idrive_circuit
```

Omit `--apps` to build the shared two-app kit. Follow its included `INSTALL.ko.md`.
The combined kit does not make this puzzle auto-start or display in the cluster.

To use upstream tools directly, copy the app and Korean additions with
`python tools/install-overlay.py ../idrive7-apps --apps idrive_circuit`.
Then use upstream's `--language ko` build option. English builds remain available
through the upstream builder's default language.

## Files and license

`app.json` defines the UI and read-only vehicle-speed subscription; `main.js`
contains HMI integration; `puzzle.js` implements rules; `levels.js` provides the
30 deterministic boards; `icon.png` is the app tile. The source artwork and pure
puzzle tests are in `kit/icons/idrive_circuit.svg` and `kit/tools/test_idrive_circuit.js`.
The game retains its MIT license and upstream runtime attribution.
