package com.amanah.childagent.ui.screens

import android.Manifest
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.amanah.childagent.ui.widgets.CameraPermissionGate
import com.amanah.childagent.ui.widgets.QrScannerView

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanQrScreen(
    error: String?,
    onPayload: (String) -> Unit
) {
    val snack = remember { SnackbarHostState() }

    LaunchedEffect(error) {
        if (!error.isNullOrBlank()) snack.showSnackbar(error)
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Amanah — اقتران الجهاز") }) },
        snackbarHost = { SnackbarHost(hostState = snack) }
    ) { inner ->
        CameraPermissionGate(
            permission = Manifest.permission.CAMERA,
            rationale = "نحتاج الكاميرا لمسح رمز QR للاقتران."
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(inner)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("امسح رمز QR الظاهر على هاتف الأب.")
                QrScannerView(
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f),
                    onQr = { payload ->
                        onPayload(payload)
                    }
                )
                Text("بعد المسح ستُطلب منك كتابة كود الاقتران (6 أرقام).")
            }
        }
    }
}
