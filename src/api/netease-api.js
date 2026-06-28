/**
 * 网易云音乐 API — 客户端版本
 * 基于 NeteaseCloudMusicApi 的接口协议重写为纯 JS 调用
 * 通过 Capacitor 原生 HTTP 插件绕过 CORS
 */

const NETEASE_BASE = 'https://music.163.com';
const NETEASE_API_BASE = `${NETEASE_BASE}/api`;
const NETEASE_EAPI_BASE = `${NETEASE_BASE}/eapi`;

const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

/**
 * 发送 HTTP 请求 (通过 Capacitor 原生 HTTP)
 */
async function nativeFetch(url, options = {}) {
  // 优先使用 Capacitor 原生 HTTP 插件
  if (window.MineradioHttp) {
    const result = await window.MineradioHttp.request({
      url,
      method: options.method || 'GET',
      headers: {
        'User-Agent': DEFAULT_UA,
        ...(options.headers || {}),
      },
      body: options.body || null,
      timeout: options.timeout || 15000,
    });
    return {
      ok: result.ok,
      status: result.status,
      headers: result.headers,
      data: result.data,
      json: () => {
        try { return JSON.parse(result.data); } catch (e) { return null; }
      },
      text: () => result.data,
    };
  }

  // 降级到 fetch (WebView 内使用)
  return fetch(url, {
    ...options,
    headers: {
      'User-Agent': DEFAULT_UA,
      ...(options.headers || {}),
    },
  });
}

/**
 * 网易云 API 通用请求
 */
async function neteaseApi(path, params = {}, options = {}) {
  const url = `${NETEASE_API_BASE}${path}`;
  const body = new URLSearchParams(params).toString();

  const resp = await nativeFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': NETEASE_BASE,
      'Cookie': options.cookie || '',
      ...(options.headers || {}),
    },
    body,
    timeout: options.timeout || 15000,
  });

  const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
  return data;
}

// ===================== 搜索 =====================

/**
 * 搜索歌曲
 * @param {string} keywords - 搜索关键词
 * @param {object} opts - { limit, offset, type }
 * @returns {Promise<object>}
 */
export async function search(keywords, opts = {}) {
  const { limit = 30, offset = 0, type = 1 } = opts;
  return neteaseApi('/search/get', {
    s: keywords,
    type,
    limit,
    offset,
    total: 'true',
  });
}

/**
 * 云搜索 (更完整的搜索接口)
 */
export async function cloudsearch(keywords, opts = {}) {
  const { limit = 30, offset = 0, type = 1 } = opts;
  return neteaseApi('/cloudsearch/pc', {
    s: keywords,
    type,
    limit,
    offset,
    total: 'true',
  });
}

// ===================== 歌曲详情/URL =====================

/**
 * 获取歌曲详情
 * @param {number[]} ids - 歌曲 ID 数组
 */
export async function songDetail(ids, cookie = '') {
  return neteaseApi('/song/detail', {
    ids: JSON.stringify(ids),
    c: JSON.stringify(ids.map(id => ({ id }))),
  }, { cookie });
}

/**
 * 获取歌曲播放 URL
 * @param {number} id - 歌曲 ID
 * @param {number} br - 码率 (999000 = 无损)
 */
export async function songUrl(id, br = 999000, cookie = '') {
  return neteaseApi('/song/enhance/player/url', {
    ids: JSON.stringify([id]),
    br,
  }, { cookie });
}

/**
 * 获取歌曲播放 URL (v1 接口)
 */
export async function songUrlV1(id, level = 'exhigh', cookie = '') {
  return neteaseApi('/song/url/v1', {
    id,
    level,
    encodeType: 'flac',
  }, { cookie });
}

// ===================== 歌词 =====================

/**
 * 获取歌词
 * @param {number} id - 歌曲 ID
 */
export async function getLyric(id, cookie = '') {
  return neteaseApi('/lyric', { id }, { cookie });
}

// ===================== 登录 =====================

/**
 * 获取二维码登录 key
 */
export async function loginQrKey(cookie = '') {
  return neteaseApi('/login/qr/key', { timestamp: Date.now() }, { cookie });
}

/**
 * 生成二维码
 */
export async function loginQrCreate(key, cookie = '') {
  return neteaseApi('/login/qr/create', {
    key,
    qrimg: 'true',
    timestamp: Date.now(),
  }, { cookie });
}

/**
 * 检查二维码扫描状态
 * 800=过期, 801=等待扫码, 802=已扫码待确认, 803=登录成功
 */
export async function loginQrCheck(key, cookie = '') {
  return neteaseApi('/login/qr/check', {
    key,
    timestamp: Date.now(),
  }, { cookie });
}

/**
 * 获取登录状态
 */
export async function loginStatus(cookie = '') {
  return neteaseApi('/login/status', { timestamp: Date.now() }, { cookie });
}

/**
 * 退出登录
 */
export async function logout(cookie = '') {
  return neteaseApi('/logout', { timestamp: Date.now() }, { cookie });
}

/**
 * 获取用户账号信息
 */
export async function userAccount(cookie = '') {
  return neteaseApi('/user/account', { timestamp: Date.now() }, { cookie });
}

// ===================== 歌单 =====================

/**
 * 获取用户歌单
 */
export async function userPlaylist(uid, opts = {}, cookie = '') {
  const { limit = 30, offset = 0 } = opts;
  return neteaseApi('/user/playlist', {
    uid,
    limit,
    offset,
    timestamp: Date.now(),
  }, { cookie });
}

/**
 * 获取歌单详情
 */
export async function playlistDetail(id, cookie = '') {
  return neteaseApi('/playlist/detail', { id, timestamp: Date.now() }, { cookie });
}

/**
 * 获取歌单所有歌曲
 */
export async function playlistTrackAll(id, opts = {}, cookie = '') {
  const { limit = 1000, offset = 0 } = opts;
  return neteaseApi('/playlist/track/all', {
    id,
    limit,
    offset,
    timestamp: Date.now(),
  }, { cookie });
}

/**
 * 创建歌单
 */
export async function playlistCreate(name, cookie = '') {
  return neteaseApi('/playlist/create', {
    name,
    timestamp: Date.now(),
  }, { cookie });
}

/**
 * 添加歌曲到歌单
 */
export async function playlistTrackAdd(pid, tracks, cookie = '') {
  return neteaseApi('/playlist/track/add', {
    pid,
    tracks: typeof tracks === 'string' ? tracks : JSON.stringify(tracks),
    timestamp: Date.now(),
  }, { cookie });
}

// ===================== 推荐 =====================

/**
 * 个性化推荐歌单
 */
export async function personalized(limit = 8, cookie = '') {
  return neteaseApi('/personalized', { limit, timestamp: Date.now() }, { cookie });
}

/**
 * 推荐资源 (登录后)
 */
export async function recommendResource(cookie = '') {
  return neteaseApi('/recommend/resource', { timestamp: Date.now() }, { cookie });
}

/**
 * 每日推荐歌曲 (登录后)
 */
export async function recommendSongs(cookie = '') {
  return neteaseApi('/recommend/songs', { timestamp: Date.now() }, { cookie });
}

// ===================== 喜欢/收藏 =====================

/**
 * 喜欢歌曲
 */
export async function likeSong(id, like = true, cookie = '') {
  return neteaseApi('/like', {
    id,
    like: String(like),
    timestamp: Date.now(),
  }, { cookie });
}

/**
 * 获取喜欢列表
 */
export async function likeList(uid, cookie = '') {
  return neteaseApi('/likelist', { uid, timestamp: Date.now() }, { cookie });
}

/**
 * 检查歌曲是否已喜欢
 */
export async function likeCheck(ids, uid, cookie = '') {
  return neteaseApi('/song/like/check', {
    ids: typeof ids === 'string' ? ids : JSON.stringify(ids),
    uid,
    timestamp: Date.now(),
  }, { cookie });
}

// ===================== 歌手 =====================

/**
 * 获取歌手详情
 */
export async function artistDetail(id, cookie = '') {
  return neteaseApi('/artist/detail', { id, timestamp: Date.now() }, { cookie });
}

/**
 * 获取歌手热门歌曲
 */
export async function artistTopSong(id, cookie = '') {
  return neteaseApi('/artist/top/song', { id, timestamp: Date.now() }, { cookie });
}

/**
 * 获取歌手歌曲列表
 */
export async function artistSongs(id, opts = {}, cookie = '') {
  const { limit = 50, offset = 0, order = 'hot' } = opts;
  return neteaseApi('/artist/songs', {
    id,
    limit,
    offset,
    order,
    timestamp: Date.now(),
  }, { cookie });
}

// ===================== 评论 =====================

/**
 * 获取歌曲评论
 */
export async function songComments(id, opts = {}, cookie = '') {
  const { limit = 20, offset = 0 } = opts;
  return neteaseApi('/comment/music', {
    id,
    limit,
    offset,
    timestamp: Date.now(),
  }, { cookie });
}

// ===================== 播客/DJ =====================

/**
 * 播客搜索
 */
export async function djSearch(keywords, opts = {}, cookie = '') {
  const { limit = 30, offset = 0 } = opts;
  return neteaseApi('/search', {
    keywords,
    type: 1009,
    limit,
    offset,
  }, { cookie });
}

/**
 * 热门播客
 */
export async function djHot(cookie = '') {
  return neteaseApi('/dj/hot', { timestamp: Date.now() }, { cookie });
}

/**
 * 播客详情
 */
export async function djDetail(id, cookie = '') {
  return neteaseApi('/dj/detail', { rid: id, timestamp: Date.now() }, { cookie });
}

/**
 * 播客节目列表
 */
export async function djProgram(id, opts = {}, cookie = '') {
  const { limit = 50, offset = 0 } = opts;
  return neteaseApi('/dj/program', {
    rid: id,
    limit,
    offset,
    timestamp: Date.now(),
  }, { cookie });
}

/**
 * 订阅的播客列表
 */
export async function djSublist(cookie = '') {
  return neteaseApi('/dj/sublist', { timestamp: Date.now() }, { cookie });
}

// ===================== 封面代理 =====================

/**
 * 获取封面 URL (网易云)
 */
export function getCoverUrl(picId, size = 300) {
  if (!picId) return '';
  return `https://p1.music.126.net/${picId}/${picId}.jpg?param=${size}y${size}`;
}

/**
 * 获取高斯模糊背景封面
 */
export function getBlurCoverUrl(picId) {
  return getCoverUrl(picId, 600);
}

export default {
  search,
  cloudsearch,
  songDetail,
  songUrl,
  songUrlV1,
  getLyric,
  loginQrKey,
  loginQrCreate,
  loginQrCheck,
  loginStatus,
  logout,
  userAccount,
  userPlaylist,
  playlistDetail,
  playlistTrackAll,
  playlistCreate,
  playlistTrackAdd,
  personalized,
  recommendResource,
  recommendSongs,
  likeSong,
  likeList,
  likeCheck,
  artistDetail,
  artistTopSong,
  artistSongs,
  songComments,
  djSearch,
  djHot,
  djDetail,
  djProgram,
  djSublist,
  getCoverUrl,
  getBlurCoverUrl,
};
