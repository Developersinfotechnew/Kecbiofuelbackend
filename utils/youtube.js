/**
 * Extracts an 11-character YouTube video ID from any common URL shape:
 *  - https://www.youtube.com/watch?v=VIDEOID
 *  - https://youtu.be/VIDEOID
 *  - https://www.youtube.com/embed/VIDEOID
 *  - https://www.youtube.com/shorts/VIDEOID
 *  - https://m.youtube.com/watch?v=VIDEOID&t=30s
 * Returns null if no valid ID is found.
 */
function extractYoutubeId(url) {
  if (!url || typeof url !== "string") return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

function isValidYoutubeUrl(url) {
  return extractYoutubeId(url) !== null;
}

function buildEmbedUrl(videoId) {
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

// YouTube always serves a default thumbnail at this predictable URL.
// Useful as a fallback if the admin hasn't uploaded a custom thumbnail yet.
function buildDefaultYoutubeThumbnail(videoId) {
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

module.exports = {
  extractYoutubeId,
  isValidYoutubeUrl,
  buildEmbedUrl,
  buildDefaultYoutubeThumbnail,
};
