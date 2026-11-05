/**
 * Clipboard — WEB / default implementation: async Clipboard API with a hidden-textarea `execCommand`
 * fallback for insecure contexts. The native implementation lives in `clipboard.native.ts`.
 */

/** Copies text. Resolves `false` when the browser refused. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

/** Reads text (needs a user gesture + permission in most browsers); empty string when unavailable. */
export async function readClipboardText(): Promise<string> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) return await navigator.clipboard.readText();
  } catch {
    /* permission denied */
  }
  return '';
}
