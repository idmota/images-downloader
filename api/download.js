import { buildFilename, resolveExtension } from '../utils/filename.js';

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

// Remaining exports implemented in later tasks
export async function fetchImage(_url) {
  throw new Error('Not implemented');
}

export async function convertImage(_buffer, _format) {
  throw new Error('Not implemented');
}

export async function buildZip(_images) {
  throw new Error('Not implemented');
}

export default async function handler(req, res) {
  res.status(501).json({ error: 'Not implemented' });
}
