
package com.amanah.child

import android.Manifest
import android.app.Activity
import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.RingtoneManager
import android.media.projection.MediaProjectionManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.VpnService
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.provider.Settings
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.amanah.child.receivers.AmanahAdminReceiver
import com.amanah.child.services.AppUsageTrackerService
import com.amanah.child.services.DeviceHealthReporterService
import com.amanah.child.services.DnsFilterVpnService
import com.amanah.child.services.LiveMediaStreamService
import com.amanah.child.services.RemoteCommandService
import com.amanah.child.services.ScreenCaptureSessionStore
import com.amanah.child.services.ScreenGuardianService
import com.amanah.child.services.TamperDetectionService
import com.amanah.child.services.VulnerabilityScannerService
import com.amanah.child.utils.OfflineUnlockManager
import com.amanah.child.utils.SecurityCortex
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.Timestamp
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.*

class MainActivity : AppCompatActivity() {
    companion object {
        private val PAIRING_KEY_PATTERN = Regex("^[A-Za-z0-9]{6,12}$")
    }

    private lateinit var statusText: TextView
    private lateinit var shieldIcon: ImageView
    private lateinit var pairingSection: LinearLayout
    private lateinit var protectedSection: LinearLayout
    private lateinit var lockOverlay: FrameLayout
    private lateinit var offlineUnlockCodeInput: EditText
    private lateinit var offlineUnlockButton: Button
    private lateinit var offlineUnlockStatus: TextView
    private lateinit var btnStartProtection: Button
    private val pairingPollHandler = Handler(Looper.getMainLooper())
    private var pairingApprovalPollRunnable: Runnable? = null
    
    private val db by lazy { FirebaseFirestore.getInstance() }
    private val auth by lazy { FirebaseAuth.getInstance() }
    private var commandListener: ListenerRegistration? = null
    private var lockStateReceiver: BroadcastReceiver? = null
    
    private var preventDeviceLockEnabled = false
    private var lastLockRequested = false
    private var lastScreenshotRequested = false
    private var lastSirenRequested = false
    private val lastCommandTimestamps = mutableMapOf<String, Long>()
    private val PERMISSION_REQUEST_CODE = 100
    private val SCREEN_CAPTURE_REQUEST_CODE = 200
    private val SCAN_QR_REQUEST_CODE = 300
    private val DNS_VPN_REQUEST_CODE = 400

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("AmanahMain", "onCreate started")
        try {
            setContentView(R.layout.activity_main)
            Log.d("AmanahMain", "setContentView finished")
            
            SecurityCortex.init(this)

            statusText = findViewById(R.id.tvStatus)
            shieldIcon = findViewById(R.id.ivShield)
            pairingSection = findViewById(R.id.sectionPairing)
            protectedSection = findViewById(R.id.sectionProtected)
            lockOverlay = findViewById(R.id.lockOverlay)
            offlineUnlockCodeInput = findViewById(R.id.etOfflineUnlockCode)
            offlineUnlockButton = findViewById(R.id.btnOfflineUnlock)
            offlineUnlockStatus = findViewById(R.id.tvOfflineUnlockStatus)
            configureLockOverlayBlocking()
            configureOfflineUnlockUi()
            registerLockStateReceiver()
            syncLockOverlayFromPrefs()
            
            btnStartProtection = findViewById(R.id.btnStartProtection)
            btnStartProtection.setOnClickListener { getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit().putBoolean("pendingStreamMode", false).apply(); requestScreenCapture() }

            ensureFirebaseAuth()
            checkAndRequestPermissions()
            checkUsageStatsPermission()
            checkBatteryOptimization()
            checkPairingStatus()
            handleForceLockIntent(intent)
            handleDnsVpnPermissionIntent(intent)

            findViewById<Button>(R.id.btnEnableAccessibility).setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                Toast.makeText(this, "فعّل Amanah Shield للرصد الحقيقي", Toast.LENGTH_LONG).show()
            }

            findViewById<Button>(R.id.btnResetPairing).setOnClickListener {
                clearStoredPairingState(
                    reason = "manual_reset",
                    userMessage = "تمت إعادة تعيين الربط على هذا الجهاز. يمكنك الربط من جديد."
                )
            }

            findViewById<Button>(R.id.btnSubmitPairing).setOnClickListener {
                val etKey = findViewById<EditText>(R.id.etPairingKey)
                val key = etKey.text.toString().trim()
                if (isValidPairingKey(key)) {
                    performCloudPairing(key)
                } else {
                    Toast.makeText(this, "يرجى إدخال مفتاح ربط صحيح من 6 إلى 12 حرفًا أو رقمًا", Toast.LENGTH_SHORT).show()
                }
            }

            findViewById<ImageButton>(R.id.btnScanQR).setOnClickListener {
                val intent = Intent(this, QRScannerActivity::class.java)
                startActivityForResult(intent, SCAN_QR_REQUEST_CODE)
            }
        } catch (e: Exception) {
            Log.e("AmanahMain", "Fatal error", e)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            setIntent(intent)
            handleForceLockIntent(intent)
            handleDnsVpnPermissionIntent(intent)
        }
    }

    override fun onResume() {
        super.onResume()
        syncLockOverlayFromPrefs()
    }

    override fun onDestroy() {
        commandListener?.remove()
        pairingApprovalPollRunnable?.let { pairingPollHandler.removeCallbacks(it) }
        unregisterLockStateReceiver()
        super.onDestroy()
    }

    private fun handleForceLockIntent(incomingIntent: Intent) {
        if (incomingIntent.getBooleanExtra("FORCE_LOCK", false)) {
            // Ensure lock state is persisted so syncLockOverlayFromPrefs won't override
            getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                .putBoolean("deviceLockActive", true)
                .apply()
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            } else {
                @Suppress("DEPRECATION")
                window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
                @Suppress("DEPRECATION")
                window.addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
            }
            updateLockUI(true)
            // Consume the extra so it doesn't re-fire
            incomingIntent.removeExtra("FORCE_LOCK")
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (lockOverlay.visibility == View.VISIBLE) {
            // Block back press when device is locked
            return
        }
        super.onBackPressed()
    }

    private fun requestScreenCapture() {
        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(mpm.createScreenCaptureIntent(), SCREEN_CAPTURE_REQUEST_CODE)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == DNS_VPN_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK) {
                startDnsFilteringService(DnsFilterVpnService.ACTION_APPLY_POLICY)
                Toast.makeText(this, "DNS filtering activated", Toast.LENGTH_SHORT).show()
                writeOperationalAlert(
                    platform = "DNS Filter",
                    content = "DNS filtering VPN permission granted and protection activated.",
                    severity = "LOW"
                )
            } else {
                Toast.makeText(
                    this,
                    "VPN permission is required for DNS filtering",
                    Toast.LENGTH_LONG
                ).show()
                writeOperationalAlert(
                    platform = "DNS Filter",
                    content = "DNS filtering permission request was denied on child device.",
                    severity = "MEDIUM"
                )
            }
            return
        }

        if (requestCode == SCAN_QR_REQUEST_CODE && resultCode == Activity.RESULT_OK) {
            val result = data?.getStringExtra("SCAN_RESULT")
            if (result != null && result.startsWith("AMANAH_PAIRING:")) {
                val key = result.substringAfter("AMANAH_PAIRING:")
                findViewById<EditText>(R.id.etPairingKey).setText(key)
                performCloudPairing(key)
            }
        }
        
        if (requestCode == SCREEN_CAPTURE_REQUEST_CODE && resultCode == Activity.RESULT_OK && data != null) {
            ScreenCaptureSessionStore.save(resultCode, data)
            val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
            val pendingStreamMode = prefs.getBoolean("pendingStreamMode", false)
            prefs.edit()
                .putBoolean("pendingStreamMode", false)
                .putBoolean("visualMonitoringEnabled", true)
                .apply()
            val serviceIntent = ScreenCaptureSessionStore.buildServiceIntent(this, streamMode = pendingStreamMode)
            if (serviceIntent != null) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(serviceIntent)
                    else startService(serviceIntent)
                    btnStartProtection.text = "الرقابة البصرية نشطة ✅"
                    btnStartProtection.isEnabled = false
                } catch (e: Exception) {
                    Log.e("AmanahMain", "Failed to start ScreenGuardian: ${e.message}")
                    Toast.makeText(this, "فشل تشغيل الرقابة البصرية. حاول مرة أخرى.", Toast.LENGTH_LONG).show()
                    prefs.edit().putBoolean("visualMonitoringEnabled", false).apply()
                }
            }
        } else if (requestCode == SCREEN_CAPTURE_REQUEST_CODE && resultCode != Activity.RESULT_OK) {
            Toast.makeText(this, "يجب منح إذن التقاط الشاشة لتفعيل الرقابة البصرية", Toast.LENGTH_LONG).show()
        }
    }

    private fun handleDnsVpnPermissionIntent(incomingIntent: Intent) {
        if (!incomingIntent.getBooleanExtra("REQUEST_DNS_VPN_PERMISSION", false)) return

        try {
            val prepIntent = VpnService.prepare(this)
            if (prepIntent != null) {
                startActivityForResult(prepIntent, DNS_VPN_REQUEST_CODE)
            } else {
                startDnsFilteringService(DnsFilterVpnService.ACTION_APPLY_POLICY)
            }
        } catch (e: Exception) {
            Log.w("AmanahMain", "Failed to request VPN permission for DNS filtering: ${e.message}")
        } finally {
            incomingIntent.removeExtra("REQUEST_DNS_VPN_PERMISSION")
        }
    }

    private fun startDnsFilteringService(action: String) {
        val intent = Intent(this, DnsFilterVpnService::class.java).apply { this.action = action }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != PERMISSION_REQUEST_CODE) return

        val fineGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted && !coarseGranted) {
            Toast.makeText(
                this,
                "يرجى منح صلاحية الموقع لعرض الموقع الجغرافي الحقيقي للطفل.",
                Toast.LENGTH_LONG
            ).show()
        }
        val cameraGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        if (!cameraGranted) {
            Toast.makeText(
                this,
                "يرجى منح صلاحية الكاميرا لتفعيل البث المباشر من كاميرا الطفل.",
                Toast.LENGTH_LONG
            ).show()
        }
        val micGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        if (!micGranted) {
            Toast.makeText(
                this,
                "يرجى منح صلاحية الميكروفون لتفعيل البث الصوتي المباشر.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun ensureFirebaseAuth(onComplete: (() -> Unit)? = null) {
        if (auth.currentUser == null) {
            Log.d("AmanahAuth", "Starting anonymous sign-in...")
            auth.signInAnonymously().addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    Log.d("AmanahAuth", "Anonymous Authentication Successful")
                    onComplete?.invoke()
                } else {
                    Log.e("AmanahAuth", "Authentication Failed", task.exception)
                    runOnUiThread {
                        Toast.makeText(this, "لا يوجد اتصال - الحماية المحلية نشطة", Toast.LENGTH_LONG).show()
                    }
                    // Retry auth in background (30s) - local monitoring continues without auth
                    Handler(Looper.getMainLooper()).postDelayed({
                        ensureFirebaseAuth(onComplete)
                    }, 30_000L)
                }
            }
        } else {
            onComplete?.invoke()
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf<String>()
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
        permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        permissions.add(Manifest.permission.CAMERA)
        permissions.add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val fineGranted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val backgroundGranted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            if (fineGranted && !backgroundGranted) {
                permissions.add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
        }
        val neededPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (neededPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, neededPermissions.toTypedArray(), PERMISSION_REQUEST_CODE)
        }

        val adminComponent = ComponentName(this, AmanahAdminReceiver::class.java)
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isAdminActive(adminComponent)) {
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "يجب تفعيل هذه الصلاحية لمنع حذف التطبيق وحماية الطفل.")
            startActivity(intent)
        }
    }

    private fun checkUsageStatsPermission() {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName)
        } else {
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName)
        }
        if (mode != AppOpsManager.MODE_ALLOWED) {
            Toast.makeText(this, "يرجى منح إذن الوصول لبيانات الاستخدام", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }
    }

    private fun checkBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = android.net.Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    Log.w("AmanahBattery", "Direct ignore request failed, redirecting to settings")
                    startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                }
            }
        }
    }

    private fun checkPairingStatus() {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val childId = prefs.getString("childDocumentId", null)
        val parentId = prefs.getString("parentId", null)
        if (childId.isNullOrBlank() || parentId.isNullOrBlank()) {
            showPairingUi("بانتظار الربط...")
            return
        }

        statusText.text = "جاري التحقق من الربط..."
        ensureFirebaseAuth {
            validateStoredPairing(parentId, childId)
        }
    }

    private fun validateStoredPairing(parentId: String, childId: String) {
        db.collection("children").document(childId).get()
            .addOnSuccessListener { snapshot ->
                if (!snapshot.exists()) {
                    clearStoredPairingState(
                        reason = "child_doc_missing",
                        userMessage = "تم العثور على ربط محلي قديم وغير صالح. يرجى الربط من جديد."
                    )
                    return@addOnSuccessListener
                }

                val remoteParentId = snapshot.getString("parentId")
                if (remoteParentId.isNullOrBlank() || remoteParentId != parentId) {
                    clearStoredPairingState(
                        reason = "parent_mismatch",
                        userMessage = "بيانات الربط المحلية لا تطابق حالة الخادم. يرجى الربط من جديد."
                    )
                    return@addOnSuccessListener
                }

                showProtectedUi()
                startLocalMonitoringServices()
                restoreVisualMonitoringState()
                claimDeviceOwnership(childId)
                startRemoteCommandService()
            }
            .addOnFailureListener { e ->
                Log.w("AmanahPairing", "Stored pairing validation failed: ${e.message}")
                // Claim ownership even on read failure - this may fix the read permission
                claimDeviceOwnership(childId)
                // Preserve local state on transient network/auth failures.
                showProtectedUi("تعذر التحقق من الخادم الآن. الحماية المحلية مستمرة.")
                startLocalMonitoringServices()
                restoreVisualMonitoringState()
                startRemoteCommandService()
            }
    }

    private fun showPairingUi(statusMessage: String) {
        pairingSection.visibility = View.VISIBLE
        protectedSection.visibility = View.GONE
        statusText.text = statusMessage
        btnStartProtection.text = "Enable Visual Monitoring"
        btnStartProtection.isEnabled = true
    }

    private fun showProtectedUi(statusMessage: String = "الجهاز مربوط ومحمي") {
        pairingSection.visibility = View.GONE
        protectedSection.visibility = View.VISIBLE
        statusText.text = statusMessage
    }

    private fun clearStoredPairingState(reason: String, userMessage: String? = null) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        prefs.edit()
            .remove("parentId")
            .remove("childDocumentId")
            .remove("childName")
            .remove("visualMonitoringEnabled")
            .remove("pendingStreamMode")
            .remove("liveStreamActive")
            .remove("preferredVideoSource")
            .remove("preferredAudioSource")
            .apply()

        try {
            stopService(Intent(this, RemoteCommandService::class.java))
        } catch (_: Exception) {
        }
        try {
            stopService(Intent(this, ScreenGuardianService::class.java))
        } catch (_: Exception) {
        }
        try {
            stopService(Intent(this, LiveMediaStreamService::class.java))
        } catch (_: Exception) {
        }
        try {
            stopService(Intent(this, AppUsageTrackerService::class.java))
        } catch (_: Exception) {
        }
        try {
            stopService(Intent(this, TamperDetectionService::class.java))
        } catch (_: Exception) {
        }
        try {
            stopService(Intent(this, DeviceHealthReporterService::class.java))
        } catch (_: Exception) {
        }
        try {
            stopService(Intent(this, VulnerabilityScannerService::class.java))
        } catch (_: Exception) {
        }
        try {
            stopService(Intent(this, DnsFilterVpnService::class.java))
        } catch (_: Exception) {
        }

        Log.i("AmanahPairing", "Stored pairing cleared. reason=$reason")
        showPairingUi("بانتظار الربط...")
        userMessage?.let {
            Toast.makeText(this, it, Toast.LENGTH_LONG).show()
        }
    }

    private fun restoreVisualMonitoringState() {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val wasEnabled = prefs.getBoolean("visualMonitoringEnabled", false)
        if (wasEnabled) {
            if (ScreenCaptureSessionStore.hasSession()) {
                // Session still in memory - restart the service
                val serviceIntent = ScreenCaptureSessionStore.buildServiceIntent(this, streamMode = false)
                if (serviceIntent != null) {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(serviceIntent)
                        else startService(serviceIntent)
                        btnStartProtection.text = "الرقابة البصرية نشطة ✅"
                        btnStartProtection.isEnabled = false
                        return
                    } catch (e: Exception) {
                        Log.w("AmanahMain", "Failed to restart ScreenGuardian: ${e.message}")
                    }
                }
            }
            // Session lost (app was killed) - need to re-request permission
            btnStartProtection.text = "إعادة تفعيل الرقابة البصرية"
            btnStartProtection.isEnabled = true
        }
    }

    private fun startRemoteCommandService() {
        val intent = Intent(this, RemoteCommandService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent)
        else startService(intent)
    }

    private fun startLocalMonitoringServices() {
        try { startService(Intent(this, AppUsageTrackerService::class.java)) } catch (e: Exception) {
            Log.w("AmanahMain", "AppUsageTracker start failed: ${e.message}")
        }
        try { startService(Intent(this, TamperDetectionService::class.java)) } catch (e: Exception) {
            Log.w("AmanahMain", "TamperDetection start failed: ${e.message}")
        }
        try { startService(Intent(this, DeviceHealthReporterService::class.java)) } catch (e: Exception) {
            Log.w("AmanahMain", "DeviceHealthReporter start failed: ${e.message}")
        }
        try { startService(Intent(this, VulnerabilityScannerService::class.java)) } catch (e: Exception) {
            Log.w("AmanahMain", "VulnerabilityScanner start failed: ${e.message}")
        }
    }

    private fun claimDeviceOwnership(childId: String) {
        val uid = auth.currentUser?.uid ?: return
        db.collection("children").document(childId)
            .update("deviceOwnerUid", uid)
            .addOnSuccessListener {
                Log.d("AmanahPairing", "Device ownership claimed for childId=$childId")
            }
            .addOnFailureListener { e ->
                Log.w("AmanahPairing", "Ownership claim skipped/failed: ${e.message}")
            }
    }

    private fun performCloudPairing(key: String) {
        statusText.text = "جاري الربط..."
        
        ensureFirebaseAuth {
            val uid = auth.currentUser?.uid
            Log.d("AmanahPairing", "Authenticated as UID: $uid")
            Log.d("AmanahPairing", "Fetching path: /pairingKeys/$key")

            db.enableNetwork().addOnCompleteListener {
                fetchPairingKeyDocument(key, retryOnOffline = true)
            }
        }
    }

    private fun fetchPairingKeyDocument(
        key: String,
        retryOnOffline: Boolean,
        allowRestFallback: Boolean = true
    ) {
        db.collection("pairingKeys").document(key).get()
                .addOnSuccessListener { doc ->
                    if (doc == null || !doc.exists()) {
                        handlePairingFailure()
                    } else {
                        val parentId = doc.getString("parentId")
                        val expiresAt = doc.getTimestamp("expiresAt")
                        val now = Timestamp.now()

                        if (parentId != null && (expiresAt == null || now.seconds <= expiresAt.seconds)) {
                            // Valid key! Now send the actual request
                            sendPairingRequest(parentId, key)
                        } else {
                            Toast.makeText(this, "كود منتهي الصلاحية", Toast.LENGTH_LONG).show()
                            statusText.text = "كود منتهي"
                        }
                    }
                }
                .addOnFailureListener { e ->
                    Log.e("AmanahPairing", "Fetch failed", e)
                    val rawMessage = e.message.orEmpty()
                    val isOfflineError =
                        rawMessage.contains("offline", ignoreCase = true) ||
                            rawMessage.contains("unavailable", ignoreCase = true)
                    if (isOfflineError && retryOnOffline) {
                        db.enableNetwork().addOnCompleteListener {
                            fetchPairingKeyDocument(key, retryOnOffline = false, allowRestFallback = allowRestFallback)
                        }
                        return@addOnFailureListener
                    }
                    if (isOfflineError && allowRestFallback) {
                        attemptRestPairingLookup(key)
                        return@addOnFailureListener
                    }
                    runOnUiThread {
                        val msg = when {
                            rawMessage.contains("PERMISSION_DENIED", ignoreCase = true) ->
                                "خطأ في الصلاحيات. يرجى تفعيل الدخول المجهول في Firebase."
                            isOfflineError && !isDeviceOnline() ->
                                "لا يوجد اتصال إنترنت فعلي على جهاز الطفل. تأكد من البيانات أو الواي فاي ثم أعد المحاولة."
                            isOfflineError ->
                                "تعذر الوصول إلى خادم الربط الآن رغم وجود الشبكة. أعد المحاولة بعد ثوانٍ أو افتح التطبيق مجددًا."
                            else -> "خطأ في الاتصال: ${e.message}"
                        }
                        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
                        statusText.text = "فشل الاتصال"
                    }
                }
    }

    private fun isValidPairingKey(key: String): Boolean = PAIRING_KEY_PATTERN.matches(key)

    private fun attemptRestPairingLookup(key: String) {
        statusText.text = "جاري تجربة مسار ربط بديل..."
        if (!hasNetworkConnectionHint()) {
            Toast.makeText(
                this,
                "لا يوجد اتصال شبكة ظاهر على جهاز الطفل. تأكد من البيانات أو الواي فاي ثم أعد المحاولة.",
                Toast.LENGTH_LONG
            ).show()
            statusText.text = "فشل الاتصال"
            return
        }
        val currentUser = auth.currentUser
        if (currentUser == null) {
            Toast.makeText(this, "تعذر إنشاء جلسة مصادقة قبل الربط.", Toast.LENGTH_LONG).show()
            statusText.text = "فشل الاتصال"
            return
        }

        currentUser.getIdToken(false)
            .addOnSuccessListener { tokenResult ->
                val token = tokenResult.token.orEmpty()
                Thread {
                    val result = runCatching { fetchPairingKeyViaRest(key, token) }.getOrElse { error ->
                        RestPairingLookupResult(errorMessage = error.message ?: "REST lookup failed")
                    }
                    runOnUiThread {
                        when {
                            result.parentId.isNullOrBlank() -> {
                                Toast.makeText(
                                    this,
                                    result.errorMessage ?: "تعذر الوصول إلى مفتاح الربط من الخادم.",
                                    Toast.LENGTH_LONG
                                ).show()
                                statusText.text = "فشل الاتصال"
                            }
                            result.expiresAtSeconds != null &&
                                Timestamp.now().seconds > result.expiresAtSeconds -> {
                                Toast.makeText(this, "كود منتهي الصلاحية", Toast.LENGTH_LONG).show()
                                statusText.text = "كود منتهي"
                            }
                            else -> {
                                sendPairingRequest(result.parentId, key, useRestFallback = true)
                            }
                        }
                    }
                }.start()
            }
            .addOnFailureListener { error ->
                Toast.makeText(
                    this,
                    "فشل الحصول على رمز المصادقة: ${error.message}",
                    Toast.LENGTH_LONG
                ).show()
                statusText.text = "فشل الاتصال"
            }
    }

    private fun handlePairingFailure() {
        Log.w("AmanahPairing", "Pairing key not found")
        Toast.makeText(this, "كود الربط غير موجود", Toast.LENGTH_LONG).show()
        statusText.text = "فشل الربط"
    }

    private fun sendPairingRequest(parentId: String, key: String, useRestFallback: Boolean = false) {
        val deviceName = Build.MODEL
        val requestId = auth.currentUser?.uid ?: return

        statusText.text = "بانتظار موافقة الأب..."
        
        val requestData: HashMap<String, Any> = hashMapOf(
            "parentId" to parentId,
            "childName" to "جهاز $deviceName",
            "model" to deviceName,
            "os" to "Android ${Build.VERSION.RELEASE}",
            "status" to "PENDING",
            "timestamp" to Timestamp.now()
        )

        if (useRestFallback) {
            sendPairingRequestViaRest(parentId, requestId, requestData)
            return
        }

        db.collection("parents").document(parentId)
            .collection("pairingRequests").document(requestId)
            .set(requestData)
            .addOnSuccessListener {
                listenForPairingApproval(parentId, requestId)
            }
            .addOnFailureListener { e ->
                Log.e("AmanahPairing", "Failed to send request", e)
                Toast.makeText(this, "فشل إرسال الطلب: ${e.message}", Toast.LENGTH_LONG).show()
            }
    }

    private fun sendPairingRequestViaRest(
        parentId: String,
        requestId: String,
        requestData: HashMap<String, Any>
    ) {
        val currentUser = auth.currentUser ?: return
        currentUser.getIdToken(false)
            .addOnSuccessListener { tokenResult ->
                val token = tokenResult.token.orEmpty()
                Thread {
                    val error = runCatching {
                        createPairingRequestViaRest(parentId, requestId, requestData, token)
                    }.exceptionOrNull()
                    runOnUiThread {
                        if (error != null) {
                            Toast.makeText(
                                this,
                                "فشل إرسال طلب الربط عبر المسار البديل: ${error.message}",
                                Toast.LENGTH_LONG
                            ).show()
                            statusText.text = "فشل الاتصال"
                        } else {
                            startPairingApprovalPolling(parentId, requestId)
                        }
                    }
                }.start()
            }
            .addOnFailureListener { error ->
                Toast.makeText(
                    this,
                    "تعذر إصدار رمز التحقق للربط: ${error.message}",
                    Toast.LENGTH_LONG
                ).show()
                statusText.text = "فشل الاتصال"
            }
    }

    private fun listenForPairingApproval(parentId: String, requestId: String) {
        db.collection("parents").document(parentId)
            .collection("pairingRequests").document(requestId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener
                if (snapshot == null || !snapshot.exists()) return@addSnapshotListener

                val status = snapshot.getString("status")
                val childDocId = snapshot.getString("childDocumentId")

                when (status) {
                    "APPROVED" -> {
                        if (childDocId != null) {
                            finalizePairing(parentId, childDocId)
                        }
                    }
                    "REJECTED" -> {
                        Toast.makeText(this, "تم رفض طلب الربط من قبل الأب", Toast.LENGTH_LONG).show()
                        statusText.text = "تم الرفض"
                        statusText.setTextColor(Color.RED)
                    }
                }
            }
    }

    private fun startPairingApprovalPolling(parentId: String, requestId: String) {
        pairingApprovalPollRunnable?.let { pairingPollHandler.removeCallbacks(it) }
        val runnable = object : Runnable {
            override fun run() {
                val currentUser = auth.currentUser
                if (currentUser == null) {
                    statusText.text = "فشل الاتصال"
                    return
                }

                currentUser.getIdToken(false)
                    .addOnSuccessListener { tokenResult ->
                        val token = tokenResult.token.orEmpty()
                        Thread {
                            val result = runCatching {
                                fetchPairingApprovalViaRest(parentId, requestId, token)
                            }.getOrElse { error ->
                                RestPairingApprovalResult(
                                    status = null,
                                    childDocumentId = null,
                                    errorMessage = error.message
                                )
                            }
                            runOnUiThread {
                                when (result.status) {
                                    "APPROVED" -> {
                                        pairingApprovalPollRunnable?.let { pairingPollHandler.removeCallbacks(it) }
                                        if (!result.childDocumentId.isNullOrBlank()) {
                                            finalizePairing(parentId, result.childDocumentId)
                                        } else {
                                            statusText.text = "فشل الربط"
                                        }
                                    }
                                    "REJECTED" -> {
                                        pairingApprovalPollRunnable?.let { pairingPollHandler.removeCallbacks(it) }
                                        Toast.makeText(this@MainActivity, "تم رفض طلب الربط من قبل الأب", Toast.LENGTH_LONG).show()
                                        statusText.text = "تم الرفض"
                                        statusText.setTextColor(Color.RED)
                                    }
                                    else -> pairingPollHandler.postDelayed(this, 3000L)
                                }
                            }
                        }.start()
                    }
                    .addOnFailureListener {
                        pairingPollHandler.postDelayed(this, 5000L)
                    }
            }
        }
        pairingApprovalPollRunnable = runnable
        pairingPollHandler.post(runnable)
    }

    private fun finalizePairing(parentId: String, childId: String) {
        val deviceName = Build.MODEL
        pairingApprovalPollRunnable?.let { pairingPollHandler.removeCallbacks(it) }
        getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
            .putString("parentId", parentId)
            .putString("childDocumentId", childId)
            .putString("childName", "جهاز $deviceName")
            .apply()

        Log.i("AmanahPairing", "Pairing finalized: $childId")
        Toast.makeText(this, "تم الربط والموافقة بنجاح", Toast.LENGTH_LONG).show()
        checkPairingStatus()
    }

    private fun startListeningForCommands(childId: String) {
        commandListener?.remove()
        commandListener = db.collection("children").document(childId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e("AmanahCommands", "Listener error: ${e.message}")
                    commandListener?.remove()
                    commandListener = null
                    Handler(Looper.getMainLooper()).postDelayed({
                        if (!isFinishing && !isDestroyed) {
                            // Re-claim ownership before retrying, may fix permission issues
                            claimDeviceOwnership(childId)
                            startListeningForCommands(childId)
                        }
                    }, 5000)
                    return@addSnapshotListener
                }
                if (snapshot == null || !snapshot.exists()) return@addSnapshotListener
                preventDeviceLockEnabled = snapshot.getBoolean("preventDeviceLock") ?: false

                val commands = snapshot.get("commands") as? Map<*, *> ?: emptyMap<String, Any>()

                val lockCmd = commands["lockDevice"] as? Map<*, *>
                val isLockRequested = lockCmd?.get("value") == true
                val effectiveLockRequested = if (preventDeviceLockEnabled) false else isLockRequested
                if (effectiveLockRequested && !lastLockRequested) {
                    triggerSystemLockIfPossible()
                }
                lastLockRequested = effectiveLockRequested

                val screenshotCmd = commands["takeScreenshot"] as? Map<*, *>
                val screenshotRequested = screenshotCmd?.get("value") == true
                if (screenshotRequested && !lastScreenshotRequested) {
                    performCaptureAndUpload(childId)
                }
                lastScreenshotRequested = screenshotRequested

                val sirenCmd = commands["playSiren"] as? Map<*, *>
                val sirenRequested = sirenCmd?.get("value") == true
                if (sirenRequested && !lastSirenRequested) {
                    playEmergencySiren(childId)
                }
                lastSirenRequested = sirenRequested

                val blackoutCmd = commands["lockscreenBlackout"] as? Map<*, *>
                val blackoutValue = blackoutCmd?.get("value") as? Map<*, *>
                val rawBlackoutEnabled = blackoutValue?.get("enabled") as? Boolean ?: false
                val effectiveBlackoutEnabled = if (preventDeviceLockEnabled) false else rawBlackoutEnabled
                val blackoutMessage = blackoutValue?.get("message")?.toString()?.take(240) ?: ""
                getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                    .putBoolean("deviceLockActive", effectiveLockRequested)
                    .putBoolean("blackoutActive", effectiveBlackoutEnabled)
                    .putString("blackoutMessage", if (effectiveBlackoutEnabled) blackoutMessage else "")
                    .apply()
                broadcastLockStateChanged()
                if (shouldHandleCommand(blackoutCmd, "lockscreenBlackout")) {
                    markCommandStatus(childId, "lockscreenBlackout", "EXECUTED")
                }

                val shouldShowLock = effectiveLockRequested || effectiveBlackoutEnabled
                updateLockUI(shouldShowLock)

                val videoCmd = commands["setVideoSource"] as? Map<*, *>
                if (shouldHandleCommand(videoCmd, "setVideoSource")) {
                    val source = videoCmd?.get("value")?.toString() ?: "screen"
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putString("preferredVideoSource", source)
                        .apply()
                    markCommandStatus(childId, "setVideoSource", "EXECUTED")
                }

                val audioCmd = commands["setAudioSource"] as? Map<*, *>
                if (shouldHandleCommand(audioCmd, "setAudioSource")) {
                    val source = audioCmd?.get("value")?.toString() ?: "mic"
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putString("preferredAudioSource", source)
                        .apply()
                    markCommandStatus(childId, "setAudioSource", "EXECUTED")
                }

                val startStreamCmd = commands["startLiveStream"] as? Map<*, *>
                val startStreamValue = startStreamCmd?.get("value")
                val shouldStartStream = when (startStreamValue) {
                    is Boolean -> startStreamValue
                    is Map<*, *> -> true
                    else -> false
                }
                if (shouldStartStream && shouldHandleCommand(startStreamCmd, "startLiveStream")) {
                    val cfg = startStreamCmd?.get("value") as? Map<*, *>
                    val requestedVideoSource = cfg?.get("videoSource")?.toString() ?: "screen"
                    val requestedAudioSource = cfg?.get("audioSource")?.toString() ?: "mic"
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putString("preferredVideoSource", requestedVideoSource)
                        .putString("preferredAudioSource", requestedAudioSource)
                        .apply()

                    val serviceIntent = ScreenCaptureSessionStore.buildServiceIntent(this, streamMode = true)
                    if (serviceIntent != null) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(serviceIntent)
                        else startService(serviceIntent)
                        markCommandStatus(childId, "startLiveStream", "EXECUTED", clearValue = true)
                    } else {
                        runOnUiThread {
                            getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit().putBoolean("pendingStreamMode", true).apply()
                            requestScreenCapture()
                            Toast.makeText(
                                this,
                                "Live stream needs screen permission. Confirm capture on child device.",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                        markCommandStatus(childId, "startLiveStream", "REQUESTED", clearValue = true)
                    }
                }

                val stopStreamCmd = commands["stopLiveStream"] as? Map<*, *>
                val shouldStopStream = stopStreamCmd?.get("value") == true
                if (shouldStopStream && shouldHandleCommand(stopStreamCmd, "stopLiveStream")) {
                    stopService(Intent(this, ScreenGuardianService::class.java))
                    runOnUiThread {
                        btnStartProtection.isEnabled = true
                    }
                    markCommandStatus(childId, "stopLiveStream", "EXECUTED", clearValue = true)
                }

                val walkieCmd = commands["walkieTalkieEnable"] as? Map<*, *>
                if (shouldHandleCommand(walkieCmd, "walkieTalkieEnable")) {
                    val cfg = walkieCmd?.get("value") as? Map<*, *>
                    val enabled = cfg?.get("enabled") as? Boolean ?: false
                    val source = cfg?.get("source")?.toString() ?: "mic"
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putBoolean("walkieEnabled", enabled)
                        .putString("walkieSource", source)
                        .apply()
                    markCommandStatus(childId, "walkieTalkieEnable", "EXECUTED")
                }

                val pttCmd = commands["pushToTalk"] as? Map<*, *>
                if (shouldHandleCommand(pttCmd, "pushToTalk")) {
                    val cfg = pttCmd?.get("value") as? Map<*, *>
                    val active = cfg?.get("active") as? Boolean ?: false
                    if (active) playShortBeep()
                    markCommandStatus(childId, "pushToTalk", "EXECUTED")
                }

                val blockAppCmd = commands["blockApp"] as? Map<*, *>
                if (shouldHandleCommand(blockAppCmd, "blockApp")) {
                    val cfg = blockAppCmd?.get("value") as? Map<*, *>
                    val applied = handleBlockAppCommand(cfg)
                    markCommandStatus(childId, "blockApp", if (applied) "EXECUTED" else "FAILED")
                    if (!applied) {
                        writeOperationalAlert(
                            platform = "Remote Command",
                            content = "blockApp command received but no target package could be resolved.",
                            severity = "LOW"
                        )
                    }
                }

                val cutInternetCmd = commands["cutInternet"] as? Map<*, *>
                val shouldCutInternet = cutInternetCmd?.get("value") == true
                if (shouldCutInternet && shouldHandleCommand(cutInternetCmd, "cutInternet")) {
                    writeOperationalAlert(
                        platform = "Remote Command",
                        content = "Internet cut requested and acknowledged by child app.",
                        severity = "MEDIUM"
                    )
                    markCommandStatus(childId, "cutInternet", "ACKNOWLEDGED", clearValue = true)
                }

                val blockCamMicCmd = commands["blockCameraAndMic"] as? Map<*, *>
                val shouldBlockCamMic = blockCamMicCmd?.get("value") == true
                if (shouldBlockCamMic && shouldHandleCommand(blockCamMicCmd, "blockCameraAndMic")) {
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putBoolean("blockCameraAndMic", true)
                        .apply()
                    writeOperationalAlert(
                        platform = "Remote Command",
                        content = "Camera/mic block policy flag applied on child app.",
                        severity = "LOW"
                    )
                    markCommandStatus(childId, "blockCameraAndMic", "ACKNOWLEDGED", clearValue = true)
                }

                val offlineUnlockCmd = commands["syncOfflineUnlockConfig"] as? Map<*, *>
                if (shouldHandleCommand(offlineUnlockCmd, "syncOfflineUnlockConfig")) {
                    val applied = OfflineUnlockManager.applyConfig(this, offlineUnlockCmd?.get("value"))
                    markCommandStatus(
                        childId,
                        "syncOfflineUnlockConfig",
                        if (applied) "EXECUTED" else "FAILED",
                        clearValue = applied
                    )
                }

                val vulnerabilityScanCmd = commands["runVulnerabilityScan"] as? Map<*, *>
                if (shouldHandleCommand(vulnerabilityScanCmd, "runVulnerabilityScan")) {
                    try {
                        startService(
                            Intent(this, VulnerabilityScannerService::class.java).apply {
                                action = VulnerabilityScannerService.ACTION_SCAN_NOW
                            }
                        )
                        markCommandStatus(childId, "runVulnerabilityScan", "EXECUTED", clearValue = true)
                    } catch (_: Exception) {
                        markCommandStatus(childId, "runVulnerabilityScan", "FAILED")
                    }
                }

                val notifyParentCmd = commands["notifyParent"] as? Map<*, *>
                val shouldNotifyParent = notifyParentCmd?.get("value") == true
                if (shouldNotifyParent && shouldHandleCommand(notifyParentCmd, "notifyParent")) {
                    writeOperationalAlert(
                        platform = "Child Device",
                        content = "Child app acknowledged notifyParent command.",
                        severity = "LOW"
                    )
                    markCommandStatus(childId, "notifyParent", "EXECUTED", clearValue = true)
                }
            }
    }

    private fun triggerSystemLockIfPossible() {
        // Intentionally no-op:
        // OS lockNow() cannot be remotely undone, so it conflicts with parent unlock flows.
        // Keep lock behavior inside Amanah overlay/state control.
        Log.i("AmanahCommands", "System lockNow() skipped by design; overlay lock remains active.")
    }

    private fun playEmergencySiren(childId: String) {
        db.collection("children").document(childId).update("commands.playSiren.value", false)
        try {
            val notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            val ringtone = RingtoneManager.getRingtone(applicationContext, notification)
            ringtone.play()
            Handler(Looper.getMainLooper()).postDelayed({
                if (ringtone.isPlaying) ringtone.stop()
            }, 5000)
            Toast.makeText(this, "📢 تنبيه طوارئ من الوالدين!", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Log.e("AmanahCommands", "Failed to play siren", e)
        }
    }

    private fun performCaptureAndUpload(childId: String) {
        db.collection("children").document(childId).update("commands.takeScreenshot.value", false)

        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childName = prefs.getString("childName", "Child Device") ?: "Child Device"

        val latestFrame = ScreenGuardianService.peekLatestFrameData()
        val alert = hashMapOf<String, Any>(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to "System Screen",
            "content" to "Screenshot evidence requested by parent command.",
            "category" to "SAFE",
            "severity" to "LOW",
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to if (latestFrame != null)
                "Live screenshot uploaded successfully."
            else
                "Command executed but no current frame is available.",
            "actionTaken" to "takeScreenshot command executed."
        )
        if (latestFrame != null) {
            alert["imageData"] = latestFrame
        } else {
            alert["captureStatus"] = "NO_FRAME_AVAILABLE"
        }
        db.collection("alerts").add(alert)
        Toast.makeText(this, "Screenshot evidence uploaded", Toast.LENGTH_SHORT).show()
    }
    private fun shouldHandleCommand(cmd: Map<*, *>?, key: String): Boolean {
        if (cmd == null) return false
        val ts = cmd["timestamp"]
        val value = when (ts) {
            is Timestamp -> ts.seconds * 1000L + (ts.nanoseconds / 1_000_000L)
            is Date -> ts.time
            is Number -> ts.toLong()
            else -> System.currentTimeMillis()
        }
        val prev = lastCommandTimestamps[key]
        if (prev != null && prev == value) return false
        lastCommandTimestamps[key] = value
        return true
    }

    private fun markCommandStatus(childId: String, command: String, status: String, clearValue: Boolean = false) {
        val updates = hashMapOf<String, Any>(
            "commands.$command.status" to status,
            "commands.$command.handledAt" to Timestamp.now()
        )
        if (clearValue) {
            updates["commands.$command.value"] = false
        }
        db.collection("children").document(childId).update(updates)
            .addOnFailureListener { e ->
                Log.w("AmanahCommands", "Failed to update status for $command: ${e.message}")
            }
    }

    private fun handleBlockAppCommand(config: Map<*, *>?): Boolean {
        if (config == null) return false
        val blocked = when (val flag = config["blocked"] ?: config["isBlocked"]) {
            is Boolean -> flag
            is String -> flag.equals("true", ignoreCase = true)
            else -> false
        }
        val appIdRaw = config["appId"]?.toString()?.trim()?.lowercase(Locale.getDefault()) ?: ""
        val appNameRaw = config["appName"]?.toString()?.trim()?.lowercase(Locale.getDefault()) ?: ""
        val tokens = resolveBlockedTokens(appIdRaw, appNameRaw)
        if (tokens.isEmpty()) return false

        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val currentSet = prefs.getStringSet("blockedApps", emptySet())?.toMutableSet() ?: mutableSetOf()
        if (blocked) currentSet.addAll(tokens) else currentSet.removeAll(tokens)
        prefs.edit().putStringSet("blockedApps", currentSet).apply()
        return true
    }

    private fun resolveBlockedTokens(appIdRaw: String, appNameRaw: String): Set<String> {
        val aliases = mapOf(
            "tiktok" to "com.zhiliaoapp.musically",
            "tik tok" to "com.zhiliaoapp.musically",
            "instagram" to "com.instagram.android",
            "youtube" to "com.google.android.youtube",
            "whatsapp" to "com.whatsapp",
            "telegram" to "org.telegram.messenger",
            "discord" to "com.discord",
            "snapchat" to "com.snapchat.android",
            "facebook" to "com.facebook.katana",
            "roblox" to "com.roblox.client"
        )
        val tokens = mutableSetOf<String>()
        if (appIdRaw.isNotBlank()) tokens.add(appIdRaw)
        if (appNameRaw.isNotBlank()) tokens.add(appNameRaw)
        aliases[appIdRaw]?.let { tokens.add(it) }
        aliases[appNameRaw]?.let { tokens.add(it) }

        resolvePackageFromInstalledApps(appNameRaw)?.let { tokens.add(it) }
        if (!appIdRaw.contains('.')) {
            resolvePackageFromInstalledApps(appIdRaw)?.let { tokens.add(it) }
        }
        return tokens.map { it.trim().lowercase(Locale.getDefault()) }
            .filter { it.isNotBlank() }
            .toSet()
    }

    private fun resolvePackageFromInstalledApps(rawName: String): String? {
        val normalized = rawName.trim().lowercase(Locale.getDefault())
        if (normalized.isBlank()) return null
        if (normalized.contains('.')) return normalized
        return try {
            packageManager.getInstalledApplications(0)
                .firstOrNull { app ->
                    val label = try {
                        packageManager.getApplicationLabel(app).toString()
                            .trim()
                            .lowercase(Locale.getDefault())
                    } catch (_: Exception) {
                        ""
                    }
                    label == normalized || label.contains(normalized)
                }
                ?.packageName
                ?.lowercase(Locale.getDefault())
        } catch (_: Exception) {
            null
        }
    }

    private fun playShortBeep() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(applicationContext, uri)
            ringtone.play()
            Handler(Looper.getMainLooper()).postDelayed({
                if (ringtone.isPlaying) ringtone.stop()
            }, 1200)
        } catch (e: Exception) {
            Log.w("AmanahCommands", "Could not play push-to-talk beep: ${e.message}")
        }
    }

    private fun writeOperationalAlert(platform: String, content: String, severity: String) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childName = prefs.getString("childName", "Child Device")
        val latestFrame = ScreenGuardianService.peekLatestFrameData()
        val childId = prefs.getString("childDocumentId", null)

        val alert = hashMapOf(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to platform,
            "content" to content,
            "category" to "TAMPER",
            "severity" to severity,
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to "Child app operational acknowledgement."
        )
        db.collection("alerts").add(alert)
            .addOnFailureListener { e ->
                Log.w("AmanahCommands", "Operational alert upload failed: ${e.message}")
            }
    }

    private fun registerLockStateReceiver() {
        lockStateReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                syncLockOverlayFromPrefs()
            }
        }
        try {
            val filter = IntentFilter(RemoteCommandService.ACTION_LOCK_STATE_CHANGED)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(lockStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                registerReceiver(lockStateReceiver, filter)
            }
        } catch (e: Exception) {
            Log.w("AmanahMain", "Failed to register lock receiver: ${e.message}")
        }
    }

    private fun unregisterLockStateReceiver() {
        try {
            lockStateReceiver?.let { unregisterReceiver(it) }
        } catch (_: Exception) {
        }
        lockStateReceiver = null
    }

    private fun syncLockOverlayFromPrefs() {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val lockActive = prefs.getBoolean("deviceLockActive", false)
        val blackoutActive = prefs.getBoolean("blackoutActive", false)
        updateLockUI(lockActive || blackoutActive)
    }

    private fun broadcastLockStateChanged() {
        try {
            sendBroadcast(Intent(RemoteCommandService.ACTION_LOCK_STATE_CHANGED))
        } catch (e: Exception) {
            Log.w("AmanahMain", "Lock-state broadcast failed: ${e.message}")
        }
    }

    private fun configureLockOverlayBlocking() {
        lockOverlay.setOnTouchListener { _, _ -> lockOverlay.visibility == View.VISIBLE }
    }

    private fun configureOfflineUnlockUi() {
        offlineUnlockButton.setOnClickListener {
            attemptOfflineUnlock("main_activity")
        }
        offlineUnlockCodeInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_DONE ||
                actionId == android.view.inputmethod.EditorInfo.IME_ACTION_GO
            ) {
                attemptOfflineUnlock("main_activity")
                true
            } else {
                false
            }
        }
    }

    private fun attemptOfflineUnlock(source: String) {
        if (lockOverlay.visibility != View.VISIBLE) return
        if (isDeviceOnline()) {
            offlineUnlockStatus.visibility = View.GONE
            offlineUnlockCodeInput.setText("")
            return
        }
        val code = offlineUnlockCodeInput.text?.toString().orEmpty()
        val result = OfflineUnlockManager.verifyCode(this, code)
        if (!result.success) {
            offlineUnlockStatus.setTextColor(Color.parseColor("#FCA5A5"))
            offlineUnlockStatus.text = result.message
            return
        }

        OfflineUnlockManager.clearLockState(this, source)
        broadcastLockStateChanged()
        updateLockUI(false)
        offlineUnlockCodeInput.setText("")
        offlineUnlockStatus.setTextColor(Color.parseColor("#86EFAC"))
        offlineUnlockStatus.text = result.message

        val childId = getSharedPreferences("AmanahPrefs", MODE_PRIVATE).getString("childDocumentId", null)
        if (!childId.isNullOrBlank()) {
            markCommandStatus(childId, "lockDevice", "OFFLINE_UNLOCKED", clearValue = true)
            markCommandStatus(childId, "lockscreenBlackout", "OFFLINE_UNLOCKED", clearValue = true)
        }
    }

    private fun updateLockUI(isLocked: Boolean) {
        runOnUiThread {
            lockOverlay.visibility = if (isLocked) View.VISIBLE else View.GONE
            statusText.text = if (isLocked) "Device is locked" else "Protection active"
            statusText.setTextColor(if (isLocked) Color.RED else Color.GREEN)

            if (!isLocked) {
                offlineUnlockCodeInput.visibility = View.GONE
                offlineUnlockButton.visibility = View.GONE
                offlineUnlockStatus.visibility = View.GONE
                offlineUnlockCodeInput.setText("")
                offlineUnlockStatus.text = ""
                return@runOnUiThread
            }

            val online = isDeviceOnline()
            if (online) {
                // Online lock screen uses the classic policy-only view with no offline unlock controls.
                offlineUnlockCodeInput.visibility = View.GONE
                offlineUnlockButton.visibility = View.GONE
                offlineUnlockStatus.visibility = View.GONE
                offlineUnlockCodeInput.setText("")
                offlineUnlockStatus.text = ""
            } else {
                offlineUnlockCodeInput.visibility = View.VISIBLE
                offlineUnlockButton.visibility = View.VISIBLE
                offlineUnlockStatus.visibility = View.VISIBLE

                val backupRemaining = OfflineUnlockManager.backupCodesRemaining(this)
                if (backupRemaining > 0) {
                    offlineUnlockStatus.setTextColor(Color.parseColor("#F8DFA9"))
                    offlineUnlockStatus.text = "Emergency backup codes remaining: $backupRemaining"
                } else {
                    offlineUnlockStatus.text = ""
                }
            }

            // Ensure overlay intercepts all touch events when locked
            lockOverlay.bringToFront()
            lockOverlay.requestFocus()
        }
    }

    private fun isDeviceOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun hasNetworkConnectionHint(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
    }

    private data class RestPairingLookupResult(
        val parentId: String? = null,
        val expiresAtSeconds: Long? = null,
        val errorMessage: String? = null
    )

    private data class RestPairingApprovalResult(
        val status: String? = null,
        val childDocumentId: String? = null,
        val errorMessage: String? = null
    )

    private fun fetchPairingKeyViaRest(key: String, idToken: String): RestPairingLookupResult {
        val response = performFirestoreRestRequest(
            documentPath = "pairingKeys/$key",
            idToken = idToken,
            method = "GET"
        )
        if (response.responseCode == 404) {
            return RestPairingLookupResult(errorMessage = "كود الربط غير موجود")
        }
        if (response.responseCode !in 200..299) {
            throw IllegalStateException(response.errorMessage ?: "REST get failed (${response.responseCode})")
        }

        val json = JSONObject(response.body)
        val fields = json.optJSONObject("fields") ?: JSONObject()
        val parentId = fields.optJSONObject("parentId")?.optString("stringValue")
        val expiresAtRaw = fields.optJSONObject("expiresAt")?.optString("timestampValue")
        val expiresAtSeconds = expiresAtRaw?.let {
            runCatching { Timestamp(Date.from(java.time.Instant.parse(it))).seconds }.getOrNull()
        }
        return RestPairingLookupResult(parentId = parentId, expiresAtSeconds = expiresAtSeconds)
    }

    private fun createPairingRequestViaRest(
        parentId: String,
        requestId: String,
        requestData: HashMap<String, Any>,
        idToken: String
    ) {
        val timestamp = (requestData["timestamp"] as? Timestamp)?.toDate()?.toInstant()?.toString()
            ?: java.time.Instant.now().toString()
        val payload = JSONObject().apply {
            put("fields", JSONObject().apply {
                put("parentId", fireString(parentId))
                put("childName", fireString(requestData["childName"]?.toString().orEmpty()))
                put("model", fireString(requestData["model"]?.toString().orEmpty()))
                put("os", fireString(requestData["os"]?.toString().orEmpty()))
                put("status", fireString("PENDING"))
                put("timestamp", JSONObject().put("timestampValue", timestamp))
            })
        }.toString()

        val response = performFirestoreRestRequest(
            documentPath = "parents/$parentId/pairingRequests/$requestId",
            idToken = idToken,
            method = "PATCH",
            payload = payload
        )
        if (response.responseCode !in 200..299) {
            throw IllegalStateException(response.errorMessage ?: "REST create failed (${response.responseCode})")
        }
    }

    private fun fetchPairingApprovalViaRest(
        parentId: String,
        requestId: String,
        idToken: String
    ): RestPairingApprovalResult {
        val response = performFirestoreRestRequest(
            documentPath = "parents/$parentId/pairingRequests/$requestId",
            idToken = idToken,
            method = "GET"
        )
        if (response.responseCode == 404) {
            return RestPairingApprovalResult(status = null, childDocumentId = null)
        }
        if (response.responseCode !in 200..299) {
            throw IllegalStateException(response.errorMessage ?: "REST poll failed (${response.responseCode})")
        }
        val json = JSONObject(response.body)
        val fields = json.optJSONObject("fields") ?: JSONObject()
        val status = fields.optJSONObject("status")?.optString("stringValue")
        val childDocumentId = fields.optJSONObject("childDocumentId")?.optString("stringValue")
        return RestPairingApprovalResult(status = status, childDocumentId = childDocumentId)
    }

    private fun performFirestoreRestRequest(
        documentPath: String,
        idToken: String,
        method: String,
        payload: String? = null
    ): RestHttpResponse {
        val projectId = FirebaseApp.getInstance().options.projectId
            ?: throw IllegalStateException("Missing Firebase project id")
        val url = URL("https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/$documentPath")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 12_000
            readTimeout = 12_000
            setRequestProperty("Authorization", "Bearer $idToken")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }

        if (!payload.isNullOrBlank()) {
            connection.doOutput = true
            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(payload)
            }
        }

        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()
        val errorMessage = if (code in 200..299) null else parseFirestoreRestError(body)
        connection.disconnect()
        return RestHttpResponse(code, body, errorMessage)
    }

    private fun parseFirestoreRestError(body: String): String {
        return runCatching {
            val root = JSONObject(body)
            val error = root.optJSONObject("error")
            val status = error?.optString("status").orEmpty()
            val message = error?.optString("message").orEmpty()
            listOf(status, message).filter { it.isNotBlank() }.joinToString(": ")
        }.getOrElse { body.ifBlank { "Unknown REST error" } }
    }

    private fun fireString(value: String): JSONObject = JSONObject().put("stringValue", value)

    private data class RestHttpResponse(
        val responseCode: Int,
        val body: String,
        val errorMessage: String?
    )
}

