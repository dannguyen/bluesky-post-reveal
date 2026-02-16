import { describe, expect, it } from "vitest";

import {
  extractOwnImages,
  getResponseRatio,
  hasOwnMedia,
  type EmbedView,
  type FeedPost,
} from "./bluesky";

function buildPost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    uri: "at://did:plc:test/app.bsky.feed.post/abc123",
    author: { did: "did:plc:test", handle: "tester.bsky.social" },
    ...overrides,
  };
}

describe("getResponseRatio", () => {
  it("forces ratio to 1 when denominator is 0", () => {
    const post = buildPost({
      replyCount: 4,
      quoteCount: 2,
      likeCount: 0,
      repostCount: 0,
    });
    expect(getResponseRatio(post)).toBe(1);
  });

  it("forces ratio to 2 when denominator >= 20", () => {
    const post = buildPost({
      replyCount: 10,
      quoteCount: 10,
      likeCount: 0,
      repostCount: 0,
    });
    expect(getResponseRatio(post)).toBe(2);
  });

  it("uses numerator/denominator otherwise", () => {
    const post = buildPost({
      replyCount: 6,
      quoteCount: 2,
      likeCount: 10,
      repostCount: 6,
    });
    expect(getResponseRatio(post)).toBeCloseTo(8 / 16);
  });
});

describe("own media extraction", () => {
  it("does not treat quoted record images as own images", () => {
    // The real API nests quoted content under record.value.embed, but our
    // EmbedRecord type only looks at record.embeds and record.media.
    // Images buried under record.value are intentionally unreachable.
    const embed: EmbedView = {
      $type: "app.bsky.embed.recordWithMedia#view",
      record: {
        embeds: [
          {
            $type: "app.bsky.embed.images#view",
            images: [
              {
                thumb: "quoted-thumb.jpg",
                fullsize: "quoted-full.jpg",
                alt: "quoted",
              },
            ],
          },
        ],
      },
    };
    const post = buildPost({ embed });

    expect(extractOwnImages(post)).toHaveLength(0);
    expect(hasOwnMedia(post)).toBe(false);
  });

  it("detects own images and videos", () => {
    const imagePost = buildPost({
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [
          {
            thumb: "own-thumb.jpg",
            fullsize: "own-full.jpg",
            alt: "own image",
          },
        ],
      },
    });

    const videoPost = buildPost({
      embed: {
        $type: "app.bsky.embed.video#view",
        playlist: "https://cdn.example/video.m3u8",
      },
    });

    expect(extractOwnImages(imagePost)).toHaveLength(1);
    expect(hasOwnMedia(imagePost)).toBe(true);
    expect(hasOwnMedia(videoPost)).toBe(true);
  });
});
