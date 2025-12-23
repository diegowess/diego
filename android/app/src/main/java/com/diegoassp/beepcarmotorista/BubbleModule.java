package com.diegoassp.beepcarmotorista;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BubbleModule extends ReactContextBaseJavaModule {

    public BubbleModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "BubbleModule";
    }

    @ReactMethod
    public void requestOverlayPermission(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve("PERMISSION_NOT_REQUIRED");
                return;
            }

            if (!Settings.canDrawOverlays(getReactApplicationContext())) {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getReactApplicationContext().getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(intent);
                promise.resolve("PERMISSION_REQUESTED");
            } else {
                promise.resolve("PERMISSION_ALREADY_GRANTED");
            }
        } catch (Exception e) {
            promise.reject("OVERLAY_PERMISSION_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void hasOverlayPermission(Promise promise) {
        try {
            boolean hasPermission = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                    || Settings.canDrawOverlays(getReactApplicationContext());
            promise.resolve(hasPermission);
        } catch (Exception e) {
            promise.reject("CHECK_PERMISSION_ERROR", e.getMessage());
        }
    }

    @ReactMethod
public void showBubble(Promise promise) {
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && 
            !Settings.canDrawOverlays(getReactApplicationContext())) {
            promise.reject("PERMISSION_DENIED", "Permissão de overlay não concedida");
            return;
        }

        Intent intent = new Intent(getReactApplicationContext(), FloatingBubbleService.class);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getReactApplicationContext().startForegroundService(intent);
        } else {
            getReactApplicationContext().startService(intent);
        }
        
        promise.resolve("BUBBLE_SHOWN");
    } catch (Exception e) {
        promise.reject("SHOW_BUBBLE_ERROR", e.getMessage());
    }
}

    @ReactMethod
    public void hideBubble(Promise promise) {
        try {
            Intent intent = new Intent(getReactApplicationContext(), FloatingBubbleService.class);
            getReactApplicationContext().stopService(intent);
            promise.resolve("BUBBLE_HIDDEN");
        } catch (Exception e) {
            promise.reject("HIDE_BUBBLE_ERROR", e.getMessage());
        }
    }
}