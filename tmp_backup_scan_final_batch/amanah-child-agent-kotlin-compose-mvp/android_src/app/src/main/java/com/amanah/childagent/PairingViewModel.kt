package com.amanah.childagent

import android.app.Application
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.amanah.childagent.data.DeviceStore
import com.amanah.childagent.net.PairingApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class PairingUiState(
    val stage: Stage = Stage.ScanQr,
    val sessionId: String = "",
    val code: String = "",
    val isBusy: Boolean = false,
    val error: String? = null,
    val paired: Boolean = false
) {
    enum class Stage { ScanQr, EnterCode, Done }
}

class PairingViewModel(app: Application) : AndroidViewModel(app) {

    private val store = DeviceStore(app.applicationContext)
    private val api = PairingApi()

    private val _state = MutableStateFlow(PairingUiState())
    val state: StateFlow<PairingUiState> = _state

    fun onQrPayload(payload: String) {
        // Expected: AMANAH_PAIR:v1:<sessionId>
        val sessionId = parseSessionId(payload)
        if (sessionId.isBlank()) {
            _state.value = _state.value.copy(error = "QR غير صالح. حاول مرة أخرى.")
            return
        }
        _state.value = _state.value.copy(
            stage = PairingUiState.Stage.EnterCode,
            sessionId = sessionId,
            error = null
        )
    }

    fun onCodeChange(code: String) {
        val sanitized = code.filter { it.isDigit() }.take(6)
        _state.value = _state.value.copy(code = sanitized, error = null)
    }

    fun submitCode() {
        val s = _state.value
        if (s.sessionId.isBlank()) {
            _state.value = s.copy(error = "جلسة الاقتران غير موجودة.")
            return
        }
        if (s.code.length != 6) {
            _state.value = s.copy(error = "أدخل الكود المكون من 6 أرقام.")
            return
        }

        _state.value = s.copy(isBusy = true, error = null)

        viewModelScope.launch {
            try {
                val req = PairingApi.VerifyRequest(
                    sessionId = s.sessionId,
                    code = s.code,
                    device = PairingApi.DeviceInfo(
                        platform = "android",
                        model = Build.MODEL ?: "unknown",
                        osVersion = Build.VERSION.RELEASE ?: "unknown",
                        appVersion = "1.0.0"
                    )
                )
                val res = api.verify(req)

                if (!res.ok) {
                    _state.value = _state.value.copy(
                        isBusy = false,
                        error = res.error ?: "فشل الاقتران. تحقق من الكود وحاول مرة أخرى."
                    )
                    return@launch
                }

                // Store securely for later use (FCM commands, policy sync, etc.)
                store.savePairing(
                    deviceId = res.deviceId.orEmpty(),
                    parentUid = res.parentUid.orEmpty(),
                    accessToken = res.accessToken.orEmpty()
                )

                _state.value = _state.value.copy(
                    isBusy = false,
                    paired = true,
                    stage = PairingUiState.Stage.Done,
                    error = null
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isBusy = false,
                    error = "تعذر الاتصال بالسيرفر. تحقق من الإنترنت أو إعدادات السيرفر."
                )
            }
        }
    }

    fun restart() {
        _state.value = PairingUiState()
    }

    private fun parseSessionId(payload: String): String {
        // Strict format to avoid accepting random URLs
        val prefix = "AMANAH_PAIR:v1:"
        return if (payload.startsWith(prefix)) payload.removePrefix(prefix).trim() else ""
    }
}
