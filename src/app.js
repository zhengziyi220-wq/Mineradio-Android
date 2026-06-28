/**
 * Mineradio Android 入口
 * 在原始 index.html 之前加载，初始化所有 Android 桥接模块
 */

import { initApiBridge } from './api/api-bridge.js';
import audioBridge from './services/audio-bridge.js';

// ===================== 平台检测 =====================

window.__MINERADIO_ANDROID__ = true;
window.__MINERADIO_PLATFORM__ = 'android';

// ===================== API 桥接初始化 =====================

initApiBridge();

// ===================== Audio 桥接注入 =====================

// 将 audioBridge 注入到全局，让原有前端代码可以使用
window.__audioBridge = audioBridge;

// ===================== 平台适配 =====================

/**
 * 适配 Electron IPC 调用
 * 原前端通过 window.electronAPI 或 ipcRenderer 调用 Electron
 * 这里提供兼容接口
 */
function setupElectronCompat() {
  // 如果前端使用了 Electron IPC，这里提供 mock
  window.electronAPI = {
    // 窗口控制 (Android 不需要，但前端可能检查)
    minimizeWindow: () => {},
    toggleMaximize: () => {},
    toggleFullscreen: () => {
      // Android 全屏
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    },
    exitFullscreen: () => {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    },
    getWindowState: async () => ({
      isMaximized: true,
      isNativeFullScreen: false,
      isHtmlFullScreen: false,
      isWindowFullScreen: false,
      isFullScreen: true,
      isMinimized: false,
      isVisible: true,
      isFocused: true,
      isPrimaryDisplay: true,
    }),

    // 登录 (WebView Cookie 管理)
    openNeteaseLogin: () => {
      window.open('https://music.163.com/#/login', '_blank', 'width=800,height=600');
    },
    clearNeteaseLogin: () => {
      localStorage.removeItem('mineradio-netease-cookie');
    },
    openQQLogin: () => {
      window.open('https://y.qq.com/n/ryqq/profile', '_blank', 'width=800,height=600');
    },
    clearQQLogin: () => {
      localStorage.removeItem('mineradio-qq-cookie');
    },

    // 导入导出 (使用 Capacitor Filesystem)
    exportJsonFile: async (data) => {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const result = await Filesystem.writeFile({
          path: `mineradio-export-${Date.now()}.json`,
          data: JSON.stringify(data, null, 2),
          directory: Directory.Documents,
        });
        return { ok: true, path: result.uri };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    importJsonFile: async () => {
      // 使用 Android 文件选择器
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return resolve({ ok: false, cancelled: true });
          const text = await file.text();
          try {
            resolve({ ok: true, data: JSON.parse(text) });
          } catch (err) {
            resolve({ ok: false, error: 'Invalid JSON' });
          }
        };
        input.click();
      });
    },

    // 热键 (Android 不支持全局热键)
    configureGlobalHotkeys: () => ({ ok: false, skipped: true }),

    // 更新 (由 Google Play 管理)
    openUpdateInstaller: () => {},
    restartApp: () => {
      window.location.reload();
    },

    // 桌面歌词 (Android 不支持独立窗口)
    setDesktopLyricsEnabled: () => {},
    updateDesktopLyrics: () => {},
    setDesktopLyricsDragging: () => {},

    // 壁纸模式 (Android 不支持)
    setWallpaperEnabled: () => {},
    updateWallpaper: () => {},

    // 窗口状态事件
    onWindowState: (callback) => {
      // 模拟窗口状态
      callback({
        isMaximized: true,
        isFullScreen: true,
        isVisible: true,
        isFocused: true,
      });
    },
    onWindowStateUnsubscribe: () => {},

    // 更新事件
    onUpdateAvailable: () => {},
    onUpdateDownloadProgress: () => {},
  };

  // Capacitor 标记
  window.Capacitor = window.Capacitor || { isNative: true, isAndroid: true, platform: 'android' };
}

/**
 * 适配文件系统 API
 * 原前端使用 fs.readFileSync 等 Node.js API
 */
function setupFsCompat() {
  // 覆盖 localStorage 读写以兼容原有 .cookie 文件
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalGetItem = localStorage.getItem.bind(localStorage);

  // 暴露给可能用到的代码
  window.__localStorage = localStorage;
}

/**
 * 处理 Android 返回键
 */
function setupBackButton() {
  document.addEventListener('backbutton', (e) => {
    e.preventDefault();
    // 优先关闭弹窗/侧边栏，最后才退出
    const modal = document.querySelector('.modal.active, .popup.active, .sidebar.open');
    if (modal) {
      modal.classList.remove('active', 'open');
      return;
    }
    // 如果不在首页，返回首页
    if (window.location.hash && window.location.hash !== '#/') {
      window.location.hash = '#/';
      return;
    }
    // 退出应用
    if (navigator.app && navigator.app.exitApp) {
      navigator.app.exitApp();
    }
  });
}

/**
 * 处理刘海屏和圆角安全区域
 */
function setupSafeArea() {
  const style = document.createElement('style');
  style.textContent = `
    /* Android 安全区域适配 */
    :root {
      --safe-area-top: env(safe-area-inset-top, 0px);
      --safe-area-bottom: env(safe-area-inset-bottom, 0px);
      --safe-area-left: env(safe-area-inset-left, 0px);
      --safe-area-right: env(safe-area-inset-right, 0px);
    }
    /* 隐藏 Electron 专用 UI */
    #desktop-titlebar { display: none !important; }
    .desktop-window-controls { display: none !important; }
    .desktop-mode-btn { display: none !important; }

    /* 移动端底部安全区 */
    #player-bar, #control-panel {
      padding-bottom: max(12px, var(--safe-area-bottom)) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * 适配触摸事件
 * 将鼠标右键菜单改为长按触发
 */
function setupTouchAdaptation() {
  let longPressTimer;
  let touchStartPos;

  document.addEventListener('touchstart', (e) => {
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer = setTimeout(() => {
      const touch = e.touches[0];
      // 模拟右键
      const contextMenuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 2,
      });
      e.target.dispatchEvent(contextMenuEvent);
    }, 600);
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (touchStartPos) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);
      if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
  }, { passive: true });
}

// ===================== 初始化 =====================

document.addEventListener('DOMContentLoaded', () => {
  setupElectronCompat();
  setupFsCompat();
  setupBackButton();
  setupSafeArea();
  setupTouchAdaptation();

  console.log('[Mineradio Android] Platform adaptations loaded');
});

// 立即执行的适配
setupElectronCompat();
setupSafeArea();
