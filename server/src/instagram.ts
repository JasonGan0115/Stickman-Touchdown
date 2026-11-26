export interface LiveGameStats {
  onlinePlayers: number;
  totalTesters: number;
  activeMatches: number;
  updatedAt: string;
}

export interface InstagramConfig {
  igUserId?: string;
  accessToken?: string;
  mediaId?: string;
  imageUrl?: string;
}

export interface InstagramPublishResult {
  ok: boolean;
  configured: boolean;
  mode?: "post" | "comment";
  id?: string;
  caption: string;
  error?: string;
}

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

/** Formats a ready-to-post Instagram caption from live server stats. */
export function formatInstagramCaption(stats: LiveGameStats): string {
  return [
    "🏈 Touchdown PVP — Live Server Stats",
    "",
    `👥 Currently Online: ${stats.onlinePlayers}`,
    `🧪 Total Tested: ${stats.totalTesters}`,
    `⚔️ Active Matches: ${stats.activeMatches}`,
    `🕒 Updated: ${stats.updatedAt}`,
    "",
    "#TouchdownPVP #IndieGame #PvP #GameDev",
  ].join("\n");
}

/** Renders a 1080x1080 SVG status card for sharing or previewing live stats. */
export function renderInstagramCardSvg(stats: LiveGameStats): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b101b" />
      <stop offset="100%" stop-color="#172033" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)" />
  <rect x="60" y="60" width="960" height="960" rx="48" fill="#131a29" stroke="#2c3a57" stroke-width="4" />
  <text x="540" y="190" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="60" font-weight="bold">TOUCHDOWN PVP</text>
  <text x="540" y="255" text-anchor="middle" fill="#8fa3bf" font-family="Arial, sans-serif" font-size="30" letter-spacing="4">LIVE SERVER STATS</text>

  <rect x="130" y="340" width="820" height="210" rx="28" fill="#102926" stroke="#06d6a0" stroke-width="3" />
  <text x="540" y="425" text-anchor="middle" fill="#06d6a0" font-family="Arial, sans-serif" font-size="82" font-weight="bold">${stats.onlinePlayers}</text>
  <text x="540" y="495" text-anchor="middle" fill="#b7f5e4" font-family="Arial, sans-serif" font-size="32" font-weight="bold">CURRENTLY ONLINE</text>

  <rect x="130" y="600" width="820" height="210" rx="28" fill="#112436" stroke="#38bdf8" stroke-width="3" />
  <text x="540" y="685" text-anchor="middle" fill="#38bdf8" font-family="Arial, sans-serif" font-size="82" font-weight="bold">${stats.totalTesters}</text>
  <text x="540" y="755" text-anchor="middle" fill="#bae6fd" font-family="Arial, sans-serif" font-size="32" font-weight="bold">TOTAL TESTED</text>

  <text x="540" y="905" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="26">Active Matches: ${stats.activeMatches}</text>
  <text x="540" y="955" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="22">${stats.updatedAt}</text>
</svg>`;
}

/**
 * Publishes live stats to an Instagram Business/Creator account via the Instagram Graph API.
 * - If `mediaId` is provided (and `imageUrl` is omitted), posts a live update comment on that post.
 * - If `imageUrl` is provided, creates and publishes a new photo post (requires a public JPEG URL).
 */
export async function publishStatsToInstagram(
  stats: LiveGameStats,
  config: InstagramConfig,
  fetchFn: typeof fetch = fetch,
): Promise<InstagramPublishResult> {
  const caption = formatInstagramCaption(stats);
  const { igUserId, accessToken, mediaId, imageUrl } = config;

  if (!igUserId || !accessToken) {
    return {
      ok: false,
      configured: false,
      caption,
      error: "Set INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN in server/.env to publish to Instagram.",
    };
  }

  if (imageUrl) {
    const createParams = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    });
    const createRes = await fetchFn(`${GRAPH_API_BASE}/${encodeURIComponent(igUserId)}/media`, {
      method: "POST",
      body: createParams,
    });
    const createData = (await createRes.json()) as { id?: string; error?: { message?: string } };
    if (!createRes.ok || !createData.id) {
      return {
        ok: false,
        configured: true,
        mode: "post",
        caption,
        error: createData.error?.message ?? `Failed to create media container (HTTP ${createRes.status})`,
      };
    }

    const publishParams = new URLSearchParams({
      creation_id: createData.id,
      access_token: accessToken,
    });
    const publishRes = await fetchFn(`${GRAPH_API_BASE}/${encodeURIComponent(igUserId)}/media_publish`, {
      method: "POST",
      body: publishParams,
    });
    const publishData = (await publishRes.json()) as { id?: string; error?: { message?: string } };
    if (!publishRes.ok || !publishData.id) {
      return {
        ok: false,
        configured: true,
        mode: "post",
        caption,
        error: publishData.error?.message ?? `Failed to publish media (HTTP ${publishRes.status})`,
      };
    }

    return { ok: true, configured: true, mode: "post", id: publishData.id, caption };
  }

  if (mediaId) {
    const commentParams = new URLSearchParams({
      message: caption,
      access_token: accessToken,
    });
    const commentRes = await fetchFn(`${GRAPH_API_BASE}/${encodeURIComponent(mediaId)}/comments`, {
      method: "POST",
      body: commentParams,
    });
    const commentData = (await commentRes.json()) as { id?: string; error?: { message?: string } };
    if (!commentRes.ok || !commentData.id) {
      return {
        ok: false,
        configured: true,
        mode: "comment",
        caption,
        error: commentData.error?.message ?? `Failed to post comment (HTTP ${commentRes.status})`,
      };
    }

    return { ok: true, configured: true, mode: "comment", id: commentData.id, caption };
  }

  return {
    ok: false,
    configured: false,
    caption,
    error: "Provide either INSTAGRAM_IMAGE_URL (public JPEG for a new post) or INSTAGRAM_MEDIA_ID (to post a stats comment).",
  };
}
