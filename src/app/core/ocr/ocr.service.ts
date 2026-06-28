import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';
import { LanguageService } from '@core/i18n/language.service';

export interface OcrResult {
  amount: number | null;
  date: string | null;      // YYYY-MM-DD
  merchant: string | null;
  rawText: string;
}

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

@Service()
export class OcrService {
  private readonly http        = inject(HttpClient);
  private readonly lang        = inject(LanguageService);
  private readonly sheetConfig = inject(SheetConfigService);

  /**
   * Sends a receipt image to Gemini Vision and extracts structured fields.
   * Falls back to Tesseract.js if no Gemini API key is configured.
   */
  async extractFromReceipt(file: File): Promise<OcrResult> {
    const apiKey = this.sheetConfig.aiApiKey();
    if (apiKey) {
      return this.extractWithGemini(file, apiKey);
    }
    return this.extractWithTesseract(file);
  }

  // ── Gemini Vision ───────────────────────────────────────────────────────────

  private async extractWithGemini(file: File, apiKey: string): Promise<OcrResult> {
    const base64 = await this.fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';
    const activeLang = this.lang.activeLang();

    const prompt = `You are a receipt parser. Extract the following fields from this receipt image and respond ONLY with valid JSON, no markdown, no explanation.

Language hint: the receipt may be in ${activeLang === 'fr' ? 'French' : activeLang === 'ar' ? 'Arabic' : 'English'}.

Respond with this exact JSON shape:
{
  "merchant": "store or restaurant name, or null",
  "amount": total amount as a number (largest amount, usually the total/grand total), or null,
  "date": "YYYY-MM-DD format, or null"
}

Rules:
- merchant: the business/store name at the top of the receipt
- amount: the final total amount paid (look for TOTAL, MONTANT, المجموع, etc.)
- date: the transaction date
- Use null for any field you cannot determine with confidence`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 256 },
    };

    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await firstValueFrom(
      this.http.post<GeminiResponse>(url, body)
    );

    const rawText = res.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    try {
      // Strip any accidental markdown fences
      const json = rawText.replace(/```json?|```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        merchant: parsed.merchant ?? null,
        amount:   typeof parsed.amount === 'number' ? parsed.amount : null,
        date:     this.normaliseDate(parsed.date),
        rawText,
      };
    } catch {
      // JSON parse failed — return raw text so user can see what Gemini said
      return { merchant: null, amount: null, date: null, rawText };
    }
  }

  // ── Tesseract fallback ──────────────────────────────────────────────────────

  private async extractWithTesseract(file: File): Promise<OcrResult> {
    const LANG_MAP: Record<string, string> = { en: 'eng', fr: 'fra', ar: 'ara' };
    const tessLang = LANG_MAP[this.lang.activeLang()] ?? 'eng';

    const mod = await import('tesseract.js/dist/tesseract.esm.min.js' as string) as any;
    const Tesseract = mod.default ?? mod;
    const createWorker: typeof import('tesseract.js')['createWorker'] = Tesseract.createWorker;
    const worker = await createWorker(tessLang, 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      langPath:   'https://tessdata.projectnaptha.com/4.0.0',
      corePath:   'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5',
    });
    try {
      const { data } = await worker.recognize(file);
      const text = data.text;
      return {
        amount:   this.extractAmount(text),
        date:     this.extractDate(text),
        merchant: this.extractMerchant(text),
        rawText:  text,
      };
    } finally {
      await worker.terminate();
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private normaliseDate(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }

  private extractAmount(text: string): number | null {
    const matches = text.match(/\d{1,6}[.,]\d{2}/g);
    if (!matches) return null;
    const amounts = matches
      .map((m) => parseFloat(m.replace(',', '.')))
      .filter((n) => !isNaN(n));
    return amounts.length ? Math.max(...amounts) : null;
  }

  private extractDate(text: string): string | null {
    const patterns: RegExp[] = [
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/,
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
    ];
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (!m) continue;
      if (pattern === patterns[0]) return `${m[1]}-${m[2]}-${m[3]}`;
      if (pattern === patterns[1]) {
        const a = parseInt(m[1]), b = parseInt(m[2]), yr = m[3];
        return a > 12
          ? `${yr}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
          : `${yr}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
      }
      if (pattern === patterns[2]) {
        const months: Record<string, string> = {
          jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
          jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
        };
        const mon = months[m[2].toLowerCase().slice(0, 3)] ?? '01';
        return `${m[3]}-${mon}-${String(m[1]).padStart(2, '0')}`;
      }
    }
    return null;
  }

  private extractMerchant(text: string): string | null {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10);
    const meaningfulLine = lines.find((l) =>
      l.length >= 3 &&
      !/^\d[\d\s\-\.]+$/.test(l) &&
      !/^[A-Z0-9\-]{6,}$/.test(l) &&
      !/^(tel|phone|fax|www|http|vat|tva)/i.test(l)
    );
    return meaningfulLine ?? lines[0] ?? null;
  }
}
