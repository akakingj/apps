"""Exercise map takeover and supported guidance holds in upstream's real SlotManager, on the host.

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
    take_over();
    guide_follows_the_map();
    guide_yields();
    guide_no_flapping();
    return failures ? 1 : 0;
}
'''.replace('UPSTREAM_TEST', json.dumps(str(root / 'test/slots_test.cpp')))
with tempfile.TemporaryDirectory(prefix='redline-map-arbitration-') as temp:
    folder = Path(temp)
    test = folder / 'map.cpp'
    test.write_text(source)
    binary = folder / 'map-test'
    subprocess.run(['g++', '-std=c++14', '-O2', str(test)] +
                   [str(root / 'src' / name) for name in ('slots.cpp', 'guard.cpp', 'governor.cpp', 'log.cpp')] +
                   ['-lpthread', '-o', str(binary)], check=True, timeout=60)
    result = subprocess.run([str(binary)], capture_output=True, text=True, timeout=10)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    checks = sum(line.startswith('ok ') for line in result.stdout.splitlines())
    assert checks >= 20, result.stdout
    print('PASS: real native map takeover, guide hold lifecycle, warning yield and no-flapping (' + str(checks) + ' checks)')
