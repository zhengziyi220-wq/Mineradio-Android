package com.mineradio.android;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.Headers;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * HTTP 桥接插件 — 从 JS 发起原生 HTTP 请求
 * 解决 WebView 的 CORS 限制，直连网易云/QQ 音乐 API
 */
@CapacitorPlugin(name = "MineradioHttp")
public class MineradioHttpPlugin extends Plugin {

    private static final String TAG = "MineradioHttp";

    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build();

    /**
     * 发起 HTTP 请求
     * JS 调用: MineradioHttp.request({ url, method, headers, body, timeout })
     */
    @PluginMethod()
    public void request(PluginCall call) {
        String url = call.getString("url");
        String method = call.getString("method", "GET").toUpperCase();
        JSObject headersObj = call.getObject("headers", new JSObject());
        String body = call.getString("body", null);
        Integer timeout = call.getInt("timeout", 15000);

        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        // 构建请求头
        Headers.Builder hb = new Headers.Builder();
        Iterator<String> keys = headersObj.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            String val = headersObj.optString(key, "");
            if (val != null && !val.isEmpty()) {
                hb.set(key, val);
            }
        }

        // 默认 User-Agent
        if (!headersObj.has("User-Agent")) {
            hb.set("User-Agent",
                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
        }

        Request.Builder rb = new Request.Builder()
            .url(url)
            .headers(hb.build());

        // 设置请求体
        if ("POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method)) {
            MediaType mt = MediaType.parse(
                headersObj.optString("Content-Type", "application/json")
            );
            rb.method(method, body != null ? RequestBody.create(body, mt) : RequestBody.create("", mt));
        } else {
            rb.method(method, null);
        }

        // 超时覆盖
        OkHttpClient reqClient = client.newBuilder()
            .connectTimeout(timeout, TimeUnit.MILLISECONDS)
            .readTimeout(timeout, TimeUnit.MILLISECONDS)
            .build();

        reqClient.newCall(rb.build()).enqueue(new Callback() {
            @Override
            public void onFailure(Call call_, IOException e) {
                Log.e(TAG, "Request failed: " + url, e);
                call.reject("Network error: " + e.getMessage(), e);
            }

            @Override
            public void onResponse(Call call_, Response response) throws IOException {
                try (ResponseBody rb2 = response.body()) {
                    String responseBody = rb2 != null ? rb2.string() : "";
                    JSObject result = new JSObject();
                    result.put("status", response.code());
                    result.put("ok", response.isSuccessful());

                    // 响应头
                    JSObject respHeaders = new JSObject();
                    for (int i = 0; i < response.headers().size(); i++) {
                        respHeaders.put(response.headers().name(i), response.headers().value(i));
                    }
                    result.put("headers", respHeaders);
                    result.put("data", responseBody);

                    call.resolve(result);
                } catch (Exception e) {
                    call.reject("Response read error: " + e.getMessage(), e);
                }
            }
        });
    }
}
