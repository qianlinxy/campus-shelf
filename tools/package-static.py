"""Package ready-to-upload website files for GitHub Pages or CloudBase hosting."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
target = root.parent / 'Campus_Shelf_v010_Website.zip'
config = (dist / 'config.js').read_text(encoding='utf-8')
assert "enrollmentEnabled: false" in config
assert "backendProvider: 'cloudbase'" in config
assert "monetary-dinosaur-d0d39pf87e5f20" in config
old = "publicSiteUrl: 'https://qianlinxy.github.io/campus-shelf/'"
assert config.count(old) == 1
# Generate an entry QR for whichever host is actually used.
config = config.replace(old, "publicSiteUrl: ''")
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for file in sorted(dist.rglob('*')):
        if not file.is_file() or file.name == 'standalone.html':
            continue
        name = file.relative_to(dist).as_posix()
        if name == 'config.js':
            archive.writestr(name, config)
        else:
            archive.write(file, name)
with ZipFile(target) as archive:
    names = archive.namelist()
    assert all(n in names for n in ['index.html', 'admin.html', 'config.js', 'backend.js', 'vendor/qrcode.js'])
    assert not any(n.startswith(('dist/', 'cloudbase/', 'supabase/', '.git/')) for n in names)
    assert archive.testzip() is None
print(f'Website upload package: {len(names)} files, {target.stat().st_size:,} bytes')
print(target)
