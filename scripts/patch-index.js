/**
 * 前端移植脚本 v2
 * 将原始 Mineradio/index.html 复制并注入完整的同步 Android 适配层
 *
 * 用法: node scripts/patch-index.js
 */

const fs = require('fs');
const path = require('path');

// 路径解析: 环境变量 > _upstream/ > ../Mineradio/
const ENV_BASE = process.env.MINERADIO_SRC || '';
const UPSTREAM_BASE = path.join(__dirname, '..', '_upstream');
const LOCAL_BASE = path.join(__dirname, '..', '..', 'Mineradio');

let BASE;
if (ENV_BASE && fs.existsSync(path.join(ENV_BASE, 'public', 'index.html'))) {
  BASE = ENV_BASE;
  console.log('📂 Using MINERADIO_SRC:', BASE);
} else if (fs.existsSync(path.join(UPSTREAM_BASE, 'public', 'index.html'))) {
  BASE = UPSTREAM_BASE;
  console.log('📂 Using _upstream:', BASE);
} else if (fs.existsSync(path.join(LOCAL_BASE, 'public', 'index.html'))) {
  BASE = LOCAL_BASE;
  console.log('📂 Using ../Mineradio:', BASE);
} else {
  console.error('❌ Mineradio source not found!');
  console.error('   Tried: ENV=' + ENV_BASE + ', ' + UPSTREAM_BASE + ', ' + LOCAL_BASE);
  process.exit(1);
}

const SRC = path.join(BASE, 'public', 'index.html');
const DEST = path.join(__dirname, '..', 'public', 'index.html');

// 读取 API 模块源码，转为内联
const neteaseSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'api', 'netease-api.js'), 'utf-8');
const qqmusicSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'api', 'qqmusic-api.js'), 'utf-8');
const weatherSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'api', 'weather-api.js'), 'utf-8');

// 把 ES module 语法去掉，转成普通 IIFE
function stripModuleSyntax(src) {
  return src
    // 移除 import 语句
    .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
    // export async function → async function
    .replace(/^export\s+async\s+function/gm, 'async function')
    // export function → function
    .replace(/^export\s+function/gm, 'function')
    // export default { ... } → 注释掉
    .replace(/^export\s+default\s+\{[\s\S]*?\};?\s*$/gm, '')
    // export { ... } → 注释掉
    .replace(/^export\s+\{[\s\S]*?\};?\s*$/gm, '');
}

const ANDROID_ADAPTER = `
<!-- ═══ Mineradio Android 同步适配层 ═══ -->
<script>
(function() {
  'use strict';
  console.log('[Mineradio Android] Adapter loading...');

  // ── 平台标记 ──
  window.__MINERADIO_ANDROID__ = true;
  window.__MINERADIO_PLATFORM__ = 'android';

  // ── require() mock (阻止 Electron 特有模块报错) ──
  if (typeof window.require === 'undefined') {
    window.require = function(m) { return {}; };
  }

  // ══════════════════════════════════════════════
  //  网易云 API (纯 fetch, 无 ES module)
  // ══════════════════════════════════════════════
  var NC_BASE = 'https://music.163.com';
  var NC_API = NC_BASE + '/api';
  var NC_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

  var NC_COOKIE_KEY = 'mineradio-netease-cookie';
  var QQ_COOKIE_KEY = 'mineradio-qq-cookie';

  function getNcCookie() { try { return localStorage.getItem(NC_COOKIE_KEY) || ''; } catch(e){ return ''; } }
  function setNcCookie(c) { try { localStorage.setItem(NC_COOKIE_KEY, c || ''); } catch(e){} }
  function getQqCookie() { try { return localStorage.getItem(QQ_COOKIE_KEY) || ''; } catch(e){ return ''; } }
  function setQqCookie(c) { try { localStorage.setItem(QQ_COOKIE_KEY, c || ''); } catch(e){} }

  async function ncApi(pathStr, params, opts) {
    opts = opts || {};
    var url = NC_API + pathStr;
    var body = new URLSearchParams(params).toString();
    var resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': NC_BASE,
        'Cookie': opts.cookie || '',
        'User-Agent': NC_UA
      },
      body: body
    });
    return resp.json();
  }

  // ── QQ 音乐 ──
  var QQ_CLOUD = 'https://c.y.qq.com';
  var QQ_BASE_URL = 'https://u.y.qq.com/cgi-bin';

  async function qqSearch(keywords, limit, offset) {
    var page = Math.floor((offset || 0) / (limit || 30)) + 1;
    var params = new URLSearchParams({
      _: String(Date.now()), format: 'json', inCharset: 'utf-8', outCharset: 'utf-8',
      notice: '0', platform: 'yqq.json', needNewCode: '1',
      w: keywords, zhidaqu: '1', catZhida: '1', t: '0', flag_qc: '0',
      p: String(page), n: String(limit || 30), remoteplace: 'txt.yqq.song'
    });
    var resp = await fetch(QQ_CLOUD + '/soso/fcgi-bin/client_search_cp?' + params, {
      headers: { 'Referer': 'https://y.qq.com/' }
    });
    var data = await resp.json();
    if (!data || !data.data || !data.data.song) return { code: -1, data: { song: { list: [], totalnum: 0 } } };
    return { code: 0, data: { song: { list: data.data.song.list || [], totalnum: data.data.song.totalnum || 0 } } };
  }

  async function qqSongUrl(songmid, quality) {
    quality = quality || 'M800';
    var guid = String(Math.floor(Math.random() * 10000000000));
    var reqData = {
      req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param: {
        guid: guid, songmid: [songmid], filename: [quality + songmid + '.m4a'],
        songtype: [0], uin: '0', loginflag: 1, platform: '20'
      }},
      comm: { uin: '0', format: 'json', ct: 24, cv: 0 }
    };
    var resp = await fetch(QQ_BASE_URL + '/musu.fcg?format=1&data=' + encodeURIComponent(JSON.stringify(reqData)), {
      headers: { 'Referer': 'https://y.qq.com/' }
    });
    var data = await resp.json();
    var sip = (data.req_0 && data.req_0.data && data.req_0.data.sip && data.req_0.data.sip[0]) || '';
    var purl = data.req_0 && data.req_0.data && data.req_0.data.midurlinfo && data.req_0.data.midurlinfo[0] && data.req_0.data.midurlinfo[0].purl;
    if (!purl) return { code: -1, message: 'no url' };
    return { code: 0, data: { url: sip + purl } };
  }

  async function qqLyric(songmid) {
    var params = new URLSearchParams({ songmid: songmid, format: 'json', inCharset: 'utf-8', outCharset: 'utf-8', nobase64: '1' });
    var resp = await fetch(QQ_CLOUD + '/lyric/fcgi-bin/fcg_query_lyric_new.fcg?' + params, {
      headers: { 'Referer': 'https://y.qq.com/' }
    });
    var data = await resp.json();
    if (!data || data.code !== 0) return { code: -1 };
    return { code: 0, data: { lyric: data.lyric || '', trans: data.trans || '' } };
  }

  // ── 天气电台 ──
  var WEATHER_MOOD = {
    0:['晴天 快乐','sunny day','阳光 正能量'],1:['晴朗 放松','mostly clear','微风 轻快'],
    2:['多云 思考','partly cloudy','文艺 抒情'],3:['阴天 安静','overcast','indie folk'],
    45:['雾 迷幻','fog ambient','电子 氛围'],48:['雾凇 空灵','ethereal','钢琴 纯音乐'],
    51:['毛毛雨 轻柔','drizzle soft','lo-fi chill'],53:['细雨 慵懒','rain cozy','jazz rainy day'],
    55:['绵绵雨 沉浸','steady rain','ambient rain'],61:['小雨 治愈','light rain healing','piano rain'],
    63:['中雨 驱动','moderate rain energy','indie rock'],65:['大雨 爆发','heavy rain dramatic','epic cinematic'],
    71:['小雪 浪漫','light snow romantic','winter jazz'],73:['中雪 梦幻','snow dreamy','dream pop'],
    75:['大雪 壮丽','heavy snow epic','orchestral'],80:['阵雨 清新','rain showers fresh','acoustic'],
    95:['雷暴 力量','thunderstorm power','rock anthems']
  };

  var IP_LOC_URL = 'http://ip-api.com/json/';
  var OM_FORECAST = 'https://api.open-meteo.com/v1/forecast';

  async function getIpLocation() {
    try {
      var r = await fetch(IP_LOC_URL);
      var d = await r.json();
      if (d && d.status === 'success') return { name: d.city||'未知', latitude: d.lat||31.23, longitude: d.lon||121.47, timezone: d.timezone||'Asia/Shanghai' };
    } catch(e) {}
    return { name:'上海', latitude:31.23, longitude:121.47, timezone:'Asia/Shanghai' };
  }

  async function getWeatherRadio(lat, lon, tz) {
    var loc;
    if (lat != null && lon != null) { loc = { latitude: lat, longitude: lon, timezone: tz || 'auto', name: '' }; }
    else { loc = await getIpLocation(); }
    var params = new URLSearchParams({
      latitude: String(loc.latitude), longitude: String(loc.longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m',
      hourly: 'precipitation_probability,weather_code,temperature_2m', forecast_days: '1', timezone: loc.timezone
    });
    var r = await fetch(OM_FORECAST + '?' + params);
    var f = await r.json();
    var code = (f && f.current && f.current.weather_code != null) ? f.current.weather_code : 2;
    return { location: loc, weather: { code: code, temperature: f && f.current && f.current.temperature_2m, humidity: f && f.current && f.current.relative_humidity_2m }, mood: WEATHER_MOOD[code] || WEATHER_MOOD[2] };
  }

  // ══════════════════════════════════════════════
  //  主路由: 拦截 fetch 并分发到对应 API
  // ══════════════════════════════════════════════
  var _origFetch = window.fetch;

  window.fetch = async function(input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
    var parsed;
    try { parsed = new URL(url, 'https://localhost'); } catch(e) { return _origFetch.call(window, input, init); }

    var pn = parsed.pathname;
    var q = {};
    parsed.searchParams.forEach(function(v, k) { q[k] = v; });

    var body = {};
    if (init && init.body) {
      try { body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body; } catch(e) {}
    }

    var cookie = getNcCookie();
    var qqCookie = getQqCookie();

    // ── 拦截 /api/* ──
    if (pn.startsWith('/api/')) {
      try {
        var result = await routeApi(pn, q, body, cookie, qqCookie);
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch(e) {
        console.error('[Mineradio Android] API error:', pn, e);
        return new Response(JSON.stringify({ code: -1, message: e.message }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // ── 外部请求走原生 fetch ──
    return _origFetch.call(window, input, init);
  };

  async function routeApi(pn, q, body, cookie, qqCookie) {
    // 网易云 - 搜索
    if (pn === '/api/search') {
      return ncApi('/search/get', { s: q.keywords || q.s, type: 1, limit: q.limit || 30, offset: q.offset || 0, total: 'true' });
    }
    // 网易云 - 搜索 (cloudsearch)
    if (pn === '/api/cloudsearch') {
      return ncApi('/cloudsearch/pc', { s: q.keywords || q.s, type: 1, limit: q.limit || 30, offset: q.offset || 0, total: 'true' });
    }
    // 歌曲 URL
    if (pn === '/api/song/url') {
      return ncApi('/song/enhance/player/url', { ids: JSON.stringify([q.id]), br: q.br || 999000 }, { cookie: cookie });
    }
    // 歌曲详情
    if (pn === '/api/song/detail') {
      var ids = q.ids ? JSON.parse(q.ids) : [q.id];
      return ncApi('/song/detail', { ids: JSON.stringify(ids), c: JSON.stringify(ids.map(function(id){ return {id:id}; })) }, { cookie: cookie });
    }
    // 歌词
    if (pn === '/api/lyric') {
      return ncApi('/lyric', { id: q.id }, { cookie: cookie });
    }
    // 登录
    if (pn === '/api/login/qr/key') return ncApi('/login/qr/key', { timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/login/qr/create') return ncApi('/login/qr/create', { key: q.key, qrimg: 'true', timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/login/qr/check') {
      var r = await ncApi('/login/qr/check', { key: q.key, timestamp: Date.now() }, { cookie: cookie });
      if (r && r.code === 803 && r.cookie) setNcCookie(r.cookie);
      return r;
    }
    if (pn === '/api/login/status') return ncApi('/login/status', { timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/login/cookie') {
      if (body.cookie) setNcCookie(body.cookie);
      return { ok: true, cookie: getNcCookie() };
    }
    if (pn === '/api/logout') { setNcCookie(''); return ncApi('/logout', { timestamp: Date.now() }, { cookie: cookie }); }
    // 用户
    if (pn === '/api/user/playlists') return ncApi('/user/playlist', { uid: q.uid, limit: q.limit||30, offset: q.offset||0, timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/user/account') return ncApi('/user/account', { timestamp: Date.now() }, { cookie: cookie });
    // 歌单
    if (pn === '/api/playlist/detail') return ncApi('/playlist/detail', { id: q.id, timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/playlist/tracks') return ncApi('/playlist/track/all', { id: q.id, limit: q.limit||1000, offset: q.offset||0, timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/playlist/create') return ncApi('/playlist/create', { name: q.name||body.name, timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/playlist/add-song') return ncApi('/playlist/track/add', { pid: q.pid||body.pid, tracks: q.tracks||body.tracks, timestamp: Date.now() }, { cookie: cookie });
    // 推荐
    if (pn === '/api/discover/home') {
      var p1, p2, p3;
      try { p1 = await ncApi('/personalized', { limit: 8, timestamp: Date.now() }, { cookie: cookie }); } catch(e) { p1 = null; }
      try { p2 = cookie ? await ncApi('/recommend/resource', { timestamp: Date.now() }, { cookie: cookie }) : null; } catch(e) { p2 = null; }
      try { p3 = cookie ? await ncApi('/recommend/songs', { timestamp: Date.now() }, { cookie: cookie }) : null; } catch(e) { p3 = null; }
      return { personalized: p1, recommendResource: p2, recommendSongs: p3 };
    }
    // 喜欢
    if (pn === '/api/song/like') return ncApi('/like', { id: q.id, like: String(q.like !== 'false'), timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/song/like/check') return ncApi('/song/like/check', { ids: q.ids, uid: q.uid, timestamp: Date.now() }, { cookie: cookie });
    // 歌手
    if (pn === '/api/artist/detail') return ncApi('/artist/detail', { id: q.id, timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/artist/top/song') return ncApi('/artist/top/song', { id: q.id, timestamp: Date.now() }, { cookie: cookie });
    // 评论
    if (pn === '/api/song/comments') return ncApi('/comment/music', { id: q.id, limit: q.limit||20, offset: q.offset||0, timestamp: Date.now() }, { cookie: cookie });
    // 播客
    if (pn === '/api/podcast/search') return ncApi('/search', { keywords: q.keywords, type: 1009, limit: q.limit||30, offset: q.offset||0 }, { cookie: cookie });
    if (pn === '/api/podcast/hot') return ncApi('/dj/hot', { timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/podcast/detail') return ncApi('/dj/detail', { rid: q.id, timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/podcast/programs') return ncApi('/dj/program', { rid: q.id, limit: q.limit||50, offset: q.offset||0, timestamp: Date.now() }, { cookie: cookie });
    if (pn === '/api/podcast/my') return ncApi('/dj/sublist', { timestamp: Date.now() }, { cookie: cookie });
    // QQ 音乐
    if (pn === '/api/qq/search') return qqSearch(q.keywords, Number(q.limit)||30, Number(q.offset)||0);
    if (pn === '/api/qq/song/url') return qqSongUrl(q.songmid, q.quality||'M800');
    if (pn === '/api/qq/lyric') return qqLyric(q.songmid);
    if (pn === '/api/qq/login/status') return { loggedIn: false };
    if (pn === '/api/qq/login/cookie') { if (body.cookie) setQqCookie(body.cookie); return { ok: true }; }
    if (pn === '/api/qq/logout') { setQqCookie(''); return { ok: true }; }
    // 天气
    if (pn === '/api/weather/radio') return getWeatherRadio(q.latitude ? Number(q.latitude) : null, q.longitude ? Number(q.longitude) : null, q.timezone);
    if (pn === '/api/weather/ip-location') return getIpLocation();
    // 封面
    if (pn === '/api/cover') {
      var picId = q.picId || q.id || '';
      var src = q.source || 'netease';
      var size = Number(q.size) || 300;
      var coverUrl = src === 'qq'
        ? ('https://y.qq.com/music/photo_new/T002R' + size + 'x' + size + 'M000' + picId + '.jpg')
        : ('https://p1.music.126.net/' + picId + '/' + picId + '.jpg?param=' + size + 'y' + size);
      // 封面代理: 直接 fetch 图片返回
      try {
        var imgResp = await _origFetch.call(window, coverUrl);
        return imgResp; // 直接返回图片 response
      } catch(e) {
        return new Response('', { status: 404 });
      }
    }
    // 音频代理
    if (pn === '/api/audio') {
      var audioUrl = q.url;
      if (!audioUrl) return new Response('missing url', { status: 400 });
      try {
        var audioResp = await _origFetch.call(window, audioUrl);
        return audioResp;
      } catch(e) {
        return new Response('audio fetch failed', { status: 502 });
      }
    }
    // 播客 beatmap
    if (pn === '/api/podcast/dj-beatmap') {
      return { beatmap: null, message: 'beatmap analysis not available on mobile' };
    }
    // 版本
    if (pn === '/api/app/version') return { version: '1.1.1-android', platform: 'android' };
    // 更新
    if (pn === '/api/update/latest') return { available: false };
    if (pn === '/api/update/download') return { ok: false, message: 'use app store' };
    if (pn === '/api/update/download/status') return { status: 'idle' };
    if (pn === '/api/update/patch') return { ok: false };
    if (pn === '/api/update/patch/status') return { status: 'idle' };

    console.warn('[Mineradio Android] Unhandled API:', pn);
    return { code: 404, message: 'not found: ' + pn };
  }

  // ── Electron API 兼容 ──
  window.electronAPI = {
    minimizeWindow: function(){},
    toggleMaximize: function(){},
    toggleFullscreen: function(){ document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); },
    exitFullscreen: function(){ document.exitFullscreen && document.exitFullscreen(); },
    getWindowState: async function(){ return { isMaximized:true, isFullScreen:true, isVisible:true, isFocused:true, isPrimaryDisplay:true }; },
    openNeteaseLogin: function(){ window.open('https://music.163.com/#/login','_blank','width=800,height=600'); },
    clearNeteaseLogin: function(){ localStorage.removeItem('$NC_COOKIE_KEY'); },
    openQQLogin: function(){ window.open('https://y.qq.com/n/ryqq/profile','_blank','width=800,height=600'); },
    clearQQLogin: function(){ localStorage.removeItem('$QQ_COOKIE_KEY'); },
    exportJsonFile: async function(data){
      try {
        var blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mineradio-export-' + Date.now() + '.json';
        a.click();
        return {ok:true};
      } catch(e){ return {ok:false,error:e.message}; }
    },
    importJsonFile: async function(){
      return new Promise(function(resolve){
        var input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = function(e){
          var f = e.target.files[0];
          if (!f) return resolve({ok:false,cancelled:true});
          var reader = new FileReader();
          reader.onload = function(){ try { resolve({ok:true,data:JSON.parse(reader.result)}); } catch(e){ resolve({ok:false,error:'Invalid JSON'}); } };
          reader.readAsText(f);
        };
        input.click();
      });
    },
    configureGlobalHotkeys: function(){ return {ok:false}; },
    openUpdateInstaller: function(){},
    restartApp: function(){ window.location.reload(); },
    setDesktopLyricsEnabled: function(){},
    updateDesktopLyrics: function(){},
    setDesktopLyricsDragging: function(){},
    setWallpaperEnabled: function(){},
    updateWallpaper: function(){},
    onWindowState: function(cb){ cb && cb({isMaximized:true,isFullScreen:true,isVisible:true,isFocused:true}); },
    onWindowStateUnsubscribe: function(){},
    onUpdateAvailable: function(){},
    onUpdateDownloadProgress: function(){}
  };

  // ── 触摸适配: 长按模拟右键 ──
  var _lpTimer, _lpStart;
  document.addEventListener('touchstart', function(e) {
    _lpStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    _lpTimer = setTimeout(function() {
      var ev = new MouseEvent('contextmenu', { bubbles:true, cancelable:true, clientX: _lpStart.x, clientY: _lpStart.y, button:2 });
      e.target.dispatchEvent(ev);
    }, 600);
  }, {passive:true});
  document.addEventListener('touchmove', function(e) {
    if (_lpStart && (Math.abs(e.touches[0].clientX-_lpStart.x)>10 || Math.abs(e.touches[0].clientY-_lpStart.y)>10)) clearTimeout(_lpTimer);
  }, {passive:true});
  document.addEventListener('touchend', function(){ clearTimeout(_lpTimer); }, {passive:true});

  // ── 安全区域 + 隐藏桌面控件 ──
  var s = document.createElement('style');
  s.textContent = [
    ':root{--safe-area-top:env(safe-area-inset-top,0px);--safe-area-bottom:env(safe-area-inset-bottom,0px)}',
    '#desktop-titlebar{display:none!important}',
    '.desktop-window-controls{display:none!important}',
    '.desktop-mode-btn{display:none!important}',
    '#player-bar,#control-panel{padding-bottom:max(12px,var(--safe-area-bottom))!important}'
  ].join('');
  document.head.appendChild(s);

  console.log('[Mineradio Android] Adapter ready ✓');
})();
</script>
`;

function patchIndex() {
  if (!fs.existsSync(SRC)) {
    console.error('❌ Source not found:', SRC);
    process.exit(1);
  }

  let html = fs.readFileSync(SRC, 'utf-8');

  // 1. 修改 viewport
  html = html.replace(
    /<meta name="viewport"[^>]*>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'
  );

  // 2. 在 <head> 最开头注入 (紧跟 <head> 之后，确保在所有其他脚本之前)
  var headOpen = html.indexOf('<head>');
  if (headOpen > -1) {
    html = html.slice(0, headOpen + 6) + '\n' + ANDROID_ADAPTER + '\n' + html.slice(headOpen + 6);
  }

  // 3. 写入
  var destDir = path.dirname(DEST);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(DEST, html, 'utf-8');
  console.log('✅ Patched index.html → ' + DEST + ' (' + Math.round(fs.statSync(DEST).size/1024) + ' KB)');

  // 4. 复制 vendor
  var vendorSrc = path.join(BASE, 'public', 'vendor');
  var vendorDest = path.join(__dirname, '..', 'public', 'vendor');
  if (fs.existsSync(vendorSrc)) { copyDir(vendorSrc, vendorDest); console.log('✅ Copied vendor/'); }

  // 5. 复制 assets
  var assetsSrc = path.join(BASE, 'public', 'assets');
  var assetsDest = path.join(__dirname, '..', 'public', 'assets');
  if (fs.existsSync(assetsSrc)) { copyDir(assetsSrc, assetsDest); console.log('✅ Copied assets/'); }

  // 6. 复制默认存档
  var archiveSrc = path.join(BASE, 'public', 'default-user-fx-archive.json');
  if (fs.existsSync(archiveSrc)) {
    fs.copyFileSync(archiveSrc, path.join(__dirname, '..', 'public', 'default-user-fx-archive.json'));
    console.log('✅ Copied default-user-fx-archive.json');
  }

  console.log('\n🎉 Frontend patch complete!');
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (var entry of fs.readdirSync(src)) {
    var sp = path.join(src, entry), dp = path.join(dest, entry);
    if (fs.statSync(sp).isDirectory()) copyDir(sp, dp); else fs.copyFileSync(sp, dp);
  }
}

patchIndex();
