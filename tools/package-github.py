"""Package only the portable GitHub source; retain all historical workspace files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
target = root.parent / 'Campus_Shelf_v09_Convenience_Store.zip'
files = []
for folder in ('dist', 'supabase', 'cloudbase', 'tests', '.github'):
    files.extend(p for p in (root / folder).rglob('*') if p.is_file())
for name in ('package.json', 'package-lock.json', '.gitignore', '.env.example',
             'README.md', 'CONVENIENCE_STORE_V09.md', 'CAMPUS_ADAPTATION_V08.md', 'QA_V08.md', 'qa-v08-fixtures.png', 'CLOUDBASE_GITHUB_GUIDE.md', 'UPLOAD_WEBSITE_ZH.md', 'QA_V07.md', 'DEPLOY_GITHUB.md', 'SUPABASE_START_HERE.md', 'QA_V06.md', 'qa-v06-admin.png', 'qa-v06-admin-overview.png', 'CATALOG.md', 'QA.md', 'QA_V2.md', 'QA_V021.md', 'QA_V03.md', 'QA_V04.md', 'QA_V041.md', 'QA_V042.md', 'QA_V05.md', 'SHELF_DESIGN_V05.md', 'qa-v05-camera.png', 'qa-v042-close-labels.png', 'qa-v041-languages.png', 'SHELF_DESIGN_V03.md', 'SHELF_DESIGN_V04.md', 'qa-v04-shelf.png', 'qa-v03-shelf.png', 'qa-v2-preview.png', 'qa-v021-measurements.png'):
    files.append(root / name)
for name in ('build-cloudbase.cjs', 'adapt-campus-catalog.cjs', 'expand-convenience-catalog.cjs', 'package-static.py', 'stamp-assets.cjs', 'check.cjs', 'build-standalone.cjs', 'prepare-github-pages.cjs', 'seed-catalog.cjs', 'package-github.py'):
    files.append(root / 'tools' / name)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for file in sorted(files):
        archive.write(file, file.relative_to(root).as_posix())
with ZipFile(target) as archive:
    names = archive.namelist()
    assert '.github/workflows/pages.yml' in names
    assert 'dist/.nojekyll' in names
    assert 'supabase/migrations/001_enrollment.sql' in names
    assert 'supabase/migrations/003_anthropometry_and_questionnaire.sql' in names
    assert 'dist/anthropometry-text.js' in names
    assert 'dist/rack-text.js' in names
    assert 'dist/rack.css' in names
    assert 'dist/camera.js' in names
    assert 'tests/camera.test.cjs' in names
    assert 'dist/admin.html' in names
    assert 'dist/study-client.js' in names
    assert 'supabase/migrations/006_factorial_study.sql' in names
    assert 'supabase/migrations/007_campus_catalog_and_zones.sql' in names
    assert 'cloudbase/02_campus_catalog_upgrade.sql' in names
    assert 'tools/stamp-assets.cjs' in names
    assert 'supabase/migrations/004_physical_shelf_upf_markup.sql' in names
    assert 'supabase/migrations/005_fifty_product_catalog.sql' in names
    assert not any(any(part in ('.git', '.publication', 'node_modules', '.openai') for part in Path(n).parts) for n in names)
    assert archive.testzip() is None
print(f'GitHub source package: {len(names)} files, {target.stat().st_size:,} bytes')
print(target)
