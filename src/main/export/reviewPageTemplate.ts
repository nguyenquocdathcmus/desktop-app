export interface ReviewPageComment {
  id: string
  t: number
  text: string
  author?: string
  resolved?: boolean
}

export interface ReviewPageOptions {
  title: string
  comments: ReviewPageComment[]
  /** One of these is required to actually show a video. */
  youtubeUrl?: string
  driveFileId?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatTimestamp(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/)
  return match ? match[1] : null
}

/**
 * Sprint 26 US-196 — self-contained static HTML review page, no server, no
 * build step, no framework: a single file that opens directly in any
 * browser. Embeds the published video (YouTube iframe, or a Drive preview
 * iframe) plus the comment list rendered at build time. New comments typed
 * into the page are collected client-side and exported as a downloadable
 * JSON file the recording's owner can re-import via US-197 — this page
 * itself has no way to write back to the original project (no server), by
 * design, matching the "app desktop, no backend" architecture kept
 * throughout the project.
 */
export function generateReviewPageHtml(opts: ReviewPageOptions): string {
  const { title, comments } = opts
  const sortedComments = [...comments].sort((a, b) => a.t - b.t)

  let videoEmbed = '<p class="no-video">No video link available — the video must be published to YouTube or Google Drive first.</p>'
  if (opts.youtubeUrl) {
    const id = extractYoutubeId(opts.youtubeUrl)
    if (id) {
      videoEmbed = `<iframe src="https://www.youtube.com/embed/${escapeHtml(id)}" allowfullscreen loading="lazy"></iframe>`
    }
  } else if (opts.driveFileId) {
    videoEmbed = `<iframe src="https://drive.google.com/file/d/${escapeHtml(opts.driveFileId)}/preview" allowfullscreen loading="lazy"></iframe>`
  }

  const commentsHtml = sortedComments.length === 0
    ? '<p class="empty">No comments yet.</p>'
    : sortedComments.map((c) => `
      <div class="comment${c.resolved ? ' resolved' : ''}" data-id="${escapeHtml(c.id)}">
        <span class="ts">${formatTimestamp(c.t)}</span>
        <span class="text">${escapeHtml(c.text)}</span>
        ${c.author ? `<span class="author">${escapeHtml(c.author)}</span>` : ''}
      </div>`).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} — Review</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: dark light; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px 16px; background: #111; color: #eee; }
  @media (prefers-color-scheme: light) { body { background: #fafafa; color: #111; } }
  h1 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
  .video-wrap { position: relative; padding-top: 56.25%; background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
  .video-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .no-video { padding: 40px; text-align: center; color: #888; }
  .comments { display: flex; flex-direction: column; gap: 8px; }
  .comment { display: flex; gap: 10px; align-items: baseline; padding: 8px 12px; border-radius: 6px; background: rgba(128,128,128,0.08); }
  .comment.resolved { opacity: 0.5; }
  .ts { font-variant-numeric: tabular-nums; font-size: 12px; color: #888; flex-shrink: 0; min-width: 36px; }
  .text { flex: 1; font-size: 13px; }
  .author { font-size: 11px; color: #888; }
  .empty { color: #888; font-size: 13px; }
  .add-comment { display: flex; gap: 8px; margin-top: 16px; }
  .add-comment input { flex: 1; padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(128,128,128,0.3); background: transparent; color: inherit; font-size: 13px; }
  .add-comment button { padding: 8px 14px; border-radius: 6px; border: none; background: #6366f1; color: white; font-size: 13px; cursor: pointer; }
  .footer-actions { margin-top: 12px; }
  .footer-actions button { font-size: 11px; color: #888; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="video-wrap">${videoEmbed}</div>
  <div class="comments" id="comments">
${commentsHtml}
  </div>
  <div class="add-comment">
    <input id="newTime" placeholder="m:ss" style="max-width:70px" aria-label="Timestamp">
    <input id="newText" placeholder="Add a comment…" aria-label="Comment text">
    <button id="addBtn">Add</button>
  </div>
  <div class="footer-actions">
    <button id="exportBtn">Download comments as JSON (import back into Screen Studio)</button>
  </div>
<script>
  // Sprint 26 US-197 — new comments typed here are client-side only until
  // exported; there is no server to persist them (this file is fully static).
  var newComments = [];
  document.getElementById('addBtn').addEventListener('click', function () {
    var timeInput = document.getElementById('newTime').value.trim();
    var text = document.getElementById('newText').value.trim();
    if (!text) return;
    var parts = timeInput.split(':').map(Number);
    var t = parts.length === 2 ? parts[0] * 60 + parts[1] : (Number(timeInput) || 0);
    var id = 'new-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    newComments.push({ id: id, t: t, text: text, author: 'Reviewer' });
    var div = document.createElement('div');
    div.className = 'comment';
    div.innerHTML = '<span class="ts">' + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') + '</span>' +
      '<span class="text"></span>';
    div.querySelector('.text').textContent = text;
    document.getElementById('comments').appendChild(div);
    document.getElementById('newTime').value = '';
    document.getElementById('newText').value = '';
  });
  document.getElementById('exportBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(newComments, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'review-comments.json';
    a.click();
    URL.revokeObjectURL(url);
  });
</script>
</body>
</html>`
}
