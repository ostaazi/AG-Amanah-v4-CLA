package com.amanah.childagent.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class DeviceStore(ctx: Context) {

    private val masterKey = MasterKey.Builder(ctx)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        ctx,
        "amanah_child_secure",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun savePairing(deviceId: String, parentUid: String, accessToken: String) {
        prefs.edit()
            .putString("deviceId", deviceId)
            .putString("parentUid", parentUid)
            .putString("accessToken", accessToken)
            .apply()
    }

    fun getDeviceId(): String = prefs.getString("deviceId", "") ?: ""
    fun getParentUid(): String = prefs.getString("parentUid", "") ?: ""
    fun getAccessToken(): String = prefs.getString("accessToken", "") ?: ""

    fun clear() {
        prefs.edit().clear().apply()
    }
}
