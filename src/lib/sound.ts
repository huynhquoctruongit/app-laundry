import Sound from 'react-native-sound';

// Phát qua loa media; không kẹt theo chế độ im lặng (iOS) — Android dùng media volume.
Sound.setCategory('Playback', false);

let coin: Sound | null = null;

function load() {
  // Android: file nằm ở res/raw/dong_xu_roi.mp3 → tên KHÔNG kèm đuôi.
  coin = new Sound('dong_xu_roi', Sound.MAIN_BUNDLE, (err) => {
    if (err) coin = null;
  });
}
load();

/** Phát tiếng "đồng xu rơi" khi hoàn thành đơn. Fire-and-forget, không throw. */
export function playCoinSound() {
  try {
    if (!coin) {
      load();
      return;
    }
    // stop trước để phát lại được khi hoàn thành nhiều đơn liên tiếp
    coin.stop(() => coin?.play());
  } catch {
    // bỏ qua mọi lỗi âm thanh — không ảnh hưởng nghiệp vụ
  }
}
