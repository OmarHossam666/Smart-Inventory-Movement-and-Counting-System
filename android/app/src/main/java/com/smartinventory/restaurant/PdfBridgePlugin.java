package com.smartinventory.restaurant;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

@CapacitorPlugin(name = "PdfBridge")
public class PdfBridgePlugin extends Plugin {
    private static final String PDF_MIME_TYPE = "application/pdf";
    private static final int MAX_ENCODED_PDF_LENGTH = 36 * 1024 * 1024;

    @PluginMethod
    public void openPdf(PluginCall call) {
        try {
            File file = writeCachePdf(call);
            Uri uri = getShareableUri(file);
            Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, PDF_MIME_TYPE)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                call.reject("لا يوجد تطبيق مثبت يمكنه فتح ملفات PDF.", "NO_PDF_VIEWER");
                return;
            }
            getActivity().startActivity(intent);
            resolveUri(call, uri);
        } catch (Exception error) {
            call.reject("تعذر فتح ملف PDF.", "OPEN_PDF_FAILED", error);
        }
    }

    @PluginMethod
    public void savePdf(PluginCall call) {
        try {
            String fileName = safeFileName(call.getString("fileName", "inventory-report.pdf"));
            byte[] bytes = decodePdf(call);
            Uri uri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, PDF_MIME_TYPE);
                values.put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/SmartInventory"
                );
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IOException("Unable to create download.");
                try (OutputStream output = resolver.openOutputStream(uri)) {
                    if (output == null) throw new IOException("Unable to open download.");
                    output.write(bytes);
                }
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            } else {
                File directory = new File(
                    getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                    "SmartInventory"
                );
                if (!directory.exists() && !directory.mkdirs()) {
                    throw new IOException("Unable to create download directory.");
                }
                File file = new File(directory, fileName);
                try (FileOutputStream output = new FileOutputStream(file)) {
                    output.write(bytes);
                }
                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[]{file.getAbsolutePath()},
                    new String[]{PDF_MIME_TYPE},
                    null
                );
                uri = Uri.fromFile(file);
            }
            resolveUri(call, uri);
        } catch (Exception error) {
            call.reject("تعذر حفظ ملف PDF في التنزيلات.", "SAVE_PDF_FAILED", error);
        }
    }

    @PluginMethod
    public void sharePdfToWhatsApp(PluginCall call) {
        try {
            File file = writeCachePdf(call);
            Uri uri = getShareableUri(file);
            String packageName = findWhatsAppPackage();
            if (packageName == null) {
                call.reject("واتساب غير مثبت على هذا الجهاز.", "WHATSAPP_NOT_INSTALLED");
                return;
            }

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(PDF_MIME_TYPE);
            intent.setPackage(packageName);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
            intent.setClipData(ClipData.newUri(getContext().getContentResolver(), "PDF", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().grantUriPermission(
                packageName,
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
            getActivity().startActivity(intent);

            JSObject result = new JSObject();
            result.put("packageName", packageName);
            call.resolve(result);
        } catch (ActivityNotFoundException error) {
            call.reject("تعذر فتح واتساب.", "WHATSAPP_NOT_INSTALLED", error);
        } catch (Exception error) {
            call.reject("تعذر إرفاق ملف PDF في واتساب.", "WHATSAPP_SHARE_FAILED", error);
        }
    }

    private File writeCachePdf(PluginCall call) throws IOException {
        File directory = new File(getContext().getCacheDir(), "reports");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Unable to create report cache.");
        }
        File file = new File(
            directory,
            safeFileName(call.getString("fileName", "inventory-report.pdf"))
        );
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(decodePdf(call));
        }
        return file;
    }

    private byte[] decodePdf(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            throw new IllegalArgumentException("PDF data is required.");
        }
        if (base64.length() > MAX_ENCODED_PDF_LENGTH) {
            throw new IllegalArgumentException("PDF data is too large.");
        }
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        byte[] signature = "%PDF-".getBytes(StandardCharsets.US_ASCII);
        if (
            bytes.length < signature.length ||
            !Arrays.equals(Arrays.copyOf(bytes, signature.length), signature)
        ) {
            throw new IllegalArgumentException("Invalid PDF data.");
        }
        return bytes;
    }

    private String safeFileName(String value) {
        String sanitized = value.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!sanitized.toLowerCase().endsWith(".pdf")) sanitized += ".pdf";
        return sanitized;
    }

    private Uri getShareableUri(File file) {
        return FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            file
        );
    }

    private String findWhatsAppPackage() {
        if (
            getContext().getPackageManager().getLaunchIntentForPackage("com.whatsapp") != null
        ) {
            return "com.whatsapp";
        }
        if (
            getContext().getPackageManager().getLaunchIntentForPackage("com.whatsapp.w4b") != null
        ) {
            return "com.whatsapp.w4b";
        }
        return null;
    }

    private void resolveUri(PluginCall call, Uri uri) {
        JSObject result = new JSObject();
        result.put("uri", uri.toString());
        call.resolve(result);
    }
}
