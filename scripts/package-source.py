#!/usr/bin/env python3
"""Create a portable source ZIP without build caches, local secrets or generated packages."""
from pathlib import Path
import os
import zipfile
root = Path(__file__).resolve().parent.parent
output = root / 'artifacts' / 'SnapSlot-source.zip'
output.parent.mkdir(exist_ok=True)
skip = {'.git', '.tools', '.build', 'node_modules', '.next', 'out', 'bin', 'obj', 'artifacts', 'test-results', 'playwright-report', '.taste-skill', '.vs', '__pycache__'}
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for directory, directories, files in os.walk(root, followlinks=False):
        directories[:] = sorted(name for name in directories if name not in skip and not (Path(directory) / name).is_symlink())
        for name in sorted(files):
            file = Path(directory) / name
            relative = file.relative_to(root)
            if file.is_symlink() or (name.startswith('.env') and name != '.env.example'):
                continue
            if file.suffix in {'.pfx', '.p12', '.pem', '.key', '.log', '.tsbuildinfo', '.user', '.suo'} or name == '.DS_Store':
                continue
            archive.write(file, Path('SnapSlot') / relative)
print(output)
