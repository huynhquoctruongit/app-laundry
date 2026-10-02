#!/usr/bin/env node
/**
 * Phát hành bản cập nhật app — các máy tự nhận (xem src/components/common/AppUpdater.tsx).
 *
 *   node scripts/release.js ota "Ghi chú"   → chỉ đổi code JS/giao diện: máy tự tải ngầm, KHÔNG cần cài APK
 *   node scripts/release.js apk "Ghi chú"   → có đổi native (thêm thư viện, quyền, android/…): build APK mới,
 *                                              máy hiện popup "Cập nhật" → tải + cài
 *   Thêm --online nếu gradle cần tải thư viện mới (mặc định build --offline).
 *
 * File được đẩy lên GitHub Release "updates" của repo app-laundry (public):
 *   update.json (mô tả bản mới nhất) + file .apk / gói OTA .zip.
 * Token GitHub: biến GITHUB_TOKEN, hoặc tự lấy từ git credential (Keychain) của máy.
 *
 * Bản OTA chỉ chạy được nếu phần native giống APK đang cài → script tự từ chối OTA khi thấy
 * android/, patches/ hoặc dependencies đã đổi kể từ lần phát hành APK gần nhất.
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OWNER = 'huynhquoctruongit';
const REPO = 'app-laundry';
const TAG = 'updates';
const VERSION_FILE = path.join(ROOT, 'version.json');
const OUT = path.join(ROOT, 'release-out');
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

const [mode, ...rest] = process.argv.slice(2);
const online = rest.includes('--online');
const notes = rest.filter((a) => !a.startsWith('--')).join(' ').trim();

function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function run(cmd, cwd = ROOT, env = {}) {
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const out = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n\n', cwd: ROOT }).toString();
    const m = out.match(/^password=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  return die('Không có token GitHub (đặt GITHUB_TOKEN hoặc đăng nhập git với github.com)');
}

const TOKEN = token();

async function gh(method, url, body, headers = {}) {
  const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      ...(body && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) die(`GitHub ${method} ${url} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function ensureRelease() {
  const existing = await gh('GET', `/releases/tags/${TAG}`);
  if (existing) return existing;
  return gh('POST', '/releases', {
    tag_name: TAG,
    name: 'Bản cập nhật app',
    body: 'Kênh tự cập nhật của app (scripts/release.js). Không xoá release này.',
    make_latest: 'false',
  });
}

async function uploadAsset(release, name, file, contentType) {
  const old = release.assets.find((a) => a.name === name);
  if (old) await gh('DELETE', `/releases/assets/${old.id}`);
  const data = fs.readFileSync(file);
  console.log(`⬆️  Đang tải lên ${name} (${(data.length / 1024 / 1024).toFixed(1)} MB)…`);
  const url = `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
  const asset = await gh('POST', url, data, { 'Content-Type': contentType });
  return asset.browser_download_url;
}

async function readManifest(release) {
  const a = release.assets.find((x) => x.name === 'update.json');
  if (!a) return {};
  const res = await fetch(a.browser_download_url);
  return res.ok ? res.json() : {};
}

/** Dấu vân tay phần native — đổi thì bắt buộc phát hành APK thay vì OTA. */
function nativeFingerprint() {
  const h = crypto.createHash('sha256');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  h.update(JSON.stringify(pkg.dependencies ?? {}));
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else {
        h.update(path.relative(ROOT, p));
        h.update(fs.readFileSync(p));
      }
    }
  };
  walk(path.join(ROOT, 'android/app/src/main'));
  walk(path.join(ROOT, 'patches'));
  h.update(fs.readFileSync(path.join(ROOT, 'android/app/build.gradle')));
  return h.digest('hex').slice(0, 16);
}

function readVersion() {
  return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
}
function writeVersion(v) {
  fs.writeFileSync(VERSION_FILE, JSON.stringify(v, null, 2) + '\n');
}

async function cleanup(release, keep) {
  for (const a of release.assets) {
    if (!keep.includes(a.name)) await gh('DELETE', `/releases/assets/${a.id}`);
  }
}

async function releaseApk() {
  const prev = readVersion();
  const [maj, min, patch] = String(prev.versionName).split('.').map(Number);
  const v = {
    ...prev,
    versionCode: prev.versionCode + 1,
    versionName: `${maj}.${min}.${(patch || 0) + 1}`,
    nativeFingerprint: nativeFingerprint(),
  };
  writeVersion(v);
  console.log(`🔨 Build APK ${v.versionName} (${v.versionCode})…`);
  try {
    const sdk = process.env.ANDROID_HOME || path.join(process.env.HOME, 'Library/Android/sdk');
    run(`./gradlew assembleRelease ${online ? '' : '--offline'} -q`, path.join(ROOT, 'android'), { ANDROID_HOME: sdk });
  } catch (e) {
    writeVersion(prev);
    die('Build APK lỗi — đã trả version.json về như cũ');
  }
  const apkName = `giat-say-nhanh-${v.versionName}-${v.versionCode}.apk`;
  fs.mkdirSync(OUT, { recursive: true });
  const apkPath = path.join(OUT, apkName);
  fs.copyFileSync(path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk'), apkPath);

  const release = await ensureRelease();
  const url = await uploadAsset(release, apkName, apkPath, 'application/vnd.android.package-archive');
  const manifest = {
    apk: { versionCode: v.versionCode, versionName: v.versionName, url, notes: notes || undefined },
    ota: null,
    publishedAt: new Date().toISOString(),
  };
  const mPath = path.join(OUT, 'update.json');
  fs.writeFileSync(mPath, JSON.stringify(manifest, null, 2));
  await uploadAsset(release, 'update.json', mPath, 'application/json');
  await cleanup(await gh('GET', `/releases/${release.id}`), [apkName, 'update.json']);
  console.log(`\n🎉 Đã phát hành APK ${v.versionName} (${v.versionCode})`);
  console.log(`   Các máy sẽ hiện popup "Có bản cập nhật mới" khi mở app.`);
  console.log(`   File: ${apkPath}`);
  console.log(`   Link tải trực tiếp: ${url}`);
}

async function releaseOta() {
  const prev = readVersion();
  if (prev.nativeFingerprint && prev.nativeFingerprint !== nativeFingerprint()) {
    die('Phần native (android/, patches/ hoặc dependencies) đã đổi so với APK đang phát hành → dùng: node scripts/release.js apk "…"');
  }
  const release = await ensureRelease();
  const current = await readManifest(release);
  if (!current.apk || current.apk.versionCode !== prev.versionCode) {
    die(`Chưa có APK ${prev.versionCode} trên kênh cập nhật → phát hành APK trước: node scripts/release.js apk "…"`);
  }

  const v = { ...prev, bundleVersion: prev.bundleVersion + 1 };
  const dir = path.join(OUT, 'ota');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const jsBundle = path.join(OUT, 'ota.js');
  console.log(`📦 Đóng gói JS bản ${v.bundleVersion} cho APK ${v.versionCode}…`);
  run(
    `npx react-native bundle --platform android --dev false --minify false --entry-file index.js --bundle-output "${jsBundle}" --assets-dest "${dir}"`,
  );
  // Hermes: biên dịch sang bytecode giống bundle trong APK (mở app nhanh)
  const hermesc = path.join(ROOT, 'node_modules/react-native/sdks/hermesc/osx-bin/hermesc');
  run(`"${hermesc}" -emit-binary -O -max-diagnostic-width=80 -out "${path.join(dir, 'index.android.bundle')}" "${jsBundle}"`);
  const zipName = `ota-${v.versionCode}-${v.bundleVersion}.zip`;
  const zipPath = path.join(OUT, zipName);
  fs.rmSync(zipPath, { force: true });
  run(`zip -qr "${zipPath}" .`, dir);

  const url = await uploadAsset(release, zipName, zipPath, 'application/zip');
  const manifest = {
    ...current,
    ota: { nativeVersion: v.versionCode, bundleVersion: v.bundleVersion, url, notes: notes || undefined },
    publishedAt: new Date().toISOString(),
  };
  const mPath = path.join(OUT, 'update.json');
  fs.writeFileSync(mPath, JSON.stringify(manifest, null, 2));
  await uploadAsset(release, 'update.json', mPath, 'application/json');
  writeVersion(v);
  const apkName = decodeURIComponent(current.apk.url.split('/').pop());
  await cleanup(await gh('GET', `/releases/${release.id}`), [apkName, zipName, 'update.json']);
  console.log(`\n🎉 Đã phát hành bản ${v.bundleVersion} (OTA) cho APK ${v.versionName}`);
  console.log('   Các máy tự tải ngầm khi mở app, rồi hỏi "Khởi động lại".');
}

(async () => {
  if (mode === 'apk') await releaseApk();
  else if (mode === 'ota') await releaseOta();
  else die('Cách dùng: node scripts/release.js ota|apk "Ghi chú" [--online]');
})();
