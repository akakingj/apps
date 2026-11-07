"""Exercise real cluster-render slot recovery with simulated display callbacks.

Pass an existing robertnisipeanu/idrive-apps checkout. No downloads or vehicle
commands run. A simulated stock scene represents ownership; it does not assert
which real scene/slot Assisted Driving View uses on a particular car.
"""
import json
from pathlib import Path
import subprocess
import shutil
import sys
import tempfile

root = Path(sys.argv[1]).resolve() / 'native/cluster-render'
assert (root / 'test/slots_test.cpp').is_file()
source = r'''
#define main upstream_slots_test_main
#include UPSTREAM_TEST
#undef main
int main() {
    Rig r;
    r.m.want(0, true, true);
    r.m.tick(r.now);
    r.rows(kMapSlot, 2, {{kMapScene, 1}});
    r.m.on_shown(kMapScene, r.now);
    joined();
    r.rows(kMapSlot, 2, {{kStockMap, 1}});
    r.m.on_lost(kMapScene, "unmapped for stock content", r.now);
    ok("stock takes cluster: native target waits after its lost callback", r.state(0) == TargetState::Waiting);
    r.run(500);
    joined();
    r.slot(kMapSlot, 1, 0);
    r.run(1000);
    ok("stock leaves cluster: native map requests again without app-layer churn", joined().find("request map") != std::string::npos);
    r.rows(kMapSlot, 2, {{kMapScene, 1}});
    r.m.on_shown(kMapScene, r.now);
    ok("display maps the returning scene: cluster is shown again", r.state(0) == TargetState::Shown);
    joined();

    Rig p;
    p.m.want(0, true, true); p.m.tick(p.now); p.m.on_shown(kMapScene, p.now);
    p.rows(kMapSlot, 2, {{kStockMap, 1}, {kMapScene, 3}});
    p.m.on_parked(kMapScene, p.now);
    ok("stock parks cluster: mapped image remains parked, not torn down", p.state(0) == TargetState::Parked);
    joined();
    p.rows(kMapSlot, 2, {{kMapScene, 1}}); p.m.on_shown(kMapScene, p.now);
    ok("parked cluster can return by a shown callback with no new request", p.state(0) == TargetState::Shown && requested_none(joined()));

    Rig f;
    f.slot(kMapSlot, 2, 0x00007777); f.m.want(0, true, true); f.m.tick(f.now);
    f.run(60000);
    ok("foreign ownership still reported: native waits, never forcibly takes it", f.state(0) == TargetState::Waiting && requested_none(joined()));
    f.slot(kMapSlot, 1, 0); f.run(1000);
    ok("foreign owner reported gone: normal acquisition resumes", joined().find("request map") != std::string::npos);

    // A NoSlot refusal has different semantics for ordinary map vs a guide
    // hold. The guide's protection is retained; no app recovery clears it.
    GuideRig g;
    g.slot(kGuideSlot, 1, 0); g.show_map(); g.pass(100);
    joined();
    g.m.on_refused(kGuideScene, Refusal::NoSlot, "map E_DCSM_SLOTID_UNKNOWN", g.now);
    g.pass(60000);
    ok("bad guide slot: protected hold is not repeatedly requested", joined().find("request guide") == std::string::npos && !g.m.requested(GuideRig::kGuide));
    // Missing on_lost/on_shown after parking: three positive snapshots of
    // a free/empty slot spanning the verification interval must reconcile
    // only this stale ordinary map. Tick time alone is never evidence.
    Rig v;
    v.m.want(0, true, true); v.m.tick(v.now); v.m.on_shown(kMapScene,v.now);
    v.rows(kMapSlot,2,{{kStockMap,1},{kMapScene,3}}); v.m.on_parked(kMapScene,v.now);
    joined();
    v.slot(kMapSlot,1,0); v.run(750); v.slot(kMapSlot,1,0);
    ok("two free reports alone do not tear down a parked image", v.state(0)==TargetState::Parked && requested_none(joined()));
    v.run(750); v.slot(kMapSlot,1,0); v.run(2500);
    ok("missing callback: repeated free-slot reports recover the map", joined().find("request map")!=std::string::npos && v.state(0)==TargetState::Acquiring);
    v.rows(kMapSlot,2,{{kMapScene,1}});v.m.on_shown(kMapScene,v.now);
    ok("reconciled map can return through normal shown callback",v.state(0)==TargetState::Shown);
    joined();

    Rig partial;
    partial.m.want(0,true,true);partial.m.tick(partial.now);partial.m.on_parked(kMapScene,partial.now);
    joined();partial.slot(kMapSlot,1,0);
    for(int j=0;j<5;j++){partial.run(1000);partial.slot(kPanelSlot,1,0);}
    ok("unrelated partial table reports never reconcile the map",partial.state(0)==TargetState::Parked && requested_none(joined()));
    for(int j=0;j<4;j++){partial.run(750);partial.slot(kMapSlot,0,0);}
    ok("locked free-looking reports never reconcile the map",partial.state(0)==TargetState::Parked && requested_none(joined()));
    partial.slot(kMapSlot,1,0);partial.run(750);partial.slot(kMapSlot,1,0);
    partial.rows(kMapSlot,2,{{kStockMap,1},{kMapScene,3}});
    joined();partial.slot(kMapSlot,1,0);partial.run(1500);partial.slot(kMapSlot,1,0);
    ok("intervening stock ownership resets the empty-report evidence",partial.state(0)==TargetState::Parked && requested_none(joined()));

    Rig hud;
    hud.m.want(2,true,false);hud.m.tick(hud.now);hud.m.on_parked(kPanelScene,hud.now);joined();
    for(int j=0;j<4;j++){hud.run(750);hud.slot(kHudSlot,1,0);}
    ok("map reconciliation never changes HUD arbitration",hud.state(2)==TargetState::Parked && requested_none(joined()));
    return failures ? 1 : 0;
}
'''.replace('UPSTREAM_TEST', json.dumps(str(root / 'test/slots_test.cpp')))
patch = Path(__file__).resolve().parent.parent / 'patches/cluster-render-0.4.0-parked-recovery.patch'
with tempfile.TemporaryDirectory(prefix='redline-native-cluster-recovery-') as temp:
    folder = Path(temp)
    def compile_and_run(base, name):
        test = folder / (name + '.cpp')
        test.write_text(source.replace(str(root), str(base)))
        binary = folder / name
        subprocess.run(['g++', '-std=c++14', '-O2', str(test)] +
                       [str(base / 'src' / n) for n in ('slots.cpp', 'guard.cpp', 'governor.cpp', 'log.cpp')] +
                       ['-lpthread', '-o', str(binary)], check=True, timeout=60)
        return subprocess.run([str(binary)], capture_output=True, text=True, timeout=20)
    original = compile_and_run(root, 'original')
    assert original.returncode != 0 and 'FAIL missing callback: repeated free-slot reports recover the map' in original.stdout, original.stdout + original.stderr
    candidate = folder / 'candidate/native/cluster-render'
    shutil.copytree(root, candidate)
    subprocess.run(['patch', '-p1', '-i', str(patch)], cwd=folder / 'candidate', check=True, capture_output=True, text=True)
    result = compile_and_run(candidate, 'patched')
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    checks = sum(line.startswith('ok ') for line in result.stdout.splitlines())
    assert checks == 15, result.stdout
    # Also retain upstream's entire native regression suite on the patch.
    entire = folder / 'entire'
    subprocess.run(['g++', '-std=c++14', '-O2', str(candidate / 'test/slots_test.cpp')] +
                   [str(candidate / 'src' / n) for n in ('slots.cpp', 'guard.cpp', 'governor.cpp', 'log.cpp')] +
                   ['-lpthread', '-o', str(entire)], check=True, timeout=60)
    full = subprocess.run([str(entire)], capture_output=True, text=True, timeout=20)
    if full.returncode:
        raise RuntimeError(full.stdout + full.stderr)
    all_checks = sum(line.startswith('ok ') for line in full.stdout.splitlines())
    print('PASS: original missing-callback failure reproduced; proposed native patch passes '+str(checks)+' recovery/safety checks plus '+str(all_checks)+' upstream checks. Patch is not installed by the app; simulated hardware callbacks only.')
