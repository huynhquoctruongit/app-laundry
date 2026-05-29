import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PrinterLocalConfig } from './types';

const KEY = '@printer_config';

export async function loadPrinterConfig(): Promise<PrinterLocalConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PrinterLocalConfig) : null;
  } catch {
    return null;
  }
}

export async function savePrinterConfig(config: PrinterLocalConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(config));
}

export async function clearPrinterConfig(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
