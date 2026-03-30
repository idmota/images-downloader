import { sanitizeTitle, buildFilename, resolveExtension } from '../utils/filename.js';

describe('sanitizeTitle', () => {
  test('strips illegal filename characters', () => {
    expect(sanitizeTitle('my:file/name')).toBe('my_file_name');
  });

  test('strips all illegal chars: \\ / : * ? " < > |', () => {
    expect(sanitizeTitle('a\\b/c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  test('trims leading and trailing spaces and dots', () => {
    expect(sanitizeTitle('  .hello.  ')).toBe('hello');
  });

  test('truncates to 200 characters', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeTitle(long)).toHaveLength(200);
  });

  test('replaces illegal chars with underscores (does not produce empty string)', () => {
    expect(sanitizeTitle(':::')).toBe('___');
  });
});

describe('buildFilename', () => {
  test('uses title + extension', () => {
    expect(buildFilename('My Photo', 0, '.png')).toBe('My Photo.png');
  });

  test('falls back to image_N when title is empty string', () => {
    expect(buildFilename('', 0, '.jpg')).toBe('image_1.jpg');
    expect(buildFilename('', 4, '.jpg')).toBe('image_5.jpg');
  });

  test('falls back to image_N when title is null', () => {
    expect(buildFilename(null, 2, '.png')).toBe('image_3.png');
  });
});

describe('resolveExtension', () => {
  test('extracts extension from URL path', () => {
    expect(resolveExtension('https://cdn.miro.com/assets/photo.jpeg', '')).toBe('.jpeg');
  });

  test('falls back to Content-Type when URL has no extension', () => {
    expect(resolveExtension('https://cdn.miro.com/assets/photo', 'image/png')).toBe('.png');
  });

  test('maps image/jpeg Content-Type to .jpg', () => {
    expect(resolveExtension('https://cdn.miro.com/x', 'image/jpeg')).toBe('.jpg');
  });

  test('falls back to .bin when both are unknown', () => {
    expect(resolveExtension('https://cdn.miro.com/x', 'application/octet-stream')).toBe('.bin');
  });

  test('handles Content-Type with charset suffix', () => {
    expect(resolveExtension('https://cdn.miro.com/x', 'image/png; charset=utf-8')).toBe('.png');
  });
});
