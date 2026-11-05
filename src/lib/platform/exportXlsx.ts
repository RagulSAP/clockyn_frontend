import { buildWorkbookBytes, type XlsxBuildOptions } from './exportXlsxCore';

/**
 * Web: builds a real .xlsx workbook. `xlsx` is loaded on demand so its ~0.5 MB stays out of the shared web
 * chunks (native uses a static import — see `exportXlsx.native.ts`).
 */
export async function buildXlsxBytes(opts: XlsxBuildOptions): Promise<Uint8Array> {
  return buildWorkbookBytes(await import('xlsx'), opts);
}
