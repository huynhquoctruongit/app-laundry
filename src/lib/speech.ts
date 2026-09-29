import Tts from 'react-native-tts';
import { playCoinSound } from './sound';

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', 'nghìn', 'triệu', 'tỷ'];

/** Đọc 1 nhóm 3 chữ số. `full` = nhóm không đứng đầu → đọc cả "không trăm", "linh". */
function readGroup(n: number, full: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const out: string[] = [];
  if (h > 0 || full) out.push(`${DIGITS[h]} trăm`);
  if (t === 0) {
    if (u > 0 && (h > 0 || full)) out.push('linh');
  } else if (t === 1) {
    out.push('mười');
  } else {
    out.push(`${DIGITS[t]} mươi`);
  }
  if (u > 0) {
    if (u === 1 && t >= 2) out.push('mốt');
    else if (u === 5 && t >= 1) out.push('lăm');
    else out.push(DIGITS[u]);
  }
  return out.join(' ');
}

/** 96500 → "chín mươi sáu nghìn năm trăm đồng" */
export function moneyToWords(amount: number): string {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return 'không đồng';
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (groups[i] === 0) continue;
    const isLeading = i === groups.length - 1;
    parts.push(`${readGroup(groups[i], !isLeading)} ${UNITS[i] ?? ''}`.trim());
  }
  return `${parts.join(' ')} đồng`;
}

let ready: Promise<boolean> | null = null;

function init(): Promise<boolean> {
  if (!ready) {
    ready = Tts.getInitStatus()
      .then(() => Tts.setDefaultLanguage('vi-VN'))
      .then(() => true)
      .catch(() => {
        ready = null; // thử lại lần sau (vd máy vừa cài giọng tiếng Việt)
        return false;
      });
  }
  return ready;
}
init();

/** Đọc to "Đã nhận … đồng" như loa. Máy không có giọng tiếng Việt → phát tiếng đồng xu. */
export async function speakReceived(amount: number) {
  try {
    const ok = await init();
    if (!ok) {
      playCoinSound();
      return;
    }
    Tts.stop();
    Tts.speak(`Đã nhận ${moneyToWords(amount)}`);
  } catch {
    playCoinSound();
  }
}
