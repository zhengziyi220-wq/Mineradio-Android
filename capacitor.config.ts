import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mineradio.android',
  appName: 'Mineradio',
  webDir: 'public',
  server: {
    androidScheme: 'https',
    // 允许 WebView 访问外部音乐 API
    allowNavigation: [
      'music.163.com',
      '*.music.163.com',
      'y.qq.com',
      '*.y.qq.com',
      '*.gtimg.cn',
      '*.qq.com',
      'api.open-meteo.com',
      'geocoding-api.open-meteo.com',
    ],
  },
  android: {
    // 允许混合内容 (HTTP 音源可能走非 HTTPS)
    allowMixedContent: true,
    backgroundColor: '#000000',
    // 捕获 WebView 控制台日志便于调试
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
};

export default config;
