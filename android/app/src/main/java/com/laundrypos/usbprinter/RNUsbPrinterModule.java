package com.laundrypos.usbprinter;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.Nullable;

import cn.jystudio.bluetooth.escpos.command.sdk.Command;
import cn.jystudio.bluetooth.escpos.command.sdk.PrintPicture;
import cn.jystudio.bluetooth.escpos.command.sdk.PrinterCommand;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Máy in nhiệt ESC/POS cắm dây qua USB (OTG). Dùng thẳng android.hardware.usb
 * (chuẩn Android, không cần lib ngoài) để giao tiếp qua bulk endpoint, và tái
 * dùng nguyên bộ build byte ESC/POS (Command/PrinterCommand/PrintPicture) từ
 * react-native-bluetooth-escpos-printer — bộ này thuần build byte[], không tự
 * gửi qua Bluetooth, nên dùng lại được 100% cho USB.
 */
public class RNUsbPrinterModule extends ReactContextBaseJavaModule {
    private static final String TAG = "RNUsbPrinter";
    private static final String ACTION_USB_PERMISSION = "com.laundrypos.usbprinter.USB_PERMISSION";
    private static final int WIDTH_58 = 384;
    private static final int USB_TIMEOUT_MS = 3000;
    private static final int MAX_CHUNK = 4096;

    private final ReactApplicationContext reactContext;
    private final UsbManager usbManager;

    private int deviceWidth = WIDTH_58;
    private UsbDeviceConnection connection;
    private UsbInterface usbInterface;
    private UsbEndpoint endpointOut;

    public RNUsbPrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.usbManager = (UsbManager) reactContext.getSystemService(Context.USB_SERVICE);
    }

    @Override
    public String getName() {
        return "RNUsbPrinter";
    }

    // ─── Device discovery & connection ─────────────────────────────────────

    @ReactMethod
    public void listDevices(final Promise promise) {
        WritableArray result = Arguments.createArray();
        if (usbManager != null) {
            for (UsbDevice device : usbManager.getDeviceList().values()) {
                WritableMap m = Arguments.createMap();
                m.putInt("deviceId", device.getDeviceId());
                m.putString("name", device.getDeviceName());
                m.putInt("vendorId", device.getVendorId());
                m.putInt("productId", device.getProductId());
                result.pushMap(m);
            }
        }
        promise.resolve(result);
    }

    @ReactMethod
    public void requestPermission(final int deviceId, final Promise promise) {
        final UsbDevice device = findDevice(deviceId);
        if (usbManager == null || device == null) {
            promise.resolve(false);
            return;
        }
        if (usbManager.hasPermission(device)) {
            promise.resolve(true);
            return;
        }

        final BroadcastReceiver[] receiverHolder = new BroadcastReceiver[1];
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
                try {
                    reactContext.unregisterReceiver(receiverHolder[0]);
                } catch (Exception ignored) { /* already unregistered */ }
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                promise.resolve(granted);
            }
        };
        receiverHolder[0] = receiver;

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            reactContext.registerReceiver(receiver, filter);
        }

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(reactContext, 0, new Intent(ACTION_USB_PERMISSION), piFlags);
        usbManager.requestPermission(device, pi);
    }

    @ReactMethod
    public void connect(final int deviceId, final Promise promise) {
        UsbDevice device = findDevice(deviceId);
        if (usbManager == null || device == null) {
            promise.reject("DEVICE_NOT_FOUND", "Không tìm thấy thiết bị USB");
            return;
        }
        if (!usbManager.hasPermission(device)) {
            promise.reject("NO_PERMISSION", "Chưa được cấp quyền truy cập USB");
            return;
        }

        UsbInterface foundInterface = null;
        UsbEndpoint foundEndpoint = null;
        for (int i = 0; i < device.getInterfaceCount() && foundEndpoint == null; i++) {
            UsbInterface intf = device.getInterface(i);
            for (int e = 0; e < intf.getEndpointCount(); e++) {
                UsbEndpoint ep = intf.getEndpoint(e);
                if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK
                        && ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                    foundInterface = intf;
                    foundEndpoint = ep;
                    break;
                }
            }
        }
        if (foundInterface == null || foundEndpoint == null) {
            promise.reject("NO_BULK_ENDPOINT", "Máy in không có bulk-out endpoint (không phải máy in ESC/POS chuẩn?)");
            return;
        }

        UsbDeviceConnection conn = usbManager.openDevice(device);
        if (conn == null) {
            promise.reject("OPEN_FAILED", "Không mở được kết nối USB");
            return;
        }
        if (!conn.claimInterface(foundInterface, true)) {
            conn.close();
            promise.reject("CLAIM_FAILED", "Không chiếm được interface USB");
            return;
        }

        disconnectInternal();
        this.connection = conn;
        this.usbInterface = foundInterface;
        this.endpointOut = foundEndpoint;
        promise.resolve(true);
    }

    @ReactMethod
    public void disconnect(final Promise promise) {
        disconnectInternal();
        promise.resolve(null);
    }

    @ReactMethod
    public void isConnected(final Promise promise) {
        promise.resolve(connection != null && endpointOut != null);
    }

    private void disconnectInternal() {
        if (connection != null) {
            if (usbInterface != null) {
                try { connection.releaseInterface(usbInterface); } catch (Exception ignored) {}
            }
            try { connection.close(); } catch (Exception ignored) {}
        }
        connection = null;
        usbInterface = null;
        endpointOut = null;
    }

    private UsbDevice findDevice(int deviceId) {
        if (usbManager == null) return null;
        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (device.getDeviceId() == deviceId) return device;
        }
        return null;
    }

    // ─── ESC/POS commands (cùng API với NativeModules.BluetoothEscposPrinter) ──

    @ReactMethod
    public void setWidth(int width) {
        deviceWidth = width;
    }

    @ReactMethod
    public void printerInit(final Promise promise) {
        if (sendDataByte(PrinterCommand.POS_Set_PrtInit())) {
            promise.resolve(null);
        } else {
            promise.reject("COMMAND_NOT_SEND");
        }
    }

    @ReactMethod
    public void printerAlign(int align, final Promise promise) {
        if (sendDataByte(PrinterCommand.POS_S_Align(align))) {
            promise.resolve(null);
        } else {
            promise.reject("COMMAND_NOT_SEND");
        }
    }

    @ReactMethod
    public void setBlob(int weight, final Promise promise) {
        if (sendDataByte(PrinterCommand.POS_Set_Bold(weight))) {
            promise.resolve(null);
        } else {
            promise.reject("COMMAND_NOT_SEND");
        }
    }

    @ReactMethod
    public void printText(String text, @Nullable ReadableMap options, final Promise promise) {
        try {
            String encoding = "GBK";
            int codepage = 0;
            int widthTimes = 0;
            int heigthTimes = 0;
            int fonttype = 0;
            if (options != null) {
                encoding = options.hasKey("encoding") ? options.getString("encoding") : "GBK";
                codepage = options.hasKey("codepage") ? options.getInt("codepage") : 0;
                widthTimes = options.hasKey("widthtimes") ? options.getInt("widthtimes") : 0;
                heigthTimes = options.hasKey("heigthtimes") ? options.getInt("heigthtimes") : 0;
                fonttype = options.hasKey("fonttype") ? options.getInt("fonttype") : 0;
            }
            byte[] bytes = PrinterCommand.POS_Print_Text(text, encoding, codepage, widthTimes, heigthTimes, fonttype);
            if (sendDataByte(bytes)) {
                promise.resolve(null);
            } else {
                promise.reject("COMMAND_NOT_SEND");
            }
        } catch (Exception e) {
            promise.reject(e.getMessage(), e);
        }
    }

    @ReactMethod
    public void printColumn(ReadableArray columnWidths, ReadableArray columnAligns, ReadableArray columnTexts,
                             @Nullable ReadableMap options, final Promise promise) {
        if (columnWidths.size() != columnTexts.size() || columnWidths.size() != columnAligns.size()) {
            promise.reject("COLUMN_WIDTHS_ALIGNS_AND_TEXTS_NOT_MATCH");
            return;
        }
        int totalLen = 0;
        for (int i = 0; i < columnWidths.size(); i++) {
            totalLen += columnWidths.getInt(i);
        }
        int maxLen = deviceWidth / 8;
        if (totalLen > maxLen) {
            promise.reject("COLUNM_WIDTHS_TOO_LARGE");
            return;
        }

        String encoding = "GBK";
        int codepage = 0;
        int widthTimes = 0;
        int heigthTimes = 0;
        int fonttype = 0;
        if (options != null) {
            encoding = options.hasKey("encoding") ? options.getString("encoding") : "GBK";
            codepage = options.hasKey("codepage") ? options.getInt("codepage") : 0;
            widthTimes = options.hasKey("widthtimes") ? options.getInt("widthtimes") : 0;
            heigthTimes = options.hasKey("heigthtimes") ? options.getInt("heigthtimes") : 0;
            fonttype = options.hasKey("fonttype") ? options.getInt("fonttype") : 0;
        }

        List<List<String>> table = new ArrayList<>();
        int padding = 1;
        for (int i = 0; i < columnWidths.size(); i++) {
            int width = columnWidths.getInt(i) - padding;
            String text = String.copyValueOf(columnTexts.getString(i).toCharArray());
            List<ColumnSplitedString> splited = new ArrayList<>();
            int shorter = 0;
            int counter = 0;
            String temp = "";
            for (int c = 0; c < text.length(); c++) {
                char ch = text.charAt(c);
                int l = isChinese(ch) ? 2 : 1;
                if (l == 2) shorter++;
                temp = temp + ch;
                if (counter + l < width) {
                    counter = counter + l;
                } else {
                    splited.add(new ColumnSplitedString(shorter, temp));
                    temp = "";
                    counter = 0;
                    shorter = 0;
                }
            }
            if (temp.length() > 0) {
                splited.add(new ColumnSplitedString(shorter, temp));
            }
            int align = columnAligns.getInt(i);

            List<String> formated = new ArrayList<>();
            for (ColumnSplitedString s : splited) {
                StringBuilder empty = new StringBuilder();
                for (int w = 0; w < (width + padding - s.shorter); w++) {
                    empty.append(" ");
                }
                int startIdx = 0;
                String ss = s.str;
                if (align == 1 && ss.length() < (width - s.shorter)) {
                    startIdx = (width - s.shorter - ss.length()) / 2;
                    if (startIdx + ss.length() > width - s.shorter) startIdx--;
                    if (startIdx < 0) startIdx = 0;
                } else if (align == 2 && ss.length() < (width - s.shorter)) {
                    startIdx = width - s.shorter - ss.length();
                }
                empty.replace(startIdx, startIdx + ss.length(), ss);
                formated.add(empty.toString());
            }
            table.add(formated);
        }

        int maxRowCount = 0;
        for (List<String> rows : table) {
            if (rows.size() > maxRowCount) maxRowCount = rows.size();
        }

        StringBuilder[] rowsToPrint = new StringBuilder[maxRowCount];
        for (int column = 0; column < table.size(); column++) {
            List<String> rows = table.get(column);
            for (int row = 0; row < maxRowCount; row++) {
                if (rowsToPrint[row] == null) rowsToPrint[row] = new StringBuilder();
                if (row < rows.size()) {
                    rowsToPrint[row].append(rows.get(row));
                } else {
                    int w = columnWidths.getInt(column);
                    StringBuilder empty = new StringBuilder();
                    for (int i = 0; i < w; i++) empty.append(" ");
                    rowsToPrint[row].append(empty.toString());
                }
            }
        }

        for (StringBuilder row : rowsToPrint) {
            row.append("\n\r");
            try {
                if (!sendDataByte(PrinterCommand.POS_Print_Text(row.toString(), encoding, codepage, widthTimes, heigthTimes, fonttype))) {
                    promise.reject("COMMAND_NOT_SEND");
                    return;
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        promise.resolve(null);
    }

    @ReactMethod
    public void printBarCode(String str, int nType, int nWidthX, int nHeight,
                              int nHriFontType, int nHriFontPosition, final Promise promise) {
        try {
            byte[] command = PrinterCommand.getBarCodeCommand(str, nType, nWidthX, nHeight, nHriFontType, nHriFontPosition);
            if (sendDataByte(command)) {
                promise.resolve(null);
            } else {
                promise.reject("COMMAND_NOT_SEND");
            }
        } catch (Exception e) {
            promise.reject(e.getMessage(), e);
        }
    }

    @ReactMethod
    public void printPic(String base64encodeStr, @Nullable ReadableMap options) {
        int width = 0;
        int leftPadding = 0;
        if (options != null) {
            width = options.hasKey("width") ? options.getInt("width") : 0;
            leftPadding = options.hasKey("left") ? options.getInt("left") : 0;
        }
        if (width > deviceWidth || width == 0) {
            width = deviceWidth;
        }

        byte[] bytes = Base64.decode(base64encodeStr, Base64.DEFAULT);
        Bitmap mBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (mBitmap != null) {
            byte[] data = PrintPicture.POS_PrintBMP(mBitmap, width, 0, leftPadding);
            sendDataByte(Command.ESC_Init);
            sendDataByte(Command.LF);
            sendDataByte(data);
            sendDataByte(PrinterCommand.POS_Set_PrtAndFeedPaper(30));
            sendDataByte(PrinterCommand.POS_Set_Cut(1));
            sendDataByte(PrinterCommand.POS_Set_PrtInit());
        }
    }

    @ReactMethod
    public void cutOnePoint(final Promise promise) {
        byte[] cmd = PrinterCommand.POS_Set_Cut(1);
        if (cmd != null && sendDataByte(cmd)) {
            promise.resolve(null);
        } else {
            promise.reject("COMMAND_NOT_SEND");
        }
    }

    // ─── Transport ──────────────────────────────────────────────────────────

    private boolean sendDataByte(byte[] data) {
        if (data == null || connection == null || endpointOut == null) {
            return false;
        }
        int offset = 0;
        while (offset < data.length) {
            int len = Math.min(MAX_CHUNK, data.length - offset);
            byte[] chunk = new byte[len];
            System.arraycopy(data, offset, chunk, 0, len);
            int sent = connection.bulkTransfer(endpointOut, chunk, len, USB_TIMEOUT_MS);
            if (sent < 0) {
                Log.w(TAG, "bulkTransfer failed at offset " + offset);
                return false;
            }
            offset += len;
        }
        return true;
    }

    private static boolean isChinese(char c) {
        Character.UnicodeBlock ub = Character.UnicodeBlock.of(c);
        return ub == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS
                || ub == Character.UnicodeBlock.CJK_COMPATIBILITY_IDEOGRAPHS
                || ub == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A
                || ub == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS_EXTENSION_B
                || ub == Character.UnicodeBlock.CJK_SYMBOLS_AND_PUNCTUATION
                || ub == Character.UnicodeBlock.HALFWIDTH_AND_FULLWIDTH_FORMS
                || ub == Character.UnicodeBlock.GENERAL_PUNCTUATION;
    }

    private static class ColumnSplitedString {
        final int shorter;
        final String str;

        ColumnSplitedString(int shorter, String str) {
            this.shorter = shorter;
            this.str = str;
        }
    }
}
