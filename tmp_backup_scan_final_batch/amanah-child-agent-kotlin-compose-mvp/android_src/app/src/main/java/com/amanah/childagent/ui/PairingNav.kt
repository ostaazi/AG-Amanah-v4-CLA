package com.amanah.childagent.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.amanah.childagent.PairingUiState
import com.amanah.childagent.PairingViewModel
import com.amanah.childagent.ui.screens.DoneScreen
import com.amanah.childagent.ui.screens.EnterCodeScreen
import com.amanah.childagent.ui.screens.ScanQrScreen

@Composable
fun PairingNav(vm: PairingViewModel) {
    val state by vm.state.collectAsState()

    when (state.stage) {
        PairingUiState.Stage.ScanQr -> ScanQrScreen(
            error = state.error,
            onPayload = vm::onQrPayload
        )
        PairingUiState.Stage.EnterCode -> EnterCodeScreen(
            sessionId = state.sessionId,
            code = state.code,
            isBusy = state.isBusy,
            error = state.error,
            onCodeChange = vm::onCodeChange,
            onSubmit = vm::submitCode,
            onBack = vm::restart
        )
        PairingUiState.Stage.Done -> DoneScreen(
            onRestart = vm::restart
        )
    }
}
