"""Import verified Korean Store layers without replacing existing components."""
import json
import shutil
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]).resolve()
repo = json.loads((root / 'mgu-repo.json').read_text())
incoming = json.loads((source / 'mgu-repo.json').read_text())
ids = {c['id'] for c in repo['components']}
assert not ids.intersection(c['id'] for c in incoming['components']), 'Duplicate app ID'
assert not (root / 'store/korean').exists(), 'Already imported'
shutil.copytree(source / 'store/korean', root / 'store/korean')
for c in incoming['components']:
    shutil.copytree(source / c['path'], root / c['path'])
repo['components'].extend(incoming['components'])
repo.setdefault('tools', []).extend(incoming.get('tools', []))
shutil.copy2(source / 'tools/install-korean.py', root / 'tools/install-korean.py')
shutil.copytree(source / 'kit/renderd/prebuilt', root / 'kit/renderd/prebuilt')
shutil.copy2(source / 'LICENSE', root / 'LICENSE.appsKOR')
(root / 'mgu-repo.json').write_text(json.dumps(repo, ensure_ascii=False, indent=2) + '\n')
