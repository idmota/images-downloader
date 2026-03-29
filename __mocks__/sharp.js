// Manual mock for @img/sharp-linux-x64
// Used in tests to avoid loading the Linux-only native binary on macOS.
import { jest } from '@jest/globals';

export const toBufferMock = jest.fn().mockResolvedValue(Buffer.from('converted'));
export const toFormatMock = jest.fn().mockReturnValue({ toBuffer: toBufferMock });
const sharpMock = jest.fn().mockReturnValue({ toFormat: toFormatMock });
export default sharpMock;
