
package com.amanah.child.receivers

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

/**
 * هذا المستقبل هو المسؤول عن التعامل مع صلاحية "مدير الجهاز"
 * التي تمنع الطفل من حذف التطبيق.
 */
class AmanahAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Toast.makeText(context, "تم تفعيل حماية Amanah بنجاح", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Toast.makeText(context, "تحذير: تم إيقاف حماية الجهاز!", Toast.LENGTH_LONG).show()
    }
}
