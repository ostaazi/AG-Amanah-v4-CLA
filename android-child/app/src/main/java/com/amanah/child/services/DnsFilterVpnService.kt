package com.amanah.child.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import com.amanah.child.MainActivity
import com.amanah.child.R
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

class DnsFilterVpnService : VpnService() {

    companion object {
        const val ACTION_APPLY_POLICY = "com.amanah.child.action.APPLY_DNS_POLICY"
        const val ACTION_STOP_POLICY = "com.amanah.child.action.STOP_DNS_POLICY"

        const val PREFS_NAME = "AmanahPrefs"
        const val PREF_KEY_ENABLED = "dnsFilteringEnabled"
        const val PREF_KEY_MODE = "dnsFilteringMode"
        const val PREF_KEY_DOMAINS = "dnsFilteringDomains"

        private const val MODE_FAMILY = "family"
        private const val MODE_STRICT = "strict"
        private const val MODE_CUSTOM = "custom"
        private const val MODE_SANDBOX = "sandbox"

        private const val TAG = "AmanahDnsVpn"
        private const val CHANNEL_ID = "amanah_dns_filter"
        private const val NOTIFICATION_ID = 2217
        private const val PRIMARY_DNS = "1.1.1.1"
        private const val SECONDARY_DNS = "1.0.0.1"

        // Keep app/cloud control channels reachable while sandbox mode is active.
        private val SANDBOX_ESSENTIAL_ALLOWLIST = setOf(
            "googleapis.com",
            "gstatic.com",
            "google.com",
            "googleusercontent.com",
            "firebaseio.com",
            "firebasestorage.googleapis.com",
            "appspot.com",
            "cloudfunctions.net",
            "mtalk.google.com",
            "connectivitycheck.gstatic.com",
            "clients3.google.com",
            "android.clients.google.com",
            "play.googleapis.com",
            "play.google.com",
            "ssl.gstatic.com",
            "fonts.gstatic.com"
        )

        // Common domains that are broadly trusted and should not require parent decision.
        private val SANDBOX_AUTO_TRUSTED_DOMAINS = setOf(
            "youtube.com",
            "wikipedia.org",
            "mozilla.org",
            "microsoft.com",
            "apple.com",
            "openai.com",
            "github.com",
            "stackoverflow.com"
        )

        private val SANDBOX_HIGH_RISK_TLDS = setOf(
            "zip", "mov", "top", "xyz", "click", "quest", "rest", "cam", "buzz", "work"
        )

        private val SANDBOX_RISK_KEYWORDS = setOf(
            "login", "verify", "secure", "account", "update", "bank", "wallet", "crypto", "airdrop",
            "gift", "bonus", "free", "prize", "casino", "bet", "porn", "sex", "nude", "escort",
            "hack", "keygen", "modapk", "apkmod", "steal", "phish"
        )

        private val SANDBOX_HARD_BLOCK_SUFFIXES = setOf(
            "pornhub.com",
            "xvideos.com",
            "xnxx.com",
            "redtube.com",
            "youporn.com",
            "onlyfans.com",
            "bet365.com",
            "1xbet.com",
            "stake.com",
            "888casino.com"
        )

        private const val SANDBOX_BLOCK_SCORE_THRESHOLD = 5
    }

    private data class DnsQuestion(
        val domain: String,
        val endOffset: Int
    )

    private data class DomainPolicyDecision(
        val block: Boolean,
        val reason: String,
        val riskScore: Int = 0,
        val automated: Boolean = false
    )

    private val db by lazy { FirebaseFirestore.getInstance() }
    private val running = AtomicBoolean(false)
    private val domainAlertClock = mutableMapOf<String, Long>()

    @Volatile
    private var blockedDomains: Set<String> = emptySet()

    @Volatile
    private var sandboxAllowedDomains: Set<String> = emptySet()

    @Volatile
    private var activeMode: String = MODE_FAMILY

    @Volatile
    private var vpnInterface: ParcelFileDescriptor? = null

    @Volatile
    private var workerThread: Thread? = null

    override fun onCreate() {
        super.onCreate()
        ensureNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_POLICY -> {
                stopVpnLoop()
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                applyPolicyFromPrefs()
                return START_STICKY
            }
        }
    }

    override fun onDestroy() {
        stopVpnLoop()
        super.onDestroy()
    }

    override fun onRevoke() {
        Log.w(TAG, "VPN permission revoked by system/user.")
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putBoolean(PREF_KEY_ENABLED, false)
            .apply()
        stopVpnLoop()
        stopSelf()
        super.onRevoke()
    }

    private fun applyPolicyFromPrefs() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val enabled = prefs.getBoolean(PREF_KEY_ENABLED, false)
        if (!enabled) {
            stopVpnLoop()
            stopForeground(true)
            stopSelf()
            return
        }

        val mode = normalizeMode(prefs.getString(PREF_KEY_MODE, MODE_FAMILY))
        activeMode = mode
        val customDomains = prefs.getStringSet(PREF_KEY_DOMAINS, emptySet()) ?: emptySet()

        blockedDomains = resolveBlockedDomains(
            mode,
            customDomains
        )
        sandboxAllowedDomains = resolveSandboxAllowedDomains(mode, customDomains)

        startForeground(
            NOTIFICATION_ID,
            buildNotification(mode, blockedDomains.size, sandboxAllowedDomains.size)
        )

        if (VpnService.prepare(this) != null) {
            Log.w(TAG, "VPN permission is missing, DNS filtering cannot start.")
            stopVpnLoop()
            return
        }

        if (vpnInterface == null) {
            startVpnLoop()
        }
    }

    private fun startVpnLoop() {
        val builder = Builder()
            .setSession("Amanah DNS Filter")
            .setMtu(1500)
            .addAddress("10.20.0.2", 32)
            .addDnsServer(PRIMARY_DNS)
            .addDnsServer(SECONDARY_DNS)
            .addRoute(PRIMARY_DNS, 32)
            .addRoute(SECONDARY_DNS, 32)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            builder.setMetered(false)
        }

        val iface = builder.establish()
        if (iface == null) {
            Log.e(TAG, "Failed to establish VPN interface.")
            return
        }

        vpnInterface = iface
        running.set(true)

        workerThread = Thread({
            val input = FileInputStream(iface.fileDescriptor)
            val output = FileOutputStream(iface.fileDescriptor)
            val packet = ByteArray(32767)

            while (running.get()) {
                val length = try {
                    input.read(packet)
                } catch (e: Exception) {
                    if (running.get()) {
                        Log.w(TAG, "VPN read loop interrupted: ${e.message}")
                    }
                    break
                }
                if (length <= 0) continue

                try {
                    processPacket(packet, length, output)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to process DNS packet: ${e.message}")
                }
            }
        }, "AmanahDnsFilterLoop").apply {
            isDaemon = true
            start()
        }

        Log.i(TAG, "DNS filtering VPN started with ${blockedDomains.size} blocked domains.")
    }

    private fun stopVpnLoop() {
        running.set(false)

        try {
            vpnInterface?.close()
        } catch (_: Exception) {
        }
        vpnInterface = null

        try {
            workerThread?.interrupt()
        } catch (_: Exception) {
        }
        workerThread = null
    }

    private fun processPacket(packet: ByteArray, length: Int, output: FileOutputStream) {
        if (length < 28) return

        val version = (packet[0].toInt() ushr 4) and 0x0F
        if (version != 4) return

        val ipHeaderLength = (packet[0].toInt() and 0x0F) * 4
        if (length < ipHeaderLength + 8) return

        val protocol = packet[9].toInt() and 0xFF
        if (protocol != 17) return // UDP only

        val srcIp = packet.copyOfRange(12, 16)
        val dstIp = packet.copyOfRange(16, 20)

        val srcPort = readUShort(packet, ipHeaderLength)
        val dstPort = readUShort(packet, ipHeaderLength + 2)
        if (dstPort != 53) return

        val udpLength = readUShort(packet, ipHeaderLength + 4)
        if (udpLength <= 8) return

        val dnsStart = ipHeaderLength + 8
        val dnsLength = minOf(udpLength - 8, length - dnsStart)
        if (dnsLength <= 0) return

        val dnsQuery = packet.copyOfRange(dnsStart, dnsStart + dnsLength)
        val question = parseDnsQuestion(dnsQuery)

        val decision = question?.let { evaluateDomainPolicy(it.domain) }

        val responsePayload = if (question != null && decision?.block == true) {
            onBlockedDomain(question.domain, decision)
            buildDnsErrorResponse(dnsQuery, question.endOffset, 3)
        } else {
            forwardDnsQuery(dnsQuery) ?: question?.let { buildDnsErrorResponse(dnsQuery, it.endOffset, 2) }
        } ?: return

        val replyPacket = buildIpv4UdpPacket(
            srcIp = dstIp,
            dstIp = srcIp,
            srcPort = 53,
            dstPort = srcPort,
            payload = responsePayload
        )
        output.write(replyPacket)
    }

    private fun parseDnsQuestion(query: ByteArray): DnsQuestion? {
        if (query.size < 12) return null

        val qdCount = readUShort(query, 4)
        if (qdCount < 1) return null

        var offset = 12
        val labels = mutableListOf<String>()

        while (offset < query.size) {
            val len = query[offset].toInt() and 0xFF
            if (len == 0) {
                offset += 1
                break
            }
            if ((len and 0xC0) == 0xC0) return null
            if (len > 63) return null
            if (offset + 1 + len > query.size) return null
            val label = String(query, offset + 1, len, Charsets.US_ASCII)
            labels.add(label)
            offset += 1 + len
        }

        if (labels.isEmpty()) return null
        if (offset + 4 > query.size) return null

        val domain = labels.joinToString(".").lowercase(Locale.US).trim('.')
        return DnsQuestion(domain = domain, endOffset = offset + 4)
    }

    private fun evaluateDomainPolicy(domain: String): DomainPolicyDecision {
        if (domain.isBlank()) return DomainPolicyDecision(block = false, reason = "empty")
        val normalized = domain.lowercase(Locale.US).trim('.')
        if (normalized.isBlank()) {
            return DomainPolicyDecision(block = false, reason = "empty_normalized")
        }

        if (activeMode == MODE_SANDBOX) {
            if (isLocalOrIpDomain(normalized)) {
                return DomainPolicyDecision(block = false, reason = "local_or_ip")
            }

            val allowed = sandboxAllowedDomains.any { safe ->
                normalized == safe || normalized.endsWith(".$safe")
            }
            if (allowed) {
                return DomainPolicyDecision(block = false, reason = "allowlisted_by_parent")
            }

            val trusted = SANDBOX_AUTO_TRUSTED_DOMAINS.any { safe ->
                normalized == safe || normalized.endsWith(".$safe")
            }
            if (trusted) {
                return DomainPolicyDecision(
                    block = false,
                    reason = "auto_allow_trusted_domain",
                    automated = true
                )
            }

            return evaluateSandboxRisk(normalized)
        }

        val blocked = blockedDomains.any { entry ->
            normalized == entry || normalized.endsWith(".$entry")
        }
        return if (blocked) {
            DomainPolicyDecision(block = true, reason = "blocked_by_policy_list")
        } else {
            DomainPolicyDecision(block = false, reason = "allowed")
        }
    }

    private fun evaluateSandboxRisk(domain: String): DomainPolicyDecision {
        var score = 0
        val reasons = mutableListOf<String>()
        val labels = domain.split('.').filter { it.isNotBlank() }
        val mainLabel = labels.firstOrNull().orEmpty()
        val tld = labels.lastOrNull().orEmpty()

        if (SANDBOX_HARD_BLOCK_SUFFIXES.any { domain == it || domain.endsWith(".$it") }) {
            score += SANDBOX_BLOCK_SCORE_THRESHOLD
            reasons += "hard_block_suffix"
        }

        if (domain.contains("xn--")) {
            score += 4
            reasons += "punycode_homograph_risk"
        }

        if (tld in SANDBOX_HIGH_RISK_TLDS) {
            score += 2
            reasons += "high_risk_tld:$tld"
        }

        val matchedKeywords = SANDBOX_RISK_KEYWORDS.filter { keyword -> domain.contains(keyword) }
        if (matchedKeywords.isNotEmpty()) {
            score += minOf(4, matchedKeywords.size * 2)
            reasons += "risk_keywords:${matchedKeywords.take(3).joinToString(",")}"
        }

        val digits = domain.count { it.isDigit() }
        if (digits >= 6) {
            score += 1
            reasons += "many_digits"
        }

        val hyphens = domain.count { it == '-' }
        if (hyphens >= 3) {
            score += 1
            reasons += "many_hyphens"
        }

        if (labels.size >= 5) {
            score += 1
            reasons += "deep_subdomain_chain"
        }

        if (mainLabel.length >= 22) {
            score += 1
            reasons += "long_label"
        }

        if (looksAlgorithmic(mainLabel)) {
            score += 2
            reasons += "algorithmic_label_pattern"
        }

        val block = score >= SANDBOX_BLOCK_SCORE_THRESHOLD
        return DomainPolicyDecision(
            block = block,
            reason = if (reasons.isEmpty()) "low_risk_auto_allow" else reasons.joinToString("|"),
            riskScore = score,
            automated = true
        )
    }

    private fun looksAlgorithmic(label: String): Boolean {
        if (label.length < 12) return false
        val normalized = label.lowercase(Locale.US)
        val letters = normalized.count { it.isLetter() }
        val digits = normalized.count { it.isDigit() }
        val vowels = normalized.count { it in "aeiou" }
        val hardConsonantCluster = Regex("[bcdfghjklmnpqrstvwxyz]{5,}").containsMatchIn(normalized)
        return letters >= 8 && digits >= 2 && vowels <= 2 && hardConsonantCluster
    }

    private fun forwardDnsQuery(query: ByteArray): ByteArray? {
        val upstreamServers = listOf(PRIMARY_DNS, SECONDARY_DNS)
        for (server in upstreamServers) {
            try {
                DatagramSocket().use { socket ->
                    if (!protect(socket)) {
                        Log.w(TAG, "Failed to protect DNS socket from VPN loop.")
                    }
                    socket.soTimeout = 2500
                    val target = InetAddress.getByName(server)
                    socket.send(DatagramPacket(query, query.size, target, 53))

                    val responseBuffer = ByteArray(2048)
                    val responsePacket = DatagramPacket(responseBuffer, responseBuffer.size)
                    socket.receive(responsePacket)
                    return responseBuffer.copyOf(responsePacket.length)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Upstream DNS $server failed: ${e.message}")
            }
        }
        return null
    }

    private fun buildDnsErrorResponse(query: ByteArray, questionEnd: Int, rcode: Int): ByteArray? {
        if (questionEnd > query.size || questionEnd < 12) return null

        val response = ByteArray(questionEnd)
        System.arraycopy(query, 0, response, 0, questionEnd)

        response[2] = (query[2].toInt() or 0x80).toByte() // QR=1
        response[3] = (((query[3].toInt() and 0xF0) or 0x80) or (rcode and 0x0F)).toByte() // RA + RCODE

        response[6] = 0
        response[7] = 0
        response[8] = 0
        response[9] = 0
        response[10] = 0
        response[11] = 0

        return response
    }

    private fun buildIpv4UdpPacket(
        srcIp: ByteArray,
        dstIp: ByteArray,
        srcPort: Int,
        dstPort: Int,
        payload: ByteArray
    ): ByteArray {
        val totalLength = 20 + 8 + payload.size
        val packet = ByteArray(totalLength)

        packet[0] = 0x45.toByte()
        packet[1] = 0
        writeUShort(packet, 2, totalLength)
        writeUShort(packet, 4, (SystemClock.elapsedRealtime().toInt() and 0xFFFF))
        writeUShort(packet, 6, 0)
        packet[8] = 64
        packet[9] = 17
        writeUShort(packet, 10, 0)
        System.arraycopy(srcIp, 0, packet, 12, 4)
        System.arraycopy(dstIp, 0, packet, 16, 4)

        val ipChecksum = calculateIpChecksum(packet, 0, 20)
        writeUShort(packet, 10, ipChecksum)

        writeUShort(packet, 20, srcPort)
        writeUShort(packet, 22, dstPort)
        writeUShort(packet, 24, 8 + payload.size)
        writeUShort(packet, 26, 0)

        System.arraycopy(payload, 0, packet, 28, payload.size)
        return packet
    }

    private fun calculateIpChecksum(data: ByteArray, offset: Int, length: Int): Int {
        var sum = 0L
        var i = offset

        while (i < offset + length) {
            val high = data[i].toInt() and 0xFF
            val low = data[i + 1].toInt() and 0xFF
            sum += ((high shl 8) or low).toLong()
            i += 2
        }

        while ((sum ushr 16) != 0L) {
            sum = (sum and 0xFFFF) + (sum ushr 16)
        }

        return (sum.inv() and 0xFFFF).toInt()
    }

    private fun readUShort(buffer: ByteArray, offset: Int): Int {
        return ((buffer[offset].toInt() and 0xFF) shl 8) or
            (buffer[offset + 1].toInt() and 0xFF)
    }

    private fun writeUShort(buffer: ByteArray, offset: Int, value: Int) {
        buffer[offset] = ((value ushr 8) and 0xFF).toByte()
        buffer[offset + 1] = (value and 0xFF).toByte()
    }

    private fun resolveBlockedDomains(modeRaw: String, customDomainsRaw: Set<String>): Set<String> {
        val familyPreset = setOf(
            "pornhub.com",
            "xvideos.com",
            "xnxx.com",
            "redtube.com",
            "youporn.com",
            "onlyfans.com",
            "bet365.com",
            "1xbet.com",
            "stake.com",
            "888casino.com"
        )
        val strictPreset = setOf(
            "omegle.com",
            "discord.com",
            "reddit.com",
            "tiktok.com"
        )

        val normalizedCustom = customDomainsRaw
            .map(::normalizeDomain)
            .filter { it.isNotBlank() }
            .toSet()

        return when (normalizeMode(modeRaw)) {
            MODE_STRICT -> (familyPreset + strictPreset + normalizedCustom)
            MODE_CUSTOM -> normalizedCustom
            MODE_SANDBOX -> emptySet()
            else -> (familyPreset + normalizedCustom)
        }
    }

    private fun resolveSandboxAllowedDomains(modeRaw: String, customDomainsRaw: Set<String>): Set<String> {
        if (normalizeMode(modeRaw) != MODE_SANDBOX) return emptySet()
        val customAllowed = customDomainsRaw
            .map(::normalizeDomain)
            .filter { it.isNotBlank() }
            .toSet()
        return SANDBOX_ESSENTIAL_ALLOWLIST + customAllowed
    }

    private fun normalizeMode(raw: String?): String {
        return when (raw?.trim()?.lowercase(Locale.US).orEmpty()) {
            MODE_STRICT -> MODE_STRICT
            MODE_CUSTOM -> MODE_CUSTOM
            MODE_SANDBOX -> MODE_SANDBOX
            else -> MODE_FAMILY
        }
    }

    private fun normalizeDomain(raw: String): String {
        return raw
            .trim()
            .lowercase(Locale.US)
            .removePrefix("https://")
            .removePrefix("http://")
            .removePrefix("www.")
            .substringBefore('/')
            .removePrefix("*.")
            .trim('.')
    }

    private fun isLocalOrIpDomain(domain: String): Boolean {
        val ipv4Pattern = Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")
        if (ipv4Pattern.matches(domain)) return true
        if (!domain.contains('.')) return true
        return domain.endsWith(".local") ||
            domain.endsWith(".lan") ||
            domain.endsWith(".home") ||
            domain.endsWith(".internal") ||
            domain.endsWith(".arpa")
    }

    private fun onBlockedDomain(domain: String, decision: DomainPolicyDecision? = null) {
        val now = System.currentTimeMillis()
        val shouldSend = synchronized(domainAlertClock) {
            val previous = domainAlertClock[domain] ?: 0L
            if (now - previous < 120_000L) {
                false
            } else {
                domainAlertClock[domain] = now
                true
            }
        }
        if (!shouldSend) return

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childId = prefs.getString("childDocumentId", null) ?: return
        val childName = prefs.getString("childName", "Child Device") ?: "Child Device"
        val sandboxMode = activeMode == MODE_SANDBOX
        val decisionReason = decision?.reason ?: "policy_block"
        val decisionScore = decision?.riskScore ?: 0
        val automated = decision?.automated == true

        val alert = hashMapOf<String, Any>(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to "DNS Filter",
            "content" to if (sandboxMode)
                "Sandbox auto-blocked suspicious domain: $domain"
            else
                "Blocked domain access attempt: $domain",
            "category" to if (sandboxMode) "SCAM" else "TAMPER",
            "severity" to if (sandboxMode) "HIGH" else "MEDIUM",
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to if (sandboxMode)
                "DNS sandbox AI blocked this domain automatically (riskScore=$decisionScore, reason=$decisionReason)."
            else
                "DNS-level policy blocked a domain based on active family filtering rules.",
            "triggerType" to "DNS",
            "triggerDomain" to domain,
            "dnsMode" to activeMode,
            "decisionReason" to decisionReason,
            "decisionScore" to decisionScore,
            "decisionAutomation" to if (automated) "AUTO" else "POLICY"
        )

        db.collection("alerts").add(alert)
            .addOnFailureListener { e ->
                Log.w(TAG, "Failed to upload DNS block alert: ${e.message}")
            }
    }

    private fun buildNotification(mode: String, blockedCount: Int, sandboxAllowedCount: Int): android.app.Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        val pending = android.app.PendingIntent.getActivity(
            this,
            2217,
            openIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
            else android.app.PendingIntent.FLAG_UPDATE_CURRENT
        )

        val title = if (mode == MODE_SANDBOX) "Amanah DNS Sandbox" else "Amanah DNS Filter"
        val text = if (mode == MODE_SANDBOX) {
            "Sandbox AI active (approved domains: $sandboxAllowedCount)"
        } else {
            "DNS protection active ($blockedCount blocked domains)"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(pending)
            .setOngoing(true)
            .build()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Amanah DNS Filtering",
            NotificationManager.IMPORTANCE_LOW
        )
        manager.createNotificationChannel(channel)
    }
}
