package com.amanah.child.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.amanah.child.services.RemoteCommandService

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        val shouldStart = action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED
        if (!shouldStart) return

        val prefs = context.getSharedPreferences("AmanahPrefs", Context.MODE_PRIVATE)
        val childId = prefs.getString("childDocumentId", null)
        if (childId.isNullOrBlank()) return

        val serviceIntent = Intent(context, RemoteCommandService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
