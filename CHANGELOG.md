# Changelog

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

