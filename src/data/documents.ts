import path from 'node:path';
import { env } from '../config/env';

/** Те, що приймає `locator.setInputFiles`: шлях до файлу або файл у пам'яті. */
export type UploadFile = string | { name: string; mimeType: string; buffer: Buffer };

const file = (name: string) => path.resolve(__dirname, 'files', name);

/** Тестові «документи, що посвідчують особу» (специмени, не реальні дані). */
export const documents = {
  pdf: file('valid-id.pdf'),
  docx: file('valid-id.docx'),
  jpg: file('valid-id.jpg'),
  png: file('valid-id.png'),
  exe: file('not-a-document.exe'),
  /** PDF на 1 МБ більший за ліміт MAX_UPLOAD_MB — генерується в пам'яті, не лежить у репо. */
  oversizedPdf: (): UploadFile => {
    const size = (env.maxUploadMb + 1) * 1024 * 1024;
    const buffer = Buffer.alloc(size, 0x20);
    buffer.write('%PDF-1.4\n', 0);
    return { name: 'oversized-id.pdf', mimeType: 'application/pdf', buffer };
  },
  /** EXE-вміст під розширенням .pdf — сервер перевіряє вміст, а не лише розширення. */
  exeAsPdf: (): UploadFile => ({ name: 'fake-id.pdf', mimeType: 'application/pdf', buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]) }),
  /** PDF-вміст під розширенням .png. */
  pdfAsPng: (): UploadFile => ({ name: 'fake-id.png', mimeType: 'image/png', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') }),
  /** Порожній файл (0 байт). */
  emptyPdf: (): UploadFile => ({ name: 'empty-id.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) }),
} as const;

/** Ім'я файлу, яке має відобразитись у профілі/адмінці після завантаження. */
export const fileNameOf = (f: UploadFile) => (typeof f === 'string' ? path.basename(f) : f.name);
