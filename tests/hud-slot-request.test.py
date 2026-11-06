"""Reproduce HUD request arbitration in upstream's real SlotManager, on the host.

Pass an existing robertnisipeanu/idrive-apps checkout; nothing is downloaded.
The upstream FakePort/Scenes replace hardware, not the arbitration code.
"""
import json
from pathlib import Path
import subprocess
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
    r.slot(kHudSlot, 2, 0x01000320);
    r.m.want(2, true, false);
    r.run(2200);
    ok("0.9.0: HUD contend=false sends no request while stock holds the slot",
       joined().find("request hud") == std::string::npos);
    r.m.want(2, true, true);
    r.run(2200);
    ok("0.9.1: HUD contend=true sends a request despite stock occupancy",
       joined().find("request hud") != std::string::npos);
    r.rows(kHudSlot, 2, {{0x01000320, 1}, {kPanelScene, 3}});
    r.m.on_parked(kPanelScene, r.now);
    joined();
    r.run(20000);
    ok("HUD default takeover=false never unmaps stock, even when contending",
       joined().find("take over") == std::string::npos && r.state(2) == TargetState::Parked);
    r.m.want(2, false, false);
    r.run(4000);
    ok("output OFF releases the parked HUD request",
       joined().find("release hud") != std::string::npos);
    Rig foreign;
    foreign.slot(kHudSlot, 2, 0x12345678);
    foreign.m.want(2, true, true);
    foreign.run(5000);
    ok("another app's HUD content is still yielded to",
       joined().find("request hud") == std::string::npos);
    return failures ? 1 : 0;
}
'''.replace('UPSTREAM_TEST', json.dumps(str(root / 'test/slots_test.cpp')))
with tempfile.TemporaryDirectory(prefix='redline-hud-arbitration-') as temp:
    folder = Path(temp)
    test = folder / 'hud.cpp'
    test.write_text(source)
    binary = folder / 'hud-test'
    subprocess.run(['g++', '-std=c++14', '-O2', str(test)] +
                   [str(root / 'src' / name) for name in ('slots.cpp', 'guard.cpp', 'governor.cpp', 'log.cpp')] +
                   ['-lpthread', '-o', str(binary)], check=True, timeout=60)
    subprocess.run([str(binary)], check=True, timeout=10)
