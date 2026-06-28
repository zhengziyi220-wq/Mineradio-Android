/**
 * API 桥接层 — 替代 server.js 路由
 * 将原有 /api/* 请求转发到对应的客户端 API 模块
 *
 * 原 server.js 的路由:
 *   /api/search          → netease-api.search
 *   /api/song/url        → netease-api.songUrl
 *   /api/lyric           → netease-api.getLyric
 *   /api/qq/search       → qqmusic-api.search
 *   /api/qq/song/url     → qqmusic-api.getSongUrl
 *   /api/weather/radio   → weather-api.getWeatherRadio
 *   /api/login/*         → netease-api.login*
 *   /api/user/playlists  → netease-api.userPlaylist
 *   /api/cover           → 封面代理
 *   /api/audio           → 音频代理
 *   ... 等等
 */

import neteaseApi from './netease-api.js';
import qqMusicApi from './qqmusic-api.js';
import weatherApi from './weather-api.js';

/**
 * 存储在 localStorage 的 Cookie 键名
 */
const COOKIE_KEY = 'mineradio-netease-cookie';
const QQ_COOKIE_KEY = 'mineradio-qq-cookie';

function getNcCookie() {
  try { return localStorage.getItem(COOKIE_KEY) || ''; } catch { return ''; }
}
function setNcCookie(c) {
  try { localStorage.setItem(COOKIE_KEY, c || ''); } catch {}
}
function getQqCookie() {
  try { return localStorage.getItem(QQ_COOKIE_KEY) || ''; } catch { return ''; }
}
function setQqCookie(c) {
  try { localStorage.setItem(QQ_COOKIE_KEY, c || ''); } catch {}
}

/**
 * 解析 URL 参数
 */
function parseQuery(urlStr) {
  try {
    const u = new URL(urlStr, 'http://localhost');
    const params = {};
    u.searchParams.forEach((v, k) => { params[k] = v; });
    return params;
  } catch { return {}; }
}

/**
 * 封面代理 — 返回封面图片 URL
 */
function getCoverProxyUrl(picId, size = 300, source = 'netease') {
  if (source === 'qq') {
    return qqMusicApi.getCoverUrl(picId, size);
  }
  return neteaseApi.getCoverUrl(picId, size);
}

/**
 * 主路由表
 * 拦截前端对 localhost API 的请求，分发到对应 API 模块
 */
export async function handleApiRequest(pathname, query = {}, body = {}) {
  const cookie = getNcCookie();
  const qqCookie = getQqCookie();

  try {
    // ==================== 网易云 ====================
    if (pathname === '/api/search') {
      return await neteaseApi.search(query.keywords || query.s, {
        limit: Number(query.limit) || 30,
        offset: Number(query.offset) || 0,
      });
    }

    if (pathname === '/api/song/url') {
      const data = await neteaseApi.songUrl(
        query.id,
        Number(query.br) || 999000,
        cookie
      );
      return data;
    }

    if (pathname === '/api/song/url/v1') {
      return await neteaseApi.songUrlV1(query.id, query.level || 'exhigh', cookie);
    }

    if (pathname === '/api/lyric') {
      return await neteaseApi.getLyric(query.id, cookie);
    }

    if (pathname === '/api/song/detail') {
      const ids = query.ids ? JSON.parse(query.ids) : [query.id];
      return await neteaseApi.songDetail(ids, cookie);
    }

    // ==================== 登录 ====================
    if (pathname === '/api/login/qr/key') {
      return await neteaseApi.loginQrKey(cookie);
    }

    if (pathname === '/api/login/qr/create') {
      return await neteaseApi.loginQrCreate(query.key, cookie);
    }

    if (pathname === '/api/login/qr/check') {
      const result = await neteaseApi.loginQrCheck(query.key, cookie);
      // 登录成功时保存 cookie
      if (result?.code === 803 && result.cookie) {
        setNcCookie(result.cookie);
      }
      return result;
    }

    if (pathname === '/api/login/status') {
      return await neteaseApi.loginStatus(cookie);
    }

    if (pathname === '/api/login/cookie') {
      if (body.cookie) setNcCookie(body.cookie);
      return { ok: true, cookie: getNcCookie() };
    }

    if (pathname === '/api/logout') {
      setNcCookie('');
      return await neteaseApi.logout(cookie);
    }

    // ==================== 用户 ====================
    if (pathname === '/api/user/playlists') {
      return await neteaseApi.userPlaylist(
        query.uid,
        { limit: Number(query.limit) || 30, offset: Number(query.offset) || 0 },
        cookie
      );
    }

    if (pathname === '/api/user/account') {
      return await neteaseApi.userAccount(cookie);
    }

    // ==================== 歌单 ====================
    if (pathname === '/api/playlist/detail') {
      return await neteaseApi.playlistDetail(query.id, cookie);
    }

    if (pathname === '/api/playlist/tracks') {
      return await neteaseApi.playlistTrackAll(query.id, {
        limit: Number(query.limit) || 1000,
        offset: Number(query.offset) || 0,
      }, cookie);
    }

    if (pathname === '/api/playlist/create') {
      return await neteaseApi.playlistCreate(query.name || body.name, cookie);
    }

    if (pathname === '/api/playlist/add-song') {
      return await neteaseApi.playlistTrackAdd(query.pid || body.pid, query.tracks || body.tracks, cookie);
    }

    // ==================== 推荐 ====================
    if (pathname === '/api/discover/home') {
      const [personRes, recRes, recSongsRes] = await Promise.allSettled([
        neteaseApi.personalized(8, cookie),
        cookie ? neteaseApi.recommendResource(cookie) : Promise.resolve(null),
        cookie ? neteaseApi.recommendSongs(cookie) : Promise.resolve(null),
      ]);

      return {
        personalized: personRes.status === 'fulfilled' ? personRes.value : null,
        recommendResource: recRes.status === 'fulfilled' ? recRes.value : null,
        recommendSongs: recSongsRes.status === 'fulfilled' ? recSongsRes.value : null,
      };
    }

    // ==================== 喜欢 ====================
    if (pathname === '/api/song/like') {
      return await neteaseApi.likeSong(query.id, query.like !== 'false', cookie);
    }

    if (pathname === '/api/song/like/check') {
      return await neteaseApi.likeCheck(query.ids, query.uid, cookie);
    }

    if (pathname === '/api/likelist') {
      return await neteaseApi.likeList(query.uid, cookie);
    }

    // ==================== 歌手 ====================
    if (pathname === '/api/artist/detail') {
      return await neteaseApi.artistDetail(query.id, cookie);
    }

    if (pathname === '/api/artist/top/song') {
      return await neteaseApi.artistTopSong(query.id, cookie);
    }

    if (pathname === '/api/artist/songs') {
      return await neteaseApi.artistSongs(query.id, {
        limit: Number(query.limit) || 50,
        offset: Number(query.offset) || 0,
      }, cookie);
    }

    // ==================== 评论 ====================
    if (pathname === '/api/song/comments') {
      return await neteaseApi.songComments(query.id, {
        limit: Number(query.limit) || 20,
        offset: Number(query.offset) || 0,
      }, cookie);
    }

    // ==================== 播客 ====================
    if (pathname === '/api/podcast/search') {
      return await neteaseApi.djSearch(query.keywords, {
        limit: Number(query.limit) || 30,
        offset: Number(query.offset) || 0,
      }, cookie);
    }

    if (pathname === '/api/podcast/hot') {
      return await neteaseApi.djHot(cookie);
    }

    if (pathname === '/api/podcast/detail') {
      return await neteaseApi.djDetail(query.id, cookie);
    }

    if (pathname === '/api/podcast/programs') {
      return await neteaseApi.djProgram(query.id, {
        limit: Number(query.limit) || 50,
        offset: Number(query.offset) || 0,
      }, cookie);
    }

    if (pathname === '/api/podcast/my') {
      return await neteaseApi.djSublist(cookie);
    }

    // ==================== QQ 音乐 ====================
    if (pathname === '/api/qq/search') {
      return await qqMusicApi.search(query.keywords, {
        limit: Number(query.limit) || 30,
        offset: Number(query.offset) || 0,
      });
    }

    if (pathname === '/api/qq/song/url') {
      return await qqMusicApi.getSongUrl(query.songmid, query.quality || 'M800', qqCookie);
    }

    if (pathname === '/api/qq/lyric') {
      return await qqMusicApi.getLyric(query.songmid, qqCookie);
    }

    if (pathname === '/api/qq/login/status') {
      return await qqMusicApi.checkLogin(qqCookie);
    }

    if (pathname === '/api/qq/login/cookie') {
      if (body.cookie) setQqCookie(body.cookie);
      return { ok: true, cookie: getQqCookie() };
    }

    if (pathname === '/api/qq/logout') {
      setQqCookie('');
      return { ok: true };
    }

    if (pathname === '/api/qq/user/playlists') {
      return await qqMusicApi.getUserPlaylists(query.uin, qqCookie);
    }

    // ==================== 天气 ====================
    if (pathname === '/api/weather/radio') {
      const lat = query.latitude ? Number(query.latitude) : null;
      const lon = query.longitude ? Number(query.longitude) : null;
      return await weatherApi.getWeatherRadio(lat, lon, query.timezone);
    }

    if (pathname === '/api/weather/ip-location') {
      return await weatherApi.getIpLocation();
    }

    // ==================== 封面 ====================
    if (pathname === '/api/cover') {
      const picId = query.picId || query.id;
      const source = query.source || 'netease';
      const size = Number(query.size) || 300;
      return { url: getCoverProxyUrl(picId, size, source) };
    }

    // ==================== 版本信息 ====================
    if (pathname === '/api/app/version') {
      return { version: '1.1.1-android', platform: 'android' };
    }

    // ==================== 默认 ====================
    return { code: 404, message: `API not found: ${pathname}` };

  } catch (error) {
    console.error(`API Error [${pathname}]:`, error);
    return { code: -1, message: error.message || 'Internal error' };
  }
}

/**
 * 安装 fetch 拦截器
 * 拦截前端对 /api/* 的请求并路由到对应模块
 */
export function installFetchInterceptor(baseUrl = 'http://localhost:3000') {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : input.url;
    let pathname = '';

    try {
      // 检查是否是本地 API 请求
      if (url.startsWith('/api/') || url.includes(`${baseUrl}/api/`)) {
        const u = new URL(url, baseUrl);
        pathname = u.pathname;
        const query = {};
        u.searchParams.forEach((v, k) => { query[k] = v; });

        let body = {};
        if (init?.body) {
          try {
            body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
          } catch {}
        }

        const result = await handleApiRequest(pathname, query, body);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 其他请求走原生 HTTP
      if (window.MineradioHttp && !url.startsWith('data:') && !url.startsWith('blob:')) {
        const result = await window.MineradioHttp.request({
          url,
          method: init?.method || 'GET',
          headers: init?.headers || {},
          body: init?.body || null,
          timeout: 15000,
        });
        return new Response(result.data, {
          status: result.status,
          headers: result.headers,
        });
      }
    } catch (e) {
      console.error('Fetch interceptor error:', e);
    }

    // 其他请求走原始 fetch
    return originalFetch.call(window, input, init);
  };

  console.log('[Mineradio] Fetch interceptor installed');
}

/**
 * 初始化 API 桥接层
 */
export function initApiBridge() {
  installFetchInterceptor('http://localhost:3000');
  console.log('[Mineradio] API bridge initialized');
}

export default {
  handleApiRequest,
  installFetchInterceptor,
  initApiBridge,
};
