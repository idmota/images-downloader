const MIME_TO_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

export function sanitizeTitle(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 200);
}

export function buildFilename(title, index, ext) {
  const base = title && title.trim() ? sanitizeTitle(title) : `image_${index + 1}`;
  return base + ext;
}

export function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/(\.\w+)$/);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export function extFromContentType(contentType) {
  if (!contentType) return null;
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT[mime] || null;
}

export function resolveExtension(url, contentType) {
  return extFromUrl(url) || extFromContentType(contentType) || '.bin';
}
