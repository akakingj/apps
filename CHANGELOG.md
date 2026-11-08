# 1.0.10

- Add HUD appearance settings with native-vector RPM previews, top-bar or filled-circle shift alerts, and torque/power Gauges / Values only / Off modes.
- Remove the upper HUD M, use a 90%-height RPM bar and 10% larger text, move metrics upward, shrink auxiliary gauges by 10% in both dimensions and raise the lower M/frame with scale-label clearance. Align gear and warning beside the upper RPM bar.
- Preserve original alert thresholds and flash timing; hide the filled circle below the original first-green threshold. Repaint appearance changes even at constant RPM.
- Add optional, query-only GuidanceEventList route reads using the enum-name form confirmed by an Android Auto diagnostic. Guard source/lifecycle changes, stale values, unreadable first events and stop/reconnect races. Real-vehicle composition and CarPlay delivery remain unverified.

# 1.0.9

- Add optional read-only discovery of existing HUD/HIGH_GUIDING views and decode their associatedEvent when the common channel supplies an empty POI.
- Keep composed HUD stable across repeated common POI notifications; bind reads to live route/provider epochs and stop on ambiguous/stale/unavailable data.
- Strict optional interface filtering for Store/desktop, no new view/stream/config writes, and HUD-view status diagnostics. Schema/mock validation only; actual vehicle data delivery and coexistence remain unconfirmed.

# 1.0.8

- Add bounded diagnostics for the received POI category, formatted distance and resource icon handles; omit road/destination text, redact URL credentials and clear diagnostics on source/lifecycle loss.
- No extra vehicle getter or resource URL requests. This is a diagnostic release, not a confirmed HUD navigation coexistence fix;1.0.7 UI remains.

# 1.0.7

- Reduce cluster side-gauge labels/values to about90% (rounded pixel fonts), increase bar height22→26px, swap the upper M/frame and shift-light positions while preserving black unlit cells.

- Enlarge cluster torque/power bars and values; share a lavender-to-red RPM ramp from2500rpm to the preset maximum (7000rpm on G20 petrol).
- Separate next-launch auto-start preference from live worker Start/Stop controls. Stop tears down subscriptions/rendering while the settings host remains available.
- Move submenu Back controls to the bottom right. Keep two display selections: Sport and All, with all valid catalog modes recognized in All.
- Uploaded1.0.6 log confirms maneuver_unsupported while phone guidance is active. Add documented bend/lane-change/arrival decoding and last-maneuver-kind diagnostics; the received variant and real-car resolution remain unconfirmed. Ease RPM colours gently from2500 to purple at3500. Host decoder/worker, lifecycle, UI, rendering/delta and bilingual package checks cover this release; physical vehicle navigation coexistence remains unconfirmed.

# 1.0.3

- Retain both output layers on fresh zero RPM after engine operation; restart updates the same image. Cold boot, invalid/stale data, OFF and mode/lifecycle release remain guarded.
- Render HUD from the cluster face with matching palette, positions, units and red shift-light pulse phase. Preserve aspect at800×353 and use actual painter geometry in the layout editor.
- Replace top/bottom line-drawn M with cached transparent tricolour/filled metallic marks.
- Add stop/start continuity, shared-face/alpha/delta and mark-render checks; retain1.0.2 named Guidance install fix. Vehicle readability and automatic stop/start still require car verification.

# 1.0.2

- Fix Guidance installation/runtime instance mismatch: declare Main_Instance instead of inherited default 1.
- Require the named catalog instance and a valid getter ID before retaining optional Guidance in Store and desktop installs; otherwise keep HUD released and allow the app to install without that proxy.
- Add named-instance/getter compatibility cases and assertions on both language artifacts. Actual vehicle generator success still needs confirmation.

# 1.0.1

- Read OEM navigation guidanceState (getter only) and release HUD during calculation/guidance, unknown/stale/provider-loss states; keep cluster independent. Omit unavailable optional getter at install time.
- Add compact torque/power HUD gauges flanking RPM with exact bounded placement, converted values/scales/peaks and independent deltas.
- Recover only verified transient image/protocol errors with three bounded backoff attempts; retain native ownership/guard policy and record recovery diagnostics.
- Provide a separately tested upstream native parked-recovery source patch. The app does not install it; reported Assist recovery still needs vehicle logs/renderer validation.

# 1.0.0

- Independent HUD/cluster Redline/Stock choices for Sport and all-mode configurations.
- Large live position/width/height controls and temporary bounded coordinate readout.
- Compact M-style HUD with right-side gear, yellow warning and red flashing shift alert.
- Move shift threshold to Basic; preset Petrol/eDrive/M 5500 rpm, retain Diesel 4200 and saved custom values.
- Fix HUD contend flag that could block newly arriving factory guidance. Require native renderer 0.4.0 and preserve its HUD yield policy. Same-slot concurrent OEM guidance/Redline composition remains unsupported.
- Host app/UI checks plus upstream 0.4.0 native slot suite (268 checks); no real-car validation.

# Changelog

## Cluster Redline 0.8.3

- Add orange Cluster renderer installation guidance in English and Korean.
- Fix the requested refresh ceiling at 20fps and remove its settings selector.
- Ignore saved legacy frame rates and retain other settings and acquisition behavior.
- Update screen layout and both SDK-free Store language templates. Actual sustained frame rate remains car-dependent.

## Cluster Redline 0.8.2

- Defer initial image visibility until queued pixels reach the ordered socket; cancel late visibility on hide/drop.
- Keep map acquisition requests alive while parked; test backpressure, delayed acquisition and cancellation.
- Tell map-target users to select Map view or Off; preserve front-center guidance.
- Include a read-only Windows SSH log collector. Native DCSM retry timing and Assist priority remain unchanged.

## Cluster Redline 0.8.1

- Match the Live Data header: title and Basic/Advanced tabs in one strip.
- Use a plain black list, thin dividers, M color strip and subtle red selection.
- Keep orange setup guidance, setting behavior and native bar fallback controls.

## Cluster Redline 0.8.0

- Add Basic/Advanced settings tabs and an orange Central display area Off instruction.
- Add a persisted output-worker switch, Sport/all-mode selection and Petrol/Diesel/eDrive/M display presets.
- Convert power/torque values, peaks and scales for PS/kW and Nm/kgf·m.
- Retire manual gearbox prefixes and RPM/torque/power scales; use received programmes and preset scales.
- Preserve legacy OFF and shift settings, shut down late subscriptions, and keep native RHMI controls.
- Document ongoing stock-map/Assisted Driving View overlay investigation; no claimed fix for scene priority.

## 1.3.1

- Cluster Redline 0.4.1: G20 330i petrol scale maximum 7000 rpm and red zone from 6000 rpm.
- Keep the shift alert independent of the red-zone start, and color filled red-zone segments red.
- Preserve saved custom settings and the diesel/hybrid presets.

## 1.3.0

- Cluster Redline 0.4.0 fixes the ignored 2000 rpm setting for petrol/hybrid profiles.
- Turn RPM digits red at the configured threshold; match M Tricolour styling and show real gear.
- Remove the cluster title and shift footer.
- Give Sport content precedence over lower map layers and report target holder/state.
- Discover renderer metadata in both deployed layouts and distinguish 0.3.1 from 0.3.10.
- Include a read-only-by-default renderer diagnostic with explicit reversible takeover setup in normal kits.

## 1.2.0

- Use the normal upstream build, --language ko, make-car-kit and push-to-car workflow.
- Make Cluster Redline 0.3.0 English by default, with Korean in the shared catalog.
- Preserve explicit autostart metadata through the standard builder and installer.
- Check cluster-render requirements before the cluster app is installed.
- Retain the normal backup/restore flow and manual startup for existing apps.
- Test the standard installer functions on a temporary OAP tree and build all 17 apps together.
- Retire the separate private-ZIP installer path.

## 1.1.0

- Place Cluster Redline 0.2.1 directly in apps/cluster_redline alongside Circuit.
- Separate English and Korean guides for both apps; make the root README an app index.
- Translate Cluster Redline renderer choices, mode and layer status labels.
- Build both Korean apps into one private kit, or select a single app.
- Preserve Circuit's manual startup and Cluster Redline's autostart metadata.
- Verify every selected artifact before sequential installation; ignore stray old bundles.
- Add combined-kit and isolated single-app release tests. No real-vehicle validation yet.

## 1.0.0

- Initial public source release.
- 30 deterministic puzzle levels.
- Touch, iDrive controller and software-renderer fallback controls.
- Undo, hints, PAR, star scores and persistent progress.
- Parked-only input guard and Korean localization overlay.

