import { describe, expect, it } from "vitest";

import type { FeedPost } from "./bluesky";
import {
  averageAccountAgeDaysAtPost,
  averageResponseHoursFromPost,
  countItemsWithinWindow,
  getFilteredSortedPosts,
  mergePostsByUri,
  normalizeOptionalPositive,
} from "./post-analysis";

function buildPost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    uri: "at://did:plc:test/app.bsky.feed.post/default",
    author: {
      did: "did:plc:test",
      handle: "tester.bsky.social",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    record: { createdAt: "2024-01-02T00:00:00.000Z", text: "hello world" },
    replyCount: 0,
    repostCount: 0,
    quoteCount: 0,
    likeCount: 0,
    ...overrides,
  };
}

describe("normalizeOptionalPositive", () => {
  it("returns null for non-positive and invalid inputs", () => {
    expect(normalizeOptionalPositive("")).toBeNull();
    expect(normalizeOptionalPositive(0)).toBeNull();
    expect(normalizeOptionalPositive(-2)).toBeNull();
    expect(normalizeOptionalPositive(undefined)).toBeNull();
  });

  it("returns numeric value for positive inputs", () => {
    expect(normalizeOptionalPositive(3)).toBe(3);
    expect(normalizeOptionalPositive("2")).toBe(2);
  });
});

describe("mergePostsByUri", () => {
  it("deduplicates by uri and keeps latest entry for duplicates", () => {
    const oldPost = buildPost({ uri: "at://x/1", likeCount: 1 });
    const replacement = buildPost({ uri: "at://x/1", likeCount: 9 });
    const other = buildPost({ uri: "at://x/2", likeCount: 3 });

    const merged = mergePostsByUri([oldPost], [replacement, other]);
    expect(merged).toHaveLength(2);
    expect(merged.find((post) => post.uri === "at://x/1")?.likeCount).toBe(9);
  });
});

describe("collection stats helpers", () => {
  it("calculates first-window count and averages", () => {
    const rootMs = Date.parse("2024-02-01T00:00:00.000Z");
    const posts = [
      buildPost({
        uri: "at://x/1",
        record: { createdAt: "2024-02-01T00:30:00.000Z", text: "a" },
        author: {
          did: "did:a",
          handle: "a",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      }),
      buildPost({
        uri: "at://x/2",
        record: { createdAt: "2024-02-01T03:00:00.000Z", text: "b" },
        author: {
          did: "did:b",
          handle: "b",
          createdAt: "2024-01-15T00:00:00.000Z",
        },
      }),
    ];

    expect(countItemsWithinWindow(posts, rootMs, 60 * 60 * 1000)).toBe(1);
    expect(averageResponseHoursFromPost(posts, rootMs)).toBeCloseTo(1.75);
    expect(averageAccountAgeDaysAtPost(posts, rootMs)).toBeCloseTo(24);
  });
});

describe("getFilteredSortedPosts", () => {
  it("applies engagement/account-age/media filters before sorting", () => {
    const rootMs = Date.parse("2024-02-01T00:00:00.000Z");
    const posts = [
      buildPost({
        uri: "at://x/low-eng",
        likeCount: 1,
        repostCount: 0,
        quoteCount: 0,
        replyCount: 0,
        author: {
          did: "did:old",
          handle: "old",
          createdAt: "2020-01-01T00:00:00.000Z",
        },
      }),
      buildPost({
        uri: "at://x/no-media",
        likeCount: 10,
        repostCount: 10,
        quoteCount: 1,
        replyCount: 1,
        author: {
          did: "did:old2",
          handle: "old2",
          createdAt: "2020-01-01T00:00:00.000Z",
        },
      }),
      buildPost({
        uri: "at://x/eligible",
        likeCount: 20,
        repostCount: 10,
        quoteCount: 2,
        replyCount: 2,
        embed: {
          $type: "app.bsky.embed.images#view",
          images: [{ thumb: "thumb.jpg", fullsize: "full.jpg" }],
        } as unknown,
        author: {
          did: "did:old3",
          handle: "old3",
          createdAt: "2020-01-01T00:00:00.000Z",
        },
      }),
    ];

    const filtered = getFilteredSortedPosts(
      posts,
      {
        minEngagementThreshold: 5,
        minAccountOlderDays: 10,
        requireOwnMedia: true,
        rootPostTimestampMs: rootMs,
      },
      "engagement",
      "biggest",
    );

    expect(filtered.map((post) => post.uri)).toEqual(["at://x/eligible"]);
  });
});
