package com.amanah.childagent.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
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
import com.amanah.childagent.ui.widgets.Otp6Field

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EnterCodeScreen(
    sessionId: String,
    code: String,
    isBusy: Boolean,
    error: String?,
    onCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onBack: () -> Unit
) {
    val snack = remember { SnackbarHostState() }

    LaunchedEffect(error) {
        if (!error.isNullOrBlank()) snack.showSnackbar(error)
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("إدخال كود الاقتران") }) },
        snackbarHost = { SnackbarHost(hostState = snack) }
    ) { inner ->
        Column(
            modifier = Modifier
                .padding(inner)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("تم قراءة QR بنجاح.")
            Text("Session: " + sessionId.take(10) + "…")

            Otp6Field(value = code, onValueChange = onCodeChange)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onBack,
                    enabled = !isBusy,
                    modifier = Modifier.weight(1f)
                ) { Text("رجوع") }

                Button(
                    onClick = onSubmit,
                    enabled = !isBusy && code.length == 6,
                    modifier = Modifier.weight(1f)
                ) {
                    if (isBusy) {
                        CircularProgressIndicator(strokeWidth = 2.dp)
                        Spacer(Modifier.padding(6.dp))
                    }
                    Text("اقتران")
                }
            }
            Spacer(Modifier.height(4.dp))
            Text("اطلب من الوالد كود الاقتران المكوّن من 6 أرقام.")
        }
    }
}
