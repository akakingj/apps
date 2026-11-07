"""Verify native HUD navigation/popup yielding in upstream's real SlotManager, on the host.

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
int main() { return upstream_slots_test_main(); }
'''.replace('UPSTREAM_TEST', json.dumps(str(root / 'test/slots_test.cpp')))
with tempfile.TemporaryDirectory(prefix='redline-hud-guidance-') as temp:
    folder = Path(temp)
    test = folder / 'hud.cpp'
    test.write_text(source)
    binary = folder / 'hud-test'
    subprocess.run(['g++', '-std=c++14', '-O2', str(test)] +
                   [str(root / 'src' / name) for name in ('slots.cpp', 'guard.cpp', 'governor.cpp', 'log.cpp')] +
                   ['-lpthread', '-o', str(binary)], check=True, timeout=60)
    result = subprocess.run([str(binary)], capture_output=True, text=True, timeout=20)
    if result.returncode: raise RuntimeError(result.stdout + result.stderr)
    for expected in ['parked behind: an overlay-only HUD gives way', 'parked behind: not asked for while the stock content shows', 'parked behind: asked for again once the slot is free', 'popup: the map releases its slot and waits']:
        assert expected in result.stdout, 'Use a cluster-render >= 0.4.0 source: missing '+expected
    print('PASS: real native slot suite, including newly parked HUD guidance, popup release and stock-view restoration ('+str(sum(line.startswith('ok ') for line in result.stdout.splitlines()))+' checks)')
