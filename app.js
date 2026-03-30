// app.js — runs inside Miro app iframe (index.html)
// Miro Web SDK v2 available as global `miro` (loaded via <script> tag)

async function handleDownload() {
  const selection = await miro.board.getSelection();
  const images = selection.filter(item => item.type === 'image');
  const skipped = selection.length - images.length;

  // Store selection in miro.board.storage under a unique session key.
  // We pass only the key to the modal URL to avoid query-string size limits.
  const sessionKey = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await miro.board.storage.collection('downloader').set(sessionKey, {
    images: images.map(img => ({ url: img.url, title: img.title || '' })),
    skipped,
  });

  await miro.board.ui.openModal({
    url: `${window.location.origin}/modal.html?key=${encodeURIComponent(sessionKey)}`,
    width: 400,
    height: 340,
  });
}

// Register context menu action.
// NOTE: As of Miro Web SDK v2, context menu actions are registered via
// miro.board.ui.on('icon:click') for panel apps, but per-selection context
// menu items require the experimental action API. Verify the exact registration
// API in current Miro Developer docs: https://developers.miro.com/docs/action
(async () => {
  try {
    await miro.board.experimental.action.register({
      ui: { label: { en: 'Download images' } },
      scope: 'local',
      predicate: { type: 'image' },
      handler: handleDownload,
    });
  } catch {
    // Fallback: trigger via icon click in the app panel
    miro.board.ui.on('icon:click', handleDownload);
  }
})();
