// modal.js — runs inside modal.html
// Miro Web SDK v2 available as global `miro` (loaded via <script> tag)

// ── Helpers ───────────────────────────────────────────────────────────────────

const FORMAT_KEY = 'images_downloader_format';

function getSessionKey() {
  return new URLSearchParams(window.location.search).get('key');
}

function restoreSavedFormat() {
  const saved = localStorage.getItem(FORMAT_KEY);
  if (saved) {
    const select = document.getElementById('format');
    if ([...select.options].some(o => o.value === saved)) {
      select.value = saved;
    }
  }
  document.getElementById('format').addEventListener('change', e => {
    localStorage.setItem(FORMAT_KEY, e.target.value);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = isError ? '#e74c3c' : '#555';
}

function setProgress(current, total) {
  document.getElementById('progress').textContent =
    total > 0 ? `${current} / ${total}` : '';
}

function setButtonsDisabled(disabled) {
  document.getElementById('btn-zip').disabled = disabled;
  document.getElementById('btn-separate').disabled = disabled;
}

// ── Download Helpers ──────────────────────────────────────────────────────────

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function postToProxy(images, format, token) {
  const res = await fetch('/api/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ images, format }),
  });

  if (res.status === 401) throw new Error('Authentication error. Please reconnect the app.');
  if (!res.ok) throw new Error(`Server error: ${res.status}`);

  const failedCount = parseInt(res.headers.get('X-Failed-Count') || '0', 10);

  // Extract server-provided filename from Content-Disposition (has correct extension)
  const disposition = res.headers.get('Content-Disposition') || '';
  const nameMatch = disposition.match(/filename="([^"]+)"/);
  const serverFilename = nameMatch ? nameMatch[1] : null;

  const blob = await res.blob();
  return { blob, failedCount, serverFilename };
}

// ── OAuth Token ───────────────────────────────────────────────────────────────

async function getAccessToken() {
  const cached = sessionStorage.getItem('miro_token');
  if (cached) return cached;
  const token = await miro.board.getIdToken();
  sessionStorage.setItem('miro_token', token);
  return token;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const sessionKey = getSessionKey();
  if (!sessionKey) {
    setStatus('Session key missing.', true);
    return;
  }

  let sessionData;
  try {
    sessionData = await miro.board.storage.collection('downloader').get(sessionKey);
  } catch {
    setStatus('Failed to load selection.', true);
    return;
  }

  const { images = [], skipped = 0 } = sessionData || {};

  document.getElementById('count').textContent =
    images.length === 0
      ? 'No downloadable images in selection.'
      : `${images.length} image${images.length !== 1 ? 's' : ''} selected`;

  if (skipped > 0) {
    document.getElementById('skipped').textContent =
      `${skipped} item${skipped !== 1 ? 's' : ''} skipped (not images)`;
  }

  restoreSavedFormat();

  if (images.length === 0) {
    setButtonsDisabled(true);
    return;
  }

  if (images.length > 50) {
    setStatus('Warning: large selection — this may take a while.');
  }

  let token;
  try {
    token = await getAccessToken();
  } catch {
    setStatus('Could not retrieve auth token.', true);
    setButtonsDisabled(true);
    return;
  }

  // ── Download as ZIP ──────────────────────────────────────────────────────────
  document.getElementById('btn-zip').addEventListener('click', async () => {
    const format = document.getElementById('format').value;
    setButtonsDisabled(true);
    setStatus('Preparing download…');

    const BATCH_SIZE = 20;
    const batches = [];
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      batches.push(images.slice(i, i + BATCH_SIZE));
    }

    let totalFailed = 0;
    for (let i = 0; i < batches.length; i++) {
      setProgress(i + 1, batches.length);
      setStatus(`Downloading batch ${i + 1} of ${batches.length}…`);
      try {
        const { blob, failedCount, serverFilename } = await postToProxy(batches[i], format, token);
        totalFailed += failedCount;
        const filename = serverFilename || `images_batch_${i + 1}.zip`;
        triggerBlobDownload(blob, filename);
      } catch (err) {
        setStatus(err.message, true);
        setButtonsDisabled(false);
        return;
      }
    }

    setProgress(0, 0);
    setStatus(
      totalFailed > 0
        ? `Done. ${totalFailed} image(s) could not be downloaded.`
        : 'Download complete!'
    );
    setButtonsDisabled(false);
  });

  // ── Download separately ──────────────────────────────────────────────────────
  document.getElementById('btn-separate').addEventListener('click', async () => {
    const format = document.getElementById('format').value;
    setButtonsDisabled(true);
    let failedCount = 0;

    for (let i = 0; i < images.length; i++) {
      setProgress(i + 1, images.length);
      setStatus(`Downloading ${i + 1} of ${images.length}…`);
      try {
        const { blob, serverFilename } = await postToProxy([images[i]], format, token);
        // Use server-provided filename (has correct extension for "original" format)
        const fallbackExt = format === 'original' ? '' : `.${format}`;
        const fallbackName = (images[i].title || `image_${i + 1}`) + fallbackExt;
        triggerBlobDownload(blob, serverFilename || fallbackName);
        await sleep(500); // avoid browser popup blocking
      } catch {
        failedCount++;
      }
    }

    setProgress(0, 0);
    setStatus(
      failedCount > 0
        ? `Done. ${failedCount} image(s) could not be downloaded.`
        : 'All images downloaded!'
    );
    setButtonsDisabled(false);
  });
}

main();
