import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

import { createPostCollector } from "./post-collector";
import type { FeedPost } from "./bluesky";

function buildPost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    uri: "at://did:plc:test/app.bsky.feed.post/post",
    author: { did: "did:plc:test", handle: "tester.bsky.social" },
    record: { createdAt: "2024-01-01T00:00:00.000Z", text: "hello" },
    ...overrides,
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 200,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("Timed out waiting for condition");
}

describe("createPostCollector", () => {
  it("surfaces setup failures in state", async () => {
    const collector = createPostCollector({
      parsePostUrl: () => {
        throw new Error("bad url");
      },
    });

    await collector.fetchFromUrl("invalid");
    const state = get(collector.state);

    expect(state.pollStatus).toBe("Failed");
    expect(state.errorMessage).toContain("bad url");
    expect(state.isBootstrapping).toBe(false);
    expect(state.isPolling).toBe(false);
  });

  it("collects quotes to final cursor and fetches replies once", async () => {
    const rootPost = buildPost({
      uri: "at://did:plc:root/app.bsky.feed.post/root",
      author: { did: "did:plc:root", handle: "root.bsky.social" },
    });
    const quotePost = buildPost({
      uri: "at://did:plc:quote/app.bsky.feed.post/quote",
      author: { did: "did:plc:quote", handle: "quote.bsky.social" },
    });
    const replyPost = buildPost({
      uri: "at://did:plc:reply/app.bsky.feed.post/reply",
      author: { did: "did:plc:reply", handle: "reply.bsky.social" },
    });

    const collector = createPostCollector({
      callDelayMs: 0,
      parsePostUrl: () => ({
        sourceUrl: "https://bsky.app/profile/root.bsky.social/post/root",
        handle: "root.bsky.social",
        rkey: "root",
      }),
      resolveDid: async () => "did:plc:root",
      buildAtUri: () => rootPost.uri,
      fetchPost: async () => rootPost,
      fetchQuotes: async () => ({ posts: [quotePost], cursor: undefined }),
      fetchThread: async () => ({ thread: {} }),
      extractReplies: () => [replyPost],
      sleep: async () => {},
    });

    await collector.fetchFromUrl("https://example.com");
    await waitFor(() => !get(collector.state).isPolling);

    const state = get(collector.state);
    expect(state.postData?.uri).toBe(rootPost.uri);
    expect(state.quotes.map((post) => post.uri)).toEqual([quotePost.uri]);
    expect(state.replies.map((post) => post.uri)).toEqual([replyPost.uri]);
    expect(state.hasReachedFinalQuoteCursor).toBe(true);
    expect(state.pollStatus.toLowerCase()).toContain("complete");
  });
});
