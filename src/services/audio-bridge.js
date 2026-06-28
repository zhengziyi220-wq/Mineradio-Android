/**
 * 音频桥接层
 * 将 HTML5 Audio API 调用转发到 Android 原生 ExoPlayer
 * 支持后台播放、通知栏控制、音频焦点管理
 *
 * 用法:
 *   import { AudioBridge } from './audio-bridge.js';
 *   const audio = new AudioBridge();
 *   await audio.play({ url, title, artist, cover });
 *
 * 兼容原有 HTML5 Audio 接口:
 *   audio.src, audio.volume, audio.currentTime, audio.duration
 *   audio.play(), audio.pause(), audio.seekTo()
 */

export class AudioBridge {
  constructor() {
    this._isNative = !!window.MineradioAudio;
    this._audio = null;       // HTML5 Audio fallback
    this._listeners = {};
    this._state = {
      isPlaying: false,
      position: 0,
      duration: 0,
      buffered: 0,
      volume: 1.0,
      src: '',
    };

    if (!this._isNative) {
      this._initHTML5Audio();
    }

    this._startPositionPoller();
  }

  // ==================== 公开接口 ====================

  get isPlaying() {
    return this._state.isPlaying;
  }

  get currentTime() {
    return this._state.position / 1000; // ms → s
  }

  set currentTime(sec) {
    this.seekTo(sec * 1000);
  }

  get duration() {
    return this._state.duration / 1000; // ms → s
  }

  get volume() {
    return this._state.volume;
  }

  set volume(v) {
    this._state.volume = v;
    if (this._isNative) {
      window.MineradioAudio.setVolume({ volume: v });
    } else if (this._audio) {
      this._audio.volume = v;
    }
  }

  get src() {
    return this._state.src;
  }

  /**
   * 播放音频
   * @param {object} opts - { url, title, artist, cover, headers }
   */
  async play(opts = {}) {
    const url = typeof opts === 'string' ? opts : opts.url;
    if (!url) throw new Error('Audio URL is required');

    this._state.src = url;

    if (this._isNative) {
      return window.MineradioAudio.play({
        url,
        title: opts.title || '',
        artist: opts.artist || '',
        cover: opts.cover || '',
        headers: opts.headers || {},
      });
    }

    // HTML5 Audio fallback
    if (this._audio) {
      this._audio.src = url;
      return this._audio.play();
    }
  }

  pause() {
    if (this._isNative) {
      return window.MineradioAudio.pause();
    }
    if (this._audio) this._audio.pause();
  }

  resume() {
    if (this._isNative) {
      return window.MineradioAudio.resume();
    }
    if (this._audio) this._audio.play();
  }

  async seekTo(positionMs) {
    if (this._isNative) {
      return window.MineradioAudio.seekTo({ position: positionMs });
    }
    if (this._audio) {
      this._audio.currentTime = positionMs / 1000;
    }
  }

  stop() {
    if (this._isNative) {
      return window.MineradioAudio.stop();
    }
    if (this._audio) {
      this._audio.pause();
      this._audio.currentTime = 0;
    }
  }

  async setSpeed(speed) {
    if (this._isNative) {
      return window.MineradioAudio.setSpeed({ speed });
    }
    if (this._audio) {
      this._audio.playbackRate = speed;
    }
  }

  async setRepeatMode(mode) {
    if (this._isNative) {
      return window.MineradioAudio.setRepeatMode({ mode });
    }
    if (this._audio) {
      this._audio.loop = mode === 1;
    }
  }

  /**
   * 获取当前播放状态
   */
  async getStatus() {
    if (this._isNative) {
      const status = await window.MineradioAudio.getStatus();
      this._state.isPlaying = status.isPlaying;
      this._state.position = status.position;
      this._state.duration = status.duration;
      return status;
    }
    return {
      isPlaying: this._state.isPlaying,
      position: this._audio ? this._audio.currentTime * 1000 : 0,
      duration: this._audio ? this._audio.duration * 1000 : 0,
    };
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    return this;
  }

  // ==================== 内部实现 ====================

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.error('AudioBridge listener error:', e); }
    });
  }

  _initHTML5Audio() {
    this._audio = new Audio();
    this._audio.crossOrigin = 'anonymous';

    this._audio.addEventListener('play', () => {
      this._state.isPlaying = true;
      this._emit('isPlayingChanged', { isPlaying: true });
    });

    this._audio.addEventListener('pause', () => {
      this._state.isPlaying = false;
      this._emit('isPlayingChanged', { isPlaying: false });
    });

    this._audio.addEventListener('ended', () => {
      this._state.isPlaying = false;
      this._emit('playbackState', { state: 'ended' });
    });

    this._audio.addEventListener('timeupdate', () => {
      this._state.position = this._audio.currentTime * 1000;
      this._state.duration = (this._audio.duration || 0) * 1000;
    });

    this._audio.addEventListener('error', (e) => {
      this._emit('playerError', { error: e.message || 'Audio playback error' });
    });
  }

  _startPositionPoller() {
    // 定期同步原生播放器状态
    setInterval(async () => {
      if (!this._isNative || !this._state.isPlaying) return;
      try {
        const status = await window.MineradioAudio.getStatus();
        this._state.isPlaying = status.isPlaying;
        this._state.position = status.position;
        this._state.duration = status.duration;
      } catch {}
    }, 500);
  }
}

// 单例导出
export const audioBridge = new AudioBridge();
export default audioBridge;
