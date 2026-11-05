# Sources and licenses

- `apps/cluster_redline/cluster_render_client.js`: Robert Nisipeanu, MPL-2.0,
  unmodified from `robertnisipeanu/idrive-apps`, source blob
  `edfa4773d04f667e4179cf2f92a591ca9457fd4e`. License: `LICENSES/MPL-2.0.txt`.
- Build/runtime dependency: `cauliflowermossgrape/idrive7-apps`, MIT.
  The original runtime license is retained in `LICENSE` and the built app.
- Korean font: Noto Sans CJK KR, OFL-1.1, supplied by the Korean-enabled kit.
- `mguAppStartType: autostart`: `robertnisipeanu/mgu-store` deploy documentation,
  version 0.7.17 observed on 2026-11-05. The app requires this supported install path.
- Drive mode field and mappings: `cauliflowermossgrape/idrive7-apps`
  `apps/live_data/signals.js` at `990c105870edb21bd8f23796fcf95182530790e8`.

No BMW SDK is included in the source distribution. A private install bundle
may vendor the SDK the vehicle owner provided, as the original kit does.
