"""Verify a build candidate; never publishes or installs an APK."""
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess

root = pathlib.Path('src-tauri/gen/android/app/build/outputs/apk')
apks = list(root.glob('**/*release.apk'))
if len(apks) != 1:
    raise SystemExit('Expected one ARM64 release APK')
apk = apks[0]
tools = pathlib.Path(os.environ['ANDROID_HOME']) / 'build-tools/37.0.0'
result = subprocess.run([str(tools / 'apksigner'), 'verify', '--print-certs', str(apk)], check=True, text=True, capture_output=True)
fingerprints = re.findall(r'Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]+)', result.stdout)
expected = os.environ['TIMORA_ANDROID_EXPECTED_CERT_SHA256'].replace(':', '').strip().lower()
if len(expected) != 64 or len(fingerprints) != 1 or fingerprints[0].lower() != expected:
    raise SystemExit('Signing certificate does not match the configured identity')
badging = subprocess.run([str(tools / 'aapt'), 'dump', 'badging', str(apk)], check=True, text=True, capture_output=True).stdout
if "name='app.timora.android'" not in badging or "native-code: 'arm64-v8a'" not in badging or 'application-debuggable' in badging:
    raise SystemExit('Candidate package identity, architecture or debuggable flag is invalid')
version = json.loads(pathlib.Path('package.json').read_text())['version']
name = f'Timora-v{version}-android-arm64-candidate.apk'
out = pathlib.Path('candidate')
out.mkdir(exist_ok=True)
shutil.copyfile(apk, out / name)
hash_value = hashlib.file_digest((out / name).open('rb'), 'sha256').hexdigest()
(out / 'SHA256SUMS.txt').write_text(f'{hash_value}  {name}\n')
(out / 'manifest.json').write_text(json.dumps({'version': version, 'commit': os.environ.get('GITHUB_SHA'), 'artifact': name, 'sha256': hash_value, 'certificate_sha256': expected, 'status': 'candidate-device-acceptance-pending'}, indent=2))
