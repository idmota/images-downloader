import sharp from '@img/sharp-linux-x64';
import { buildFilename, resolveExtension } from '../utils/filename.js';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

export async function fetchImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image exceeds 4 MB limit`);
    }
    const buffer = Buffer.from(arrayBuf);
    const contentType = res.headers.get('content-type') || '';
    return { buffer, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

export async function convertImage(buffer, format) {
  if (format === 'original') return buffer;
  const sharpFormat = format === 'jpg' ? 'jpeg' : format;
  return sharp(buffer).toFormat(sharpFormat).toBuffer();
}

export async function validateToken(token) {
  try {
    const res = await fetch('https://api.miro.com/v2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function buildZip(_images) {
  throw new Error('Not implemented');
}

export default async function handler(req, res) {
  res.status(501).json({ error: 'Not implemented' });
}
