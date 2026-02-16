package com.amanah.childagent.ui.widgets

import android.annotation.SuppressLint
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.atomic.AtomicBoolean

@SuppressLint("UnsafeOptInUsageError")
@Composable
fun QrScannerView(
    modifier: Modifier = Modifier,
    onQr: (String) -> Unit
) {
    val context = LocalContext.current
    val scanned = remember { AtomicBoolean(false) }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            val previewView = PreviewView(ctx)
            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()

                val preview = Preview.Builder()
                    .build()
                    .also { it.setSurfaceProvider(previewView.surfaceProvider) }

                val analyzer = ImageAnalysis.Builder()
                    .setTargetResolution(Size(1280, 720))
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()

                val scanner = BarcodeScanning.getClient()

                analyzer.setAnalyzer(
                    ContextCompat.getMainExecutor(ctx)
                ) { imageProxy ->
                    try {
                        val mediaImage = imageProxy.image
                        if (mediaImage != null && !scanned.get()) {
                            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                            scanner.process(image)
                                .addOnSuccessListener { barcodes ->
                                    if (scanned.get()) return@addOnSuccessListener
                                    val qr = barcodes.firstOrNull()?.rawValue
                                    if (!qr.isNullOrBlank()) {
                                        scanned.set(true)
                                        onQr(qr)
                                    }
                                }
                                .addOnFailureListener { /* ignore */ }
                                .addOnCompleteListener { imageProxy.close() }
                        } else {
                            imageProxy.close()
                        }
                    } catch (_: Exception) {
                        imageProxy.close()
                    }
                }

                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
                try {
                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        ctx as LifecycleOwner,
                        cameraSelector,
                        preview,
                        analyzer
                    )
                } catch (_: Exception) {
                    // If context isn't a LifecycleOwner, user must embed this in an Activity.
                }
            }, ContextCompat.getMainExecutor(ctx))

            previewView
        }
    )
}
