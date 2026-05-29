# Giặt Sấy Nhanh — React Native POS (Sunmi T2)

App quản lý tiệm giặt sấy chạy trên máy POS **Sunmi T2** (Android 7, 15.6" landscape, máy in nhiệt 80mm tích hợp). Clone từ web app Next.js.

## Sunmi T2 specs (target device)
- Android 7 (Sunmi OS) — minSdk 24
- Snapdragon octa-core 1.8GHz, 2GB RAM, 16GB ROM
- 15.6" Full HD (1920×1080) landscape touchscreen
- Built-in 80mm thermal printer (200mm/s, auto-cut)
- WiFi 2.4/5G, BT 4.0, 4G
- 5×USB, RJ11, RJ12 (cash drawer), RJ45, audio jack

## Tech stack
- React Native 0.73 (Android 7 compatible)
- React Navigation v6 (Drawer permanent + Native Stack)
- @tanstack/react-query (server state)
- Axios (HTTP)
- AsyncStorage (token, settings)
- react-native-sunmi-inner-printer (máy in tích hợp)
- react-native-vector-icons (Material Community)
- react-native-toast-message
- react-native-svg, react-native-qrcode-svg

## Setup

```bash
# 1. Cài Node 18+, JDK 11, Android Studio + SDK platform 24 (Android 7)

# 2. Cài deps
cd /Users/mac/Documents/Source/laundry-pos-rn
npm install

# 3. Lần đầu cần init RN native folders (android/, ios/) — nếu chưa có:
#    npx react-native init temp --version 0.73.2 --skip-install
#    Rồi copy thư mục android/ từ "temp" sang đây
#    Hoặc dùng: npx @react-native-community/cli init --template ... 

# 4. Chỉnh android/build.gradle:
#    minSdkVersion = 24 (Android 7)
#    compileSdkVersion = 33 (hoặc 34)
#    targetSdkVersion = 33

# 5. Chỉnh android/app/build.gradle thêm:
#    android { defaultConfig { ... missingDimensionStrategy 'react-native-camera', 'general' } }

# 6. Cấu hình API URL trong app (Settings → API & Máy in) hoặc sửa
#    src/api/client.ts:DEFAULT_API_URL về địa chỉ backend LAN

# 7. Build & run
npx react-native run-android
# hoặc cài APK trực tiếp lên Sunmi T2 qua ADB
```

## Bản release (APK) — icon bị ô vuông / dấu X

Trên **release**, Metro không chạy và font icon phải nằm trong APK. Project đã áp dụng `react-native-vector-icons/fonts.gradle` trong `android/app/build.gradle` và chỉ bundle **`MaterialCommunityIcons.ttf`** (đúng với mã nguồn hiện tại). Nếu sau này dùng thêm bộ icon khác (ví dụ `Ionicons`), thêm tên file `.ttf` tương ứng vào `project.ext.vectoricons.iconFontNames` rồi build lại APK.

## Cấu hình landscape lock + Sunmi printer

**`android/app/src/main/AndroidManifest.xml`**:
```xml
<activity
    android:name=".MainActivity"
    android:screenOrientation="landscape"
    android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
    ...>
```

**`android/build.gradle`** — đảm bảo Sunmi maven repo có thể resolve (printer SDK):
```gradle
allprojects {
    repositories {
        maven { url 'https://oss.sonatype.org/content/repositories/snapshots' }
        // ... google(), mavenCentral()
    }
}
```

**`android/app/build.gradle`** — minSdk:
```gradle
defaultConfig {
    minSdkVersion 24      // Android 7
    targetSdkVersion 33
    ...
}
```

## Cấu trúc

```
src/
├── api/              # API services (axios)
├── components/
│   ├── ui/           # Button, Input, Card, Badge
│   └── common/       # OrderStatusBadge, EmptyState
├── helpers/enums/    # OrderStatus, labels, transitions
├── hooks/            # useAuth
├── lib/utils.ts      # formatCurrency, formatDateTime, ...
├── native/
│   └── SunmiPrinter.ts  # In hóa đơn + tem + mở két tiền (RJ12)
├── navigation/       # RootNavigator, AppDrawer
├── screens/          # 13 screens (auth, dashboard, orders, ...)
├── theme/            # colors, spacing
└── types/api.ts      # TypeScript types từ API
```

## Tính năng đã port từ web

- [x] Đăng nhập (JWT, AsyncStorage)
- [x] Dashboard: doanh thu, lợi nhuận, đơn mới, đã giao, todo list, shortcuts, ẩn/hiện số
- [x] Đơn hàng: list, filter status, search, tạo, xem chi tiết, cập nhật trạng thái
- [x] **In hóa đơn trực tiếp** lên máy in nhiệt 80mm Sunmi (ESC/POS, không cần popup)
- [x] Khách hàng / Nhà cung cấp CRUD
- [x] Sản phẩm CRUD + giá nhập/giá vốn
- [x] Kho hàng: items + nhập/xuất/điều chỉnh, cảnh báo tồn thấp
- [x] Thu chi (Transaction)
- [x] Sổ nợ (khách + nhà cung cấp), đánh dấu đã trả
- [x] Ca làm việc + chấm công
- [x] Báo cáo (tài chính, bán hàng, kho)
- [x] Quản lý nhân viên + phân quyền (admin only)
- [x] Cài đặt cửa hàng + cấu hình hóa đơn + cỡ chữ tùy chỉnh
- [x] Mở két tiền (RJ12)
- [x] Quét QR (cần cài react-native-vision-camera, có fallback manual)

## API backend
Sử dụng cùng backend với web app: `/Users/mac/Documents/Source/nodejs` (Node.js + Express + Prisma + PostgreSQL). Đảm bảo backend chạy ở địa chỉ LAN mà Sunmi T2 truy cập được.

## Kiosk mode

Trên Sunmi T2 nên cài app này là **Home App** để khóa nhân viên không thoát ra ngoài. Trong Sunmi launcher → Settings → Default home app → **Giặt Sấy Nhanh**.
