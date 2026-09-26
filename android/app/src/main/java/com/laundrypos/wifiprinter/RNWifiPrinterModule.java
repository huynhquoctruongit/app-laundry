package com.laundrypos.wifiprinter;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Máy in nhiệt ESC/POS qua WiFi (RAW/JetDirect, TCP cổng 9100 mặc định). Dùng
 * thẳng java.net.Socket (chuẩn Java, không cần lib ngoài) để gửi byte, và tái
 * dùng nguyên bộ build byte ESC/POS (Command/PrinterCommand/PrintPicture) từ
 * react-native-bluetooth-escpos-printer — bộ này thuần build byte[], không tự
 * gửi qua Bluetooth, nên dùng lại được 100% cho WiFi (giống RNUsbPrinterModule).
 */
public class RNWifiPrinterModule extends ReactContextBaseJavaModule {
    private static final String TAG = "RNWifiPrinter";
    private static final int WIDTH_58 = 384;
    private static final int SOCKET_TIMEOUT_MS = 3000;
    private static final int SCAN_TIMEOUT_MS = 250;
    private static final int SCAN_THREADS = 48;
    private static final int MAX_CHUNK = 4096;

    private int deviceWidth = WIDTH_58;
    private Socket socket;
    private OutputStream outputStream;

    public RNWifiPrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "RNWifiPrinter";
    }

    // ─── Discovery & connection ─────────────────────────────────────────────

    @ReactMethod
    public void scanNetwork(final String prefix, final int port, final Promise promise) {
        ExecutorService pool = Executors.newFixedThreadPool(SCAN_THREADS);
        List<Future<String>> futures = new ArrayList<>();
        for (int i = 1; i <= 254; i++) {
            final String ip = prefix + i;
            futures.add(pool.submit(new Callable<String>() {
                @Override
                public String call() {
                    try (Socket s = new Socket()) {
                        s.connect(new InetSocketAddress(ip, port), SCAN_TIMEOUT_MS);
                        return ip;
                    } catch (Exception e) {
                        return null;
                    }
                }
            }));
        }

        WritableArray result = Arguments.createArray();
        for (Future<String> f : futures) {
            try {
                String ip = f.get(2, TimeUnit.SECONDS);
                if (ip != null) {
                    WritableMap m = Arguments.createMap();
                    m.putString("ip", ip);
                    m.putInt("port", port);
                    result.pushMap(m);
                }
            } catch (Exception ignored) { /* timeout/không phản hồi */ }
        }
        pool.shutdownNow();
        promise.resolve(result);
    }

    @ReactMethod
    public void connect(final String ip, final int port, final Promise promise) {
        disconnectInternal();
        try {
            Socket s = new Socket();
            s.connect(new InetSocketAddress(ip, port), SOCKET_TIMEOUT_MS);
            this.socket = s;
            this.outputStream = s.getOutputStream();
            promise.resolve(true);
        } catch (Exception e) {
            disconnectInternal();
            promise.reject("CONNECT_FAILED", "Không kết nối được máy in WiFi: " + e.getMessage());
        }
    }

    @ReactMethod
    public void disconnect(final Promise promise) {
        disconnectInternal();
        promise.resolve(null);
    }

    @ReactMethod
    public void isConnected(final Promise promise) {
        promise.resolve(socket != null && socket.isConnected() && !socket.isClosed());
    }

    private void disconnectInternal() {
        try { if (outputStream != null) outputStream.close(); } catch (Exception ignored) {}
        try { if (socket != null) socket.close(); } catch (Exception ignored) {}
        socket = null;
        outputStream = null;
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
        if (data == null || outputStream == null) {
            return false;
        }
        int offset = 0;
        try {
            while (offset < data.length) {
                int len = Math.min(MAX_CHUNK, data.length - offset);
                outputStream.write(data, offset, len);
                offset += len;
            }
            outputStream.flush();
            return true;
        } catch (Exception e) {
            Log.w(TAG, "socket write failed at offset " + offset, e);
            return false;
        }
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
