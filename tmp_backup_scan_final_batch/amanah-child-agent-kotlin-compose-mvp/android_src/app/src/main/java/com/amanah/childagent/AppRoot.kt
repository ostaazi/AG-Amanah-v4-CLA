package com.amanah.childagent

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import com.amanah.childagent.ui.PairingNav

@Composable
fun AppRoot(vm: PairingViewModel = viewModel()) {
    PairingNav(vm = vm)
}
