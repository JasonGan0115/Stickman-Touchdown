import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatInstagramCaption, publishStatsToInstagram, renderInstagramCardSvg } from "./instagram";

const sampleStats = {
  onlinePlayers: 12,
  totalTesters: 87,
  activeMatches: 4,
  updatedAt: "2026-11-26T00:50:00.000Z",
};

describe("instagram stats publisher", () => {
  test("formats caption and renders SVG card with live counts", () => {
    const caption = formatInstagramCaption(sampleStats);
    assert.match(caption, /Currently Online: 12/);
    assert.match(caption, /Total Tested: 87/);
    assert.match(caption, /Active Matches: 4/);

    const svg = renderInstagramCardSvg(sampleStats);
    assert.match(svg, />12</);
    assert.match(svg, />87</);
    assert.match(svg, /CURRENTLY ONLINE/);
    assert.match(svg, /TOTAL TESTED/);
  });

  test("returns unconfigured status when credentials are missing", async () => {
    const res = await publishStatsToInstagram(sampleStats, {});
    assert.equal(res.ok, false);
    assert.equal(res.configured, false);
    assert.match(res.caption, /Total Tested: 87/);
  });

  test("publishes a new photo post when imageUrl is provided", async () => {
    const calls: string[] = [];
    const mockFetch = (async (url: string | URL) => {
      const s = String(url);
      calls.push(s);
      if (s.endsWith("/media")) {
        return new Response(JSON.stringify({ id: "container_123" }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "post_456" }), { status: 200 });
    }) as typeof fetch;

    const res = await publishStatsToInstagram(
      sampleStats,
      { igUserId: "ig_1", accessToken: "tok_1", imageUrl: "https://example.com/card.jpg" },
      mockFetch,
    );

    assert.equal(res.ok, true);
    assert.equal(res.mode, "post");
    assert.equal(res.id, "post_456");
    assert.equal(calls.length, 2);
  });

  test("posts a stats comment when mediaId is provided", async () => {
    const mockFetch = (async () => new Response(JSON.stringify({ id: "comment_789" }), { status: 200 })) as typeof fetch;

    const res = await publishStatsToInstagram(
      sampleStats,
      { igUserId: "ig_1", accessToken: "tok_1", mediaId: "media_1" },
      mockFetch,
    );

    assert.equal(res.ok, true);
    assert.equal(res.mode, "comment");
    assert.equal(res.id, "comment_789");
  });
});
