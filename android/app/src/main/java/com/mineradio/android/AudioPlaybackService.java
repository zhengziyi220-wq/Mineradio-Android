package com.mineradio.android;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.Nullable;
import androidx.media3.common.Player;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * 音频播放前台服务
 * 确保应用切到后台后仍能继续播放，并显示通知栏控制
 */
public class AudioPlaybackService extends MediaSessionService {

    private static final String CHANNEL_ID = "mineradio_playback";
    private static final int NOTIFICATION_ID = 1001;

    @Nullable
    private MediaSession mediaSession;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Mineradio 播放",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("音乐播放控制");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    /** 由 Capacitor 插件设置 MediaSession */
    public void setMediaSession(MediaSession session) {
        this.mediaSession = session;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Player player = mediaSession != null ? mediaSession.getPlayer() : null;
        if (player != null && !player.isPlaying() && player.getPlaybackState() != Player.STATE_BUFFERING) {
            // 用户划掉应用且没有在播放 → 停止服务
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.getPlayer().release();
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }
}
