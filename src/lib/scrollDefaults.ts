/**
 * Fix double-tap khi máy quét đang bật.
 *
 * Khi scanner active, App.tsx giữ một hidden TextInput luôn focus để nhận
 * keystroke từ máy quét. Mặc định ScrollView/FlatList có
 * keyboardShouldPersistTaps="never" → khi có input focus, cú tap ĐẦU TIÊN lên
 * button bên trong scrollable bị "nuốt" để dismiss focus, nên phải tap lần 2.
 *
 * Đặt default "handled" toàn cục → tap luôn tới được button ngay lần đầu.
 * FlatList/SectionList đều render qua ScrollView nên chỉ cần patch ScrollView,
 * nhưng patch cả 3 cho chắc.
 */
import { ScrollView, FlatList, SectionList } from 'react-native';

function patchDefault(Component: unknown) {
  const c = Component as { defaultProps?: Record<string, unknown> };
  c.defaultProps = { ...(c.defaultProps || {}), keyboardShouldPersistTaps: 'handled' };
}

patchDefault(ScrollView);
patchDefault(FlatList);
patchDefault(SectionList);
