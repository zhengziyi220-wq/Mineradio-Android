/**
 * QQ 音乐 API — 客户端版本
 * 通过 Capacitor 原生 HTTP 直连 QQ 音乐服务
 */

const QQ_BASE = 'https://u.y.qq.com/cgi-bin';
const QQ_CLOUD_BASE = 'https://c.y.qq.com';
const QQ_MUSIC_BASE = 'https://y.qq.com';

const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

async function nativeFetch(url, options = {}) {
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
      data: result.data,
      json: () => { try { return JSON.parse(result.data); } catch { return null; } },
      text: () => result.data,
    };
  }
  return fetch(url, options);
}

/**
 * QQ 音乐搜索
 */
export async function search(keywords, opts = {}) {
  const { limit = 30, offset = 0 } = opts;
  const page = Math.floor(offset / limit) + 1;

  const params = new URLSearchParams({
    _: String(Date.now()),
    format: 'json',
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq.json',
    needNewCode: '1',
    w: keywords,
    zhidaqu: '1',
    catZhida: '1',
    t: '0',
    flag_qc: '0',
    p: String(page),
    n: String(limit),
    remoteplace: 'txt.yqq.song',
  });

  const url = `${QQ_CLOUD_BASE}/soso/fcgi-bin/client_search_cp?${params}`;
  const resp = await nativeFetch(url, {
    headers: {
      'Referer': 'https://y.qq.com/',
      'Cookie': '',
    },
  });

  const data = resp.json();
  if (!data || !data.data || !data.data.song) {
    return { code: -1, data: { song: { list: [], totalnum: 0 } } };
  }

  return {
    code: 0,
    data: {
      song: {
        list: data.data.song.list || [],
        totalnum: data.data.song.totalnum || 0,
      },
    },
  };
}

/**
 * 获取 QQ 音乐歌曲播放 URL
 * @param {string} songmid - 歌曲 MID
 * @param {string} quality - 音质: M500=128k, M800=320k, F000=flac, RS02=OGG
 */
export async function getSongUrl(songmid, quality = 'M800', cookie = '') {
  const guid = String(Math.floor(Math.random() * 10000000000));
  const uin = '0';

  const reqData = {
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        guid,
        songmid: [songmid],
        filename: [`${quality}${songmid}.m4a`],
        songtype: [0],
        uin,
        loginflag: 1,
        platform: '20',
      },
    },
    comm: {
      uin,
      format: 'json',
      ct: 24,
      cv: 0,
    },
  };

  const params = new URLSearchParams({
    format: 'json',
    data: JSON.stringify(reqData),
  });

  const url = `${QQ_BASE}/musu.fcg?${params}`;
  const resp = await nativeFetch(url, {
    headers: {
      'Referer': 'https://y.qq.com/',
      'Cookie': cookie || '',
    },
  });

  const data = resp.json();
  if (!data?.req_0?.data?.midurlinfo?.[0]?.purl) {
    return { code: -1, message: '无法获取播放地址' };
  }

  const sip = data.req_0.data.sip?.[0] || '';
  const purl = data.req_0.data.midurlinfo[0].purl;

  return {
    code: 0,
    data: {
      url: purl ? sip + purl : '',
      quality: quality,
    },
  };
}

/**
 * 获取 QQ 音乐歌词
 */
export async function getLyric(songmid, cookie = '') {
  const params = new URLSearchParams({
    songmid,
    format: 'json',
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    nobase64: '1',
  });

  const url = `${QQ_CLOUD_BASE}/lyric/fcgi-bin/fcg_query_lyric_new.fcg?${params}`;
  const resp = await nativeFetch(url, {
    headers: {
      'Referer': 'https://y.qq.com/',
      'Cookie': cookie || '',
    },
  });

  const data = resp.json();
  if (!data || data.code !== 0) {
    return { code: -1, message: '获取歌词失败' };
  }

  return {
    code: 0,
    data: {
      lyric: data.lyric || '',
      trans: data.trans || '',
    },
  };
}

/**
 * 获取用户歌单
 */
export async function getUserPlaylists(uin, cookie = '') {
  const reqData = {
    req_0: {
      module: 'music.srfToplist.Toplist',
      method: 'GetDetail',
      param: {
        topid: 0,
        num: 100,
        from: 0,
      },
    },
  };

  const params = new URLSearchParams({
    format: 'json',
    data: JSON.stringify(reqData),
  });

  const url = `${QQ_BASE}/musu.fcg?${params}`;
  const resp = await nativeFetch(url, {
    headers: {
      'Referer': 'https://y.qq.com/',
      'Cookie': cookie || '',
    },
  });

  return resp.json();
}

/**
 * 检查 QQ 音乐登录状态
 */
export async function checkLogin(cookie = '') {
  const url = `https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile.fcg?format=json`;
  const resp = await nativeFetch(url, {
    headers: {
      'Referer': 'https://y.qq.com/',
      'Cookie': cookie || '',
    },
  });

  const data = resp.json();
  if (data?.code === 0 && data?.data?.creator) {
    return {
      loggedIn: true,
      nickname: data.data.creator.nick || '',
      uin: data.data.creator.uin || '',
    };
  }
  return { loggedIn: false };
}

/**
 * 获取封面图 URL
 */
export function getCoverUrl(albumMid, size = 300) {
  if (!albumMid) return '';
  return `https://y.qq.com/music/photo_new/T002R${size}x${size}M000${albumMid}.jpg`;
}

export default {
  search,
  getSongUrl,
  getLyric,
  getUserPlaylists,
  checkLogin,
  getCoverUrl,
};
