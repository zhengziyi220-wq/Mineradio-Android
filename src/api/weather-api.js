/**
 * 天气电台 API
 * 基于 Open-Meteo 开放接口，根据天气和位置推荐音乐
 */

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const IP_LOCATION_URL = 'http://ip-api.com/json/';

const WEATHER_MOOD_MAP = {
  // WMO Weather codes → mood keywords
  0: ['晴天 快乐', 'sunny day', '阳光 正能量', 'clear sky'],
  1: ['晴朗 放松', 'mostly clear', '微风 轻快'],
  2: ['多云 思考', 'partly cloudy', '文艺 抒情'],
  3: ['阴天 安静', 'overcast', 'indie folk'],
  45: ['雾 迷幻', 'fog ambient', '电子 氛围'],
  48: ['雾凇 空灵', 'ethereal', '钢琴 纯音乐'],
  51: ['毛毛雨 轻柔', 'drizzle soft', 'lo-fi chill'],
  53: ['细雨 慵懒', 'rain cozy', 'jazz rainy day'],
  55: ['绵绵雨 沉浸', 'steady rain', 'ambient rain'],
  61: ['小雨 治愈', 'light rain healing', 'piano rain'],
  63: ['中雨 驱动', 'moderate rain energy', 'indie rock'],
  65: ['大雨 爆发', 'heavy rain dramatic', 'epic cinematic'],
  66: ['冻雨 冷酷', 'freezing rain', 'dark ambient'],
  68: ['大冻雨 冰冷', 'heavy freezing', 'synthwave cold'],
  71: ['小雪 浪漫', 'light snow romantic', 'winter jazz'],
  73: ['中雪 梦幻', 'snow dreamy', 'dream pop'],
  75: ['大雪 壮丽', 'heavy snow epic', 'orchestral'],
  77: ['雪粒 纯净', 'snow grains', 'minimal piano'],
  80: ['阵雨 清新', 'rain showers fresh', 'acoustic'],
  81: ['中阵雨 节奏', 'moderate showers', 'pop rock'],
  82: ['暴阵雨 激烈', 'violent showers', 'metal energy'],
  85: ['小雪阵 温暖', 'snow showers cozy', 'folk warm'],
  86: ['大雪阵 壮阔', 'heavy snow showers', 'symphony'],
  95: ['雷暴 力量', 'thunderstorm power', 'rock anthems'],
  96: ['冰雹雷暴 狂野', 'hail thunder wild', 'punk energy'],
  99: ['大冰雹雷暴 极端', 'severe thunderstorm', 'industrial'],
};

async function nativeFetch(url, opts = {}) {
  if (window.MineradioHttp) {
    const result = await window.MineradioHttp.request({
      url,
      method: opts.method || 'GET',
      headers: opts.headers || {},
      timeout: opts.timeout || 10000,
    });
    return {
      ok: result.ok,
      data: result.data,
      json: () => { try { return JSON.parse(result.data); } catch { return null; } },
    };
  }
  return fetch(url, opts);
}

/**
 * IP 定位
 */
export async function getIpLocation() {
  try {
    const resp = await nativeFetch(IP_LOCATION_URL, { timeout: 5000 });
    const data = resp.json();
    if (data && data.status === 'success') {
      return {
        name: data.city || '未知',
        country: data.country || '',
        latitude: data.lat || 31.23,
        longitude: data.lon || 121.47,
        timezone: data.timezone || 'Asia/Shanghai',
      };
    }
  } catch (e) {
    console.warn('IP location failed:', e);
  }
  return {
    name: '上海',
    country: 'China',
    latitude: 31.2304,
    longitude: 121.4737,
    timezone: 'Asia/Shanghai',
  };
}

/**
 * 获取天气预报
 */
export async function getForecast(latitude, longitude, timezone = 'auto') {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
      'is_day', 'precipitation', 'weather_code', 'cloud_cover',
      'wind_speed_10m', 'wind_gusts_10m',
    ].join(','),
    hourly: 'precipitation_probability,weather_code,temperature_2m',
    forecast_days: '1',
    timezone,
  });

  const resp = await nativeFetch(`${OPEN_METEO_FORECAST}?${params}`, { timeout: 8000 });
  return resp.json();
}

/**
 * 地理编码 (城市名 → 坐标)
 */
export async function geocode(name) {
  const params = new URLSearchParams({
    name,
    count: '1',
    language: 'zh',
    format: 'json',
  });

  const resp = await nativeFetch(`${OPEN_METEO_GEOCODE}?${params}`, { timeout: 8000 });
  const data = resp.json();
  if (data?.results?.[0]) {
    const r = data.results[0];
    return {
      name: r.name,
      country: r.country || '',
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone || 'auto',
    };
  }
  return null;
}

/**
 * 根据天气代码获取音乐 mood 关键词
 */
export function getWeatherMood(weatherCode) {
  return WEATHER_MOOD_MAP[weatherCode] || WEATHER_MOOD_MAP[2];
}

/**
 * 获取天气电台完整数据 (位置 + 天气 + mood)
 */
export async function getWeatherRadio(latitude, longitude, timezone) {
  let location;
  if (latitude != null && longitude != null) {
    location = { latitude, longitude, timezone: timezone || 'auto', name: '' };
  } else {
    location = await getIpLocation();
  }

  const forecast = await getForecast(location.latitude, location.longitude, location.timezone);
  const weatherCode = forecast?.current?.weather_code ?? 2;
  const temperature = forecast?.current?.temperature_2m ?? 20;
  const mood = getWeatherMood(weatherCode);

  return {
    location,
    weather: {
      code: weatherCode,
      temperature,
      humidity: forecast?.current?.relative_humidity_2m,
      windSpeed: forecast?.current?.wind_speed_10m,
      isDay: !!forecast?.current?.is_day,
    },
    mood,
  };
}

export default {
  getIpLocation,
  getForecast,
  geocode,
  getWeatherMood,
  getWeatherRadio,
};
