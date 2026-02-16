package com.amanah.childagent.net

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class PairingApi {

    // TODO: Replace with your Firebase Functions / Backend URL (HTTPS only)
    // Example: https://us-central1-<project>.cloudfunctions.net/amanahApi
    private companion object {
        const val BASE_URL = "https://YOUR_DOMAIN_OR_FUNCTION_URL"
        val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
        val json = Json { ignoreUnknownKeys = true; isLenient = true }
    }

    private val client = OkHttpClient.Builder().build()

    @Serializable
    data class DeviceInfo(
        val platform: String,
        val model: String,
        val osVersion: String,
        val appVersion: String
    )

    @Serializable
    data class VerifyRequest(
        val sessionId: String,
        val code: String,
        val device: DeviceInfo
    )

    @Serializable
    data class VerifyResponse(
        val ok: Boolean,
        val deviceId: String? = null,
        val parentUid: String? = null,
        val accessToken: String? = null,
        val expiresIn: Long? = null,
        val error: String? = null
    )

    @Throws(Exception::class)
    fun verify(req: VerifyRequest): VerifyResponse {
        val url = BASE_URL.trimEnd('/') + "/pair/verify"
        val body = json.encodeToString(VerifyRequest.serializer(), req).toRequestBody(JSON_MEDIA)
        val request = Request.Builder()
            .url(url)
            .post(body)
            .header("Accept", "application/json")
            .build()

        client.newCall(request).execute().use { resp ->
            val raw = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                // Try to parse error body as JSON, otherwise return generic
                return try {
                    json.decodeFromString(VerifyResponse.serializer(), raw)
                } catch (_: Exception) {
                    VerifyResponse(ok = false, error = "HTTP ${resp.code}")
                }
            }
            return json.decodeFromString(VerifyResponse.serializer(), raw)
        }
    }
}
