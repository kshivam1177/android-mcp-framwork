import { spawn } from 'node:child_process';

export interface ScreenshotTextElement {
  text: string;
  confidence: number;
  bounds: { left: number; top: number; right: number; bottom: number };
  center: { x: number; y: number };
}
export interface ScreenshotAnalysis {
  engine: 'tesseract'; language: string; width?: number; height?: number; elements: ScreenshotTextElement[];
}
export interface ScreenshotAnalysisOptions {
  language?: string; minConfidence?: number; mode?: 'line' | 'word'; timeoutMs?: number;
}
interface OcrWord extends ScreenshotTextElement { lineKey: string }
const num = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function parseTesseractTsv(
  tsv: string,
  options: Pick<ScreenshotAnalysisOptions, 'minConfidence' | 'mode'> = {}
): Pick<ScreenshotAnalysis, 'width' | 'height' | 'elements'> {
  const rows = tsv.split(/\r?\n/);
  const header = rows.shift()?.split('\t') ?? [];
  const col = (name: string) => header.indexOf(name);
  const idx = {
    level: col('level'), page: col('page_num'), block: col('block_num'),
    para: col('par_num'), line: col('line_num'), left: col('left'),
    top: col('top'), width: col('width'), height: col('height'),
    conf: col('conf'), text: col('text'),
  };
  if (Object.values(idx).some((value) => value < 0)) throw new Error('Tesseract returned TSV without the expected header columns.');
  let width: number | undefined;
  let height: number | undefined;
  const words: OcrWord[] = [];
  for (const row of rows) {
    if (!row.trim()) continue;
    const c = row.split('\t');
    const level = num(c[idx.level]);
    const left = num(c[idx.left]); const top = num(c[idx.top]);
    const w = num(c[idx.width]); const h = num(c[idx.height]);
    if (level === 1) { width = w || width; height = h || height; continue; }
    if (level !== 5) continue;
    const text = (c[idx.text] ?? '').trim(); const confidence = num(c[idx.conf]);
    if (!text || confidence < (options.minConfidence ?? 35) || w <= 0 || h <= 0) continue;
    words.push({
      text, confidence: Math.round(confidence * 100) / 100,
      bounds: { left, top, right: left + w, bottom: top + h },
      center: { x: Math.round(left + w / 2), y: Math.round(top + h / 2) },
      lineKey: [c[idx.page], c[idx.block], c[idx.para], c[idx.line]].join(':'),
    });
  }
  if (options.mode === 'word') return { width, height, elements: words.map(({ lineKey: _key, ...word }) => word) };
  const grouped = new Map<string, OcrWord[]>();
  for (const word of words) { const line = grouped.get(word.lineKey) ?? []; line.push(word); grouped.set(word.lineKey, line); }
  const elements = Array.from(grouped.values()).map((line) => {
    const left = Math.min(...line.map((w) => w.bounds.left)); const top = Math.min(...line.map((w) => w.bounds.top));
    const right = Math.max(...line.map((w) => w.bounds.right)); const bottom = Math.max(...line.map((w) => w.bounds.bottom));
    return {
      text: line.map((w) => w.text).join(' '),
      confidence: Math.round(line.reduce((sum, w) => sum + w.confidence, 0) / line.length * 100) / 100,
      bounds: { left, top, right, bottom },
      center: { x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2) },
    };
  });
  return { width, height, elements };
}

/** OCR screenshot bytes through local Tesseract; no temp files or shell interpolation. */
export async function analyzeScreenshot(image: Buffer, options: ScreenshotAnalysisOptions = {}): Promise<ScreenshotAnalysis> {
  if (!image.length) throw new Error('Screenshot is empty.');
  const language = options.language ?? 'eng';
  if (!/^[a-zA-Z0-9_+-]+$/.test(language)) throw new Error('Invalid OCR language code. Use a Tesseract language code such as "eng".');
  const child = spawn(process.env.TESSERACT_PATH || 'tesseract', ['stdin', 'stdout', '-l', language, '--psm', '11', 'tsv'], {
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  const stdout: Buffer[] = []; const stderr: Buffer[] = [];
  let outputBytes = 0; const maxOutputBytes = 16 * 1024 * 1024;
  return await new Promise<ScreenshotAnalysis>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, result?: ScreenshotAnalysis) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else if (result) resolve(result); else reject(new Error('Screenshot OCR ended without a result.'));
    };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Screenshot OCR timed out. Try a smaller screenshot or increase the timeout.')); }, Math.max(1000, options.timeoutMs ?? 30000));
    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) { child.kill(); finish(new Error('Screenshot OCR output exceeded the 16 MiB safety limit.')); return; }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => { if (stderr.reduce((size, item) => size + item.length, 0) < 16384) stderr.push(chunk); });
    child.once('error', (error) => finish(new Error(error.message.includes('ENOENT')
      ? 'Tesseract OCR is not installed or is not on PATH. Install Tesseract OCR or set TESSERACT_PATH.'
      : error.message)));
    child.once('close', (code) => {
      if (settled) return;
      if (code !== 0) { const detail = Buffer.concat(stderr).toString('utf8').trim(); finish(new Error(`Tesseract OCR failed (exit ${code}).${detail ? ` ${detail}` : ''}`)); return; }
      try { finish(undefined, { engine: 'tesseract', language, ...parseTesseractTsv(Buffer.concat(stdout).toString('utf8'), options) }); }
      catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    });
    child.stdin.once('error', (error) => finish(new Error(`Unable to send screenshot to Tesseract: ${error.message}`)));
    child.stdin.end(image);
  });
}
