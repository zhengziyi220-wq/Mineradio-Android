# Mineradio Android

**Mineradio 沉浸式音乐播放器 — Android 适配版**

基于 [Mineradio](https://github.com/XxHuberrr/Mineradio) Windows Electron 桌面版适配，使用 Capacitor + WebView 架构。

---

## 架构概览

```
┌─────────────────────────────────────────────────┐
│                  Android App                     │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │           Capacitor WebView                │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │    原始 index.html (Three.js/WebGL)   │  │  │
│  │  │    + Android 适配层 (app.js)          │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  │  ┌──────────────┐  ┌───────────────────┐  │  │
│  │  │  API Bridge   │  │  Audio Bridge     │  │  │
│  │  │ (fetch 拦截)   │  │ (原生音频控制)     │  │  │
│  │  └──────┬───────┘  └───────┬───────────┘  │  │
│  └─────────┼──────────────────┼──────────────┘  │
│            │                  │                  │
│  ┌─────────▼──────────┐  ┌───▼──────────────┐  │
│  │  MineradioHttp     │  │  MineradioAudio  │  │
│  │  (Capacitor Plugin) │  │ (Capacitor Plugin) │  │
│  │  → OkHttp 直连 API  │  │  → Media3 ExoPlayer│  │
│  └────────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 核心设计

| 组件 | 说明 |
|------|------|
| **API Bridge** | 拦截前端 `fetch('/api/...')` 调用，路由到纯 JS API 模块 |
| **MineradioHttp** | Capacitor 原生 HTTP 插件，用 OkHttp 直连网易云/QQ 音乐 (绕 CORS) |
| **MineradioAudio** | Capacitor 音频插件，基于 Media3 ExoPlayer (后台播放+通知栏) |
| **AudioBridge** | JS 层音频接口，兼容 HTML5 Audio API，底层走原生 ExoPlayer |
| **Electron Compat** | Mock Electron API，让原前端代码在 Android 上正常运行 |

---

## 前置要求

- **Node.js** >= 18
- **Android Studio** (最新稳定版)
- **JDK** 17
- **Android SDK** 34 (API Level 34)
- 原始 Mineradio 项目已克隆到 `../Mineradio/`

---

## 快速开始

### 1. 克隆项目

```bash
# 确保原始 Mineradio 在同级目录
git clone https://github.com/XxHuberrr/Mineradio.git ../Mineradio

# 进入 Android 项目
cd Mineradio-Android
```

### 2. 安装依赖

```bash
npm install
```

### 3. 移植前端

```bash
# 复制并适配原始 index.html
node scripts/patch-index.js
```

输出:
```
✅ Patched index.html → public/index.html (1351 KB)
✅ Copied vendor/
✅ Copied assets/
✅ Copied default-user-fx-archive.json
```

### 4. 同步到 Android

```bash
npx cap sync android
```

### 5. 构建 APK

```bash
# 方法 A: 命令行
cd android
./gradlew assembleDebug
# 输出: android/app/build/outputs/apk/debug/app-debug.apk

# 方法 B: Android Studio
npx cap open android
# 在 Android Studio 中 Build → Build Bundle(s) / APK(s)
```

### 6. 安装到设备

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 项目结构

```
Mineradio-Android/
├── android/                          # Android 原生项目
│   ├── app/src/main/
│   │   ├── java/com/mineradio/android/
│   │   │   ├── MainActivity.java     # 主 Activity
│   │   │   ├── MineradioHttpPlugin.java   # HTTP 原生插件
│   │   │   ├── MineradioAudioPlugin.java  # 音频原生插件
│   │   │   └── AudioPlaybackService.java  # 后台音频服务
│   │   ├── res/
│   │   │   ├── values/               # 主题、颜色、字符串
│   │   │   └── xml/                  # 网络安全、FileProvider
│   │   └── AndroidManifest.xml
│   ├── build.gradle
│   ├── variables.gradle
│   └── app/build.gradle
├── src/                              # JS 桥接层
│   ├── api/
│   │   ├── netease-api.js            # 网易云 API 客户端
│   │   ├── qqmusic-api.js            # QQ 音乐 API 客户端
│   │   ├── weather-api.js            # 天气电台 API
│   │   └── api-bridge.js             # 主路由 (替代 server.js)
│   ├── services/
│   │   └── audio-bridge.js           # 音频桥接 (兼容 HTML5 Audio)
│   └── app.js                        # 应用入口 (Electron 兼容层)
├── scripts/
│   └── patch-index.js                # 前端移植脚本
├── public/                           # Web 资源 (由脚本生成)
│   ├── index.html                    # 适配后的前端页面
│   ├── vendor/                       # Three.js, GSAP 等
│   └── assets/
├── capacitor.config.ts
├── package.json
├── vite.config.js
└── README.md
```

---

## API 桥接映射

| 原 server.js 路由 | Android API 模块 | 说明 |
|---|---|---|
| `/api/search` | netease-api.search() | 网易云搜索 |
| `/api/song/url` | netease-api.songUrl() | 获取播放 URL |
| `/api/lyric` | netease-api.getLyric() | 获取歌词 |
| `/api/login/qr/*` | netease-api.loginQr*() | 二维码登录 |
| `/api/user/playlists` | netease-api.userPlaylist() | 用户歌单 |
| `/api/playlist/*` | netease-api.playlist*() | 歌单管理 |
| `/api/personalized` | netease-api.personalized() | 个性化推荐 |
| `/api/qq/search` | qqmusic-api.search() | QQ 音乐搜索 |
| `/api/qq/song/url` | qqmusic-api.getSongUrl() | QQ 播放 URL |
| `/api/weather/radio` | weather-api.getWeatherRadio() | 天气电台 |
| `/api/cover` | 直接拼接 CDN URL | 封面图片 |
| `/api/audio` | 重定向到音源 URL | 音频代理 |

---

## 开发调试

### WebView 调试

1. 连接设备到电脑
2. 打开 Chrome，访问 `chrome://inspect`
3. 选择 Mineradio WebView，查看 Console/Network

### 查看日志

```bash
adb logcat -s MineradioHttp MineradioAudio Capacitor
```

### 热重载开发

```bash
# 启动开发服务器
npm run dev

# 修改 capacitor.config.ts 中的 server 配置
# server: { url: 'http://YOUR_IP:5173', cleartext: true }

npx cap sync android
npx cap run android
```

---

## 已知限制

1. **桌面歌词** — Android 不支持独立窗口叠加，已禁用
2. **壁纸模式** — Android 不支持桌面壁纸模式，已禁用
3. **全局热键** — Android 无全局键盘快捷键，已禁用
4. **3D 歌单架** — 需要 WebGL 2.0 支持，部分低端设备可能卡顿
5. **后台播放** — 需要通知权限 (Android 13+ 需要用户授权)
6. **存储** — 使用 localStorage 替代文件系统，数据在卸载时丢失
7. **第三方登录** — 网易云/QQ 音乐登录在 WebView 中进行，可能需要适配

---

## 后续优化方向

- [ ] Capacitor 原生插件：文件系统 (持久化用户数据)
- [ ] Capacitor 原生插件：媒体通知栏自定义样式
- [ ] Android Auto 集成
- [ ] Material You 动态取色
- [ ] 多窗口/分屏适配
- [ ] 性能优化：低端设备降级方案
- [ ] Google Play 上架准备 (签名、隐私政策等)

---

## License

GPL-3.0 — 与原始 Mineradio 项目一致
