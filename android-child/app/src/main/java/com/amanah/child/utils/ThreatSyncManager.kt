package com.amanah.child.utils

import android.content.Context
import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore

/**
 * Manages the synchronization of the Threat Dictionary from the Cloud.
 * 
 * Features:
 * 1. Cloud Sync: Listens to 'threat_dictionary' collection in Firestore.
 * 2. Zero-Latency: Updates in-memory SecurityCortex sets immediately.
 * 3. Persistence: Should use EncryptedSharedPreferences (MVP uses standard prefs with TODO).
 * 4. Security: Updates are signature-verified (future scope) or effectively read-only from authorized sources.
 */
object ThreatSyncManager {

    private val db = FirebaseFirestore.getInstance()
    private const val COLLECTION = "threat_dictionary"
    private const val PREFS_NAME = "AmanahThreatPrefs"

    fun startSync(context: Context) {
        // Load persisted updates first (to work offline)
        loadPersistedThreats(context)

        // Listen for real-time updates
        db.collection(COLLECTION)
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.w("ThreatSync", "Listen failed.", e)
                    return@addSnapshotListener
                }

                if (snapshots != null && !snapshots.isEmpty) {
                    for (doc in snapshots) {
                        val category = doc.id // e.g., "PREDATOR", "BULLYING"
                        val patterns = doc.get("patterns") as? List<String> ?: continue
                        
                        if (patterns.isNotEmpty()) {
                            // Update In-Memory (Zero Latency)
                            SecurityCortex.updateThreats(context, category, patterns)
                            
                            // Persist Encrypted
                            saveThreatsEncrypted(context, category, patterns)
                        }
                    }
                }
            }
    }

    private fun saveThreatsEncrypted(context: Context, category: String, patterns: List<String>) {
        // TODO: Use EncryptedSharedPreferences for production
        // For now, we save raw list joined by '|' (Obfuscated)
        val data = patterns.joinToString("|")
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(category, data).apply()
    }

    private fun loadPersistedThreats(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val all = prefs.all
        
        for ((category, value) in all) {
            if (value is String) {
                val patterns = value.split("|")
                if (patterns.isNotEmpty()) {
                    SecurityCortex.updateThreats(context, category, patterns)
                }
            }
        }
    }
}
