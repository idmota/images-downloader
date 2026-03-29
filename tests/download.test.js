import { jest } from '@jest/globals';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// @img/sharp-linux-x64 is redirected to __mocks__/sharp.js via moduleNameMapper.
// This prevents the Linux-only native binary from loading on macOS dev machines.
import sharpMock, { toFormatMock, toBufferMock } from '@img/sharp-linux-x64';

const {
  validateToken,
  fetchImage,
  convertImage,
  buildZip,
  default: handler,
} = await import('../api/download.js');

afterEach(() => {
  mockFetch.mockReset();
  sharpMock.mockClear();
  toFormatMock.mockClear();
  toBufferMock.mockClear();
});

// ── Task 3: validateToken ──────────────────────────────────────────────────────

describe('validateToken', () => {
  test('returns true for a valid token (Miro API returns 200)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await validateToken('valid-token');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.miro.com/v2/users/me',
      { headers: { Authorization: 'Bearer valid-token' } }
    );
  });

  test('returns false for an invalid token (Miro API returns 401)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await validateToken('bad-token');
    expect(result).toBe(false);
  });

  test('returns false if fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const result = await validateToken('any-token');
    expect(result).toBe(false);
  });
});

// ── Task 4: fetchImage + convertImage ─────────────────────────────────────────

describe('fetchImage', () => {
  test('returns buffer and contentType for a successful fetch', async () => {
    const fakeData = Buffer.from('image-data');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeData.buffer,
      headers: { get: () => 'image/png' },
    });
    const result = await fetchImage('https://cdn.miro.com/img.png');
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.contentType).toBe('image/png');
  });

  test('throws if the response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchImage('https://cdn.miro.com/missing.png'))
      .rejects.toThrow('HTTP 404');
  });

  test('throws if file exceeds 4 MB', async () => {
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => bigBuffer.buffer,
      headers: { get: () => 'image/png' },
    });
    await expect(fetchImage('https://cdn.miro.com/big.png'))
      .rejects.toThrow('exceeds 4 MB');
  });
});

describe('convertImage', () => {
  test('returns original buffer unchanged for format "original"', async () => {
    const buf = Buffer.from('raw');
    const result = await convertImage(buf, 'original');
    expect(result).toBe(buf);
  });

  test('calls sharp for png conversion and returns converted buffer', async () => {
    toBufferMock.mockResolvedValueOnce(Buffer.from('converted'));
    const result = await convertImage(Buffer.from('raw'), 'png');
    expect(result.toString()).toBe('converted');
  });

  test('passes "jpeg" to sharp when format is "jpg"', async () => {
    await convertImage(Buffer.from('raw'), 'jpg');
    expect(toFormatMock).toHaveBeenCalledWith('jpeg');
  });
});
