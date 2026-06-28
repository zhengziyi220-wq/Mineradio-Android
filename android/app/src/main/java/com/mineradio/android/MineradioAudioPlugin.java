package com.mineradio.android;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.SessionCommand;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 音频播放 Capacitor 插件
 * 基于 Media3 ExoPlayer，支持后台播放、通知栏控制、音频焦点管理
 */
@CapacitorPlugin(name = "MineradioAudio")
public class MineradioAudioPlugin extends Plugin {

    private static final String TAG = "MineradioAudio";

    private ExoPlayer player;
    private MediaSession mediaSession;
    private AudioPlaybackService playbackService;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();
        initPlayer();
    }

    private void initPlayer() {
        Context ctx = getContext();
        if (ctx == null) return;

        player = new ExoPlayer.Builder(ctx)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .setUsage(C.USAGE_MEDIA)
                    .build(),
                true  // handleAudioFocus
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build();

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                JSObject data = new JSObject();
                switch (state) {
                    case Player.STATE_IDLE:
                        data.put("state", "idle");
                        break;
                    case Player.STATE_BUFFERING:
                        data.put("state", "buffering");
                        break;
                    case Player.STATE_READY:
                        data.put("state", "ready");
                        break;
                    case Player.STATE_ENDED:
                        data.put("state", "ended");
                        break;
                }
                data.put("isPlaying", player.isPlaying());
                notifyListeners("playbackState", data);
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                JSObject data = new JSObject();
                data.put("isPlaying", isPlaying);
                data.put("position", player.getCurrentPosition());
                data.put("duration", player.getDuration());
                notifyListeners("isPlayingChanged", data);
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                JSObject data = new JSObject();
                data.put("error", error.getMessage());
                data.put("code", error.errorCode);
                notifyListeners("playerError", data);
                Log.e(TAG, "Player error", error);
            }

            @Override
            public void onMediaItemTransition(MediaItem item, int reason) {
                JSObject data = new JSObject();
                if (item != null && item.mediaMetadata != null) {
                    data.put("title", String.valueOf(item.mediaMetadata.title));
                    data.put("artist", String.valueOf(item.mediaMetadata.artist));
                }
                data.put("reason", reason);
                notifyListeners("mediaItemTransition", data);
            }
        });

        // 创建 MediaSession
        mediaSession = new MediaSession.Builder(ctx, player).build();

        // 创建通知渠道
        createNotificationChannel(ctx);
    }

    private void createNotificationChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "mineradio_playback",
                "Mineradio 播放",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Mineradio 音乐播放控制");
            channel.setShowBadge(false);
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    /**
     * 播放音频
     * JS: MineradioAudio.play({ url, title, artist, cover, headers })
     */
    @PluginMethod()
    public void play(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String cover = call.getString("cover", "");
        JSObject headers = call.getObject("headers", new JSObject());

        if (url == null || url.isEmpty()) {
            call.reject("Audio URL is required");
            return;
        }

        mainHandler.post(() -> {
            try {
                // 构建 MediaItem
                MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
                    .setTitle(title)
                    .setArtist(artist)
                    .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC);

                if (cover != null && !cover.isEmpty()) {
                    metaBuilder.setArtworkUri(Uri.parse(cover));
                }

                MediaItem.Builder itemBuilder = new MediaItem.Builder()
                    .setUri(url)
                    .setMediaMetadata(metaBuilder.build());

                // 注意: Media3 1.2.0 不支持 MediaItem.RequestProperties
                // 请求头通过 ExoPlayer 的 HttpDataSource.Factory 设置
                // 这里简化处理，直接构建 MediaItem

                player.setMediaItem(itemBuilder.build());
                player.prepare();
                player.play();

                JSObject result = new JSObject();
                result.put("ok", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Play failed: " + e.getMessage(), e);
            }
        });
    }

    /** 暂停 */
    @PluginMethod()
    public void pause(PluginCall call) {
        mainHandler.post(() -> {
            player.pause();
            call.resolve();
        });
    }

    /** 恢复播放 */
    @PluginMethod()
    public void resume(PluginCall call) {
        mainHandler.post(() -> {
            player.play();
            call.resolve();
        });
    }

    /** 跳转 */
    @PluginMethod()
    public void seekTo(PluginCall call) {
        long position = call.getLong("position", 0L);
        mainHandler.post(() -> {
            player.seekTo(position);
            call.resolve();
        });
    }

    /** 停止 */
    @PluginMethod()
    public void stop(PluginCall call) {
        mainHandler.post(() -> {
            player.stop();
            call.resolve();
        });
    }

    /** 获取播放状态 */
    @PluginMethod()
    public void getStatus(PluginCall call) {
        mainHandler.post(() -> {
            JSObject status = new JSObject();
            status.put("isPlaying", player.isPlaying());
            status.put("position", player.getCurrentPosition());
            status.put("duration", player.getDuration());
            status.put("bufferedPosition", player.getBufferedPosition());
            status.put("volume", (double) player.getVolume());
            status.put("playbackState", player.getPlaybackState());
            status.put("repeatMode", player.getRepeatMode());
            call.resolve(status);
        });
    }

    /** 设置音量 (0.0 - 1.0) */
    @PluginMethod()
    public void setVolume(PluginCall call) {
        double volume = call.getDouble("volume", 1.0);
        mainHandler.post(() -> {
            player.setVolume((float) Math.max(0, Math.min(1, volume)));
            call.resolve();
        });
    }

    /** 设置循环模式: 0=OFF, 1=ONE, 2=ALL */
    @PluginMethod()
    public void setRepeatMode(PluginCall call) {
        int mode = call.getInt("mode", Player.REPEAT_MODE_OFF);
        mainHandler.post(() -> {
            player.setRepeatMode(mode);
            call.resolve();
        });
    }

    /** 设置播放速度 */
    @PluginMethod()
    public void setSpeed(PluginCall call) {
        float speed = call.getFloat("speed", 1.0f);
        mainHandler.post(() -> {
            player.setPlaybackSpeed(speed);
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
    }
}
