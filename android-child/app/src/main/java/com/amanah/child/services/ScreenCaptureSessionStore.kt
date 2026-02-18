package com.amanah.child.services

import android.content.Context
import android.content.Intent

object ScreenCaptureSessionStore {
    @Volatile
    private var cachedResultCode: Int? = null

    @Volatile
    private var cachedResultData: Intent? = null

    fun save(resultCode: Int, data: Intent) {
        cachedResultCode = resultCode
        cachedResultData = Intent(data)
    }

    fun hasSession(): Boolean {
        return cachedResultCode != null && cachedResultData != null
    }

    fun buildServiceIntent(context: Context, streamMode: Boolean): Intent? {
        val resultCode = cachedResultCode ?: return null
        val data = cachedResultData ?: return null

        return Intent(context, ScreenGuardianService::class.java).apply {
            putExtra("RESULT_CODE", resultCode)
            putExtra("DATA", Intent(data))
            putExtra("STREAM_MODE", streamMode)
        }
    }
}
