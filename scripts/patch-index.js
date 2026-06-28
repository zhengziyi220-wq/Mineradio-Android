/**
 * 前端移植脚本
 * 将原始 Mineradio/index.html 复制并注入 Android 适配代码
 *
 * 用法: node scripts/patch-index.js
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'Mineradio', 'public', 'index.html');
const DEST = path.join(__dirname, '..', 'public', 'index.html');

const ANDROID_ADAPTER = `
<!-- Mineradio Android 适配层 -->
<script>
  // 平台标记 (在所有脚本之前)
  window.__MINERADIO_ANDROID__ = true;
  window.__MINERADIO_PLATFORM__ = 'android';

  // Electron API 兼容层
  window.electronAPI = window.electronAPI || {};

  // 阻止 Electron 特有模块引用报错
  if (typeof require === 'undefined') {
    window.require = function(module) {
      console.warn('[Android] require() mock for:', module);
      return {};
    };
  }
</script>
<script type="module" src="dist/src/app.js"></script>
`;

function patchIndex() {
  if (!fs.existsSync(SRC)) {
    console.error('❌ Source not found:', SRC);
    console.error('   请先克隆原始 Mineradio 项目到 ../Mineradio/');
    process.exit(1);
  }

  let html = fs.readFileSync(SRC, 'utf-8');

  // 1. 在 <head> 末尾注入适配脚本
  const headClose = html.indexOf('</head>');
  if (headClose > -1) {
    html = html.slice(0, headClose) + ANDROID_ADAPTER + html.slice(headClose);
  }

  // 2. 移除 Electron titlebar 相关样式 (如果在 <style> 中)
  // 这些样式在 Android 上不需要，保留也不影响

  // 3. 修改 viewport (适配移动端)
  html = html.replace(
    /<meta name="viewport"[^>]*>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'
  );

  // 4. 确保输出目录存在
  const destDir = path.dirname(DEST);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // 5. 写入
  fs.writeFileSync(DEST, html, 'utf-8');
  const sizeKB = Math.round(fs.statSync(DEST).size / 1024);
  console.log(`✅ Patched index.html → ${DEST} (${sizeKB} KB)`);

  // 6. 复制 vendor 目录
  const vendorSrc = path.join(__dirname, '..', '..', 'Mineradio', 'public', 'vendor');
  const vendorDest = path.join(__dirname, '..', 'public', 'vendor');
  if (fs.existsSync(vendorSrc)) {
    copyDir(vendorSrc, vendorDest);
    console.log('✅ Copied vendor/');
  }

  // 7. 复制其他静态资源
  const assetsSrc = path.join(__dirname, '..', '..', 'Mineradio', 'public', 'assets');
  const assetsDest = path.join(__dirname, '..', 'public', 'assets');
  if (fs.existsSync(assetsSrc)) {
    copyDir(assetsSrc, assetsDest);
    console.log('✅ Copied assets/');
  }

  // 8. 复制默认用户存档
  const archiveSrc = path.join(__dirname, '..', '..', 'Mineradio', 'public', 'default-user-fx-archive.json');
  if (fs.existsSync(archiveSrc)) {
    fs.copyFileSync(archiveSrc, path.join(__dirname, '..', 'public', 'default-user-fx-archive.json'));
    console.log('✅ Copied default-user-fx-archive.json');
  }

  console.log('\n🎉 Frontend patch complete!');
  console.log('   Run "npm run cap:sync" to sync to Android project.');
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

patchIndex();
