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

// ── Task 3: validateToken ─────────────────────────────────────────────────────

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
