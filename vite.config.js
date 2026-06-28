import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';

// 复制原始 Mineradio 前端资源到 public/
function copyFrontendAssets() {
  const srcDir = resolve(__dirname, '../Mineradio/public');
  const destDir = resolve(__dirname, 'public');

  if (!existsSync(srcDir)) {
    console.warn('⚠️  Original Mineradio/public not found. Run from Mineradio-Android/ directory.');
    return;
  }

  function copyDir(src, dest) {
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      const srcPath = resolve(src, entry);
      const destPath = resolve(dest, entry);
      if (statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  copyDir(srcDir, destDir);
  console.log('✅ Frontend assets copied to public/');
}

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'public/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
      },
    },
    // 生产环境压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // 保留 console 便于调试
      },
    },
  },
  plugins: [
    {
      name: 'copy-frontend',
      buildStart() {
        copyFrontendAssets();
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
});
