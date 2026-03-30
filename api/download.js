import sharp from '@img/sharp-linux-x64';
import archiver from 'archiver';
import { PassThrough } from 'stream';
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

export function buildZip(images) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    const passthrough = new PassThrough();
    const chunks = [];

    passthrough.on('data', (chunk) => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);
    archive.on('error', reject);

    archive.pipe(passthrough);

    for (const { buffer, filename } of images) {
      archive.append(buffer, { name: filename });
    }
    archive.finalize();
  });
}

export default async function handler(req, res) {
  // Auth: extract and validate Bearer token
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch ? bearerMatch[1].trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  const valid = await validateToken(token);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { images = [], format = 'original' } = body;
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  // Process images
  const processed = [];
  const failed = [];

  for (let i = 0; i < images.length; i++) {
    const { url, title } = images[i];
    try {
      const { buffer: rawBuffer, contentType } = await fetchImage(url);
      const convertedBuffer = await convertImage(rawBuffer, format);
      const ext = format === 'original'
        ? resolveExtension(url, contentType)
        : (format === 'jpg' ? '.jpg' : `.${format}`);
      const filename = buildFilename(title, i, ext);
      processed.push({ buffer: convertedBuffer, filename });
    } catch (err) {
      failed.push({ url, title, error: err.message });
    }
  }

  if (processed.length === 0) {
    return res.status(422).json({ error: 'All images failed to process', failed });
  }

  if (failed.length > 0) {
    res.setHeader('X-Failed-Count', String(failed.length));
    res.setHeader('X-Failed-Items', JSON.stringify(failed.map(f => f.title || f.url)));
  }

  // Single file → return directly; multiple → ZIP
  if (processed.length === 1) {
    const { buffer, filename } = processed[0];
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  } else {
    const zip = await buildZip(processed);
    const zipName = `images_${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.end(zip);
  }
}
