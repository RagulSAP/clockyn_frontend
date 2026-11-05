/** Clipboard — NATIVE implementation (expo-clipboard). */
import * as Clipboard from 'expo-clipboard';

/** Copies text. Resolves `false` when the platform refused. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

export async function readClipboardText(): Promise<string> {
  try {
    return await Clipboard.getStringAsync();
  } catch {
    return '';
  }
}
