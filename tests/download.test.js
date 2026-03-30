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

// ── Task 5: buildZip ──────────────────────────────────────────────────────────

describe('buildZip', () => {
  test('resolves with a non-empty Buffer', async () => {
    const images = [
      { buffer: Buffer.from('img1'), filename: 'photo_1.png' },
      { buffer: Buffer.from('img2'), filename: 'photo_2.png' },
    ];
    const result = await buildZip(images);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  test('ZIP starts with PK magic bytes (0x50 0x4B)', async () => {
    const images = [{ buffer: Buffer.from('hello'), filename: 'test.png' }];
    const result = await buildZip(images);
    expect(result[0]).toBe(0x50);
    expect(result[1]).toBe(0x4b);
  });
});

// ── Task 6: HTTP handler ──────────────────────────────────────────────────────

function makeReq(body, token) {
  const headers = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  return {
    method: 'POST',
    headers,
    json: async () => body,
  };
}

function makeRes() {
  return {
    statusCode: 200,
    _headers: {},
    _body: null,
    _data: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(k, v) { this._headers[k] = v; },
    end(data) { this._data = data; },
  };
}

describe('handler', () => {
  test('returns 401 when Authorization header is missing', async () => {
    const req = { method: 'POST', headers: {}, json: async () => ({}) };
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('returns 401 when token is invalid', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const res = makeRes();
    await handler(makeReq({ images: [], format: 'png' }, 'bad'), res);
    expect(res.statusCode).toBe(401);
  });

  test('returns 400 when images array is empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const res = makeRes();
    await handler(makeReq({ images: [], format: 'png' }, 'tok'), res);
    expect(res.statusCode).toBe(400);
  });

  test('returns single file with application/octet-stream for one image', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true }); // validateToken
    const imgData = Buffer.from('fake-image-data');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => imgData.buffer,
      headers: { get: () => 'image/png' },
    });
    const res = makeRes();
    await handler(
      makeReq({ images: [{ url: 'https://cdn.miro.com/a.png', title: 'photo' }], format: 'original' }, 'tok'),
      res
    );
    expect(res._headers['Content-Type']).toBe('application/octet-stream');
    expect(res._data).toBeInstanceOf(Buffer);
  });

  test('returns ZIP with application/zip for multiple images', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true }); // validateToken
    const imgData = Buffer.from('fake');
    const fakeResponse = {
      ok: true,
      arrayBuffer: async () => imgData.buffer,
      headers: { get: () => 'image/png' },
    };
    mockFetch.mockResolvedValueOnce(fakeResponse);
    mockFetch.mockResolvedValueOnce(fakeResponse);
    const res = makeRes();
    await handler(
      makeReq({
        images: [
          { url: 'https://cdn.miro.com/a.png', title: 'photo1' },
          { url: 'https://cdn.miro.com/b.png', title: 'photo2' },
        ],
        format: 'original',
      }, 'tok'),
      res
    );
    expect(res._headers['Content-Type']).toBe('application/zip');
    expect(res._data[0]).toBe(0x50); // ZIP magic bytes
    expect(res._data[1]).toBe(0x4b);
  });
});
