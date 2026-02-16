export type {
  Author,
  EmbedRecord,
  EmbedView,
  FeedPost,
  GetPostsResponse,
  GetPostThreadResponse,
  GetQuotesResponse,
  ParsedPostUrl,
  PostImage,
  PostRecord,
  ResolveHandleResponse,
  ThreadView,
} from "$lib/bluesky-types";

import type {
  EmbedView,
  FeedPost,
  GetPostsResponse,
  GetPostThreadResponse,
  GetQuotesResponse,
  ParsedPostUrl,
  PostImage,
  ResolveHandleResponse,
  ThreadView,
} from "$lib/bluesky-types";

export const BSKY_PUBLIC_API = "https://public.api.bsky.app/xrpc";
export const CALL_DELAY_MS = 200;

async function fetchJson<T>(
  method: string,
  params: Record<string, string | undefined>,
): Promise<T> {
  const endpoint = new URL(`${BSKY_PUBLIC_API}/${method}`);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      endpoint.searchParams.set(key, value);
    }
  }

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`API call failed (${response.status}) for ${method}`);
  }

  return (await response.json()) as T;
}

export function parsePostUrl(inputUrl: string): ParsedPostUrl {
  const trimmed = inputUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Please enter a valid URL.");
  }

  if (!["bsky.app", "www.bsky.app"].includes(parsed.hostname)) {
    throw new Error("URL must be a bsky.app post URL.");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[0] !== "profile" || parts[2] !== "post") {
    throw new Error("URL must look like /profile/{handle}/post/{rkey}.");
  }

  const handle = decodeURIComponent(parts[1] ?? "");
  const rkey = decodeURIComponent(parts[3] ?? "");

  if (!handle || !rkey) {
    throw new Error("Could not read handle and post ID from URL.");
  }

  return {
    sourceUrl: parsed.toString(),
    handle,
    rkey,
  };
}

export async function resolveDid(handle: string): Promise<string> {
  if (handle.startsWith("did:")) {
    return handle;
  }

  const resolved = await fetchJson<ResolveHandleResponse>(
    "com.atproto.identity.resolveHandle",
    { handle },
  );
  if (!resolved.did) {
    throw new Error(`Could not resolve DID for handle ${handle}`);
  }

  return resolved.did;
}

export function buildAtUri(did: string, rkey: string): string {
  return `at://${did}/app.bsky.feed.post/${rkey}`;
}

export async function fetchPost(atUri: string): Promise<FeedPost> {
  const response = await fetchJson<GetPostsResponse>("app.bsky.feed.getPosts", {
    uris: atUri,
  });
  const post = response.posts?.[0];

  if (!post) {
    throw new Error("Post metadata was not found.");
  }

  return post;
}

export async function fetchQuotes(
  atUri: string,
  cursor?: string,
): Promise<GetQuotesResponse> {
  return fetchJson<GetQuotesResponse>("app.bsky.feed.getQuotes", {
    uri: atUri,
    limit: "100",
    cursor,
  });
}

export async function fetchThread(
  atUri: string,
): Promise<GetPostThreadResponse> {
  return fetchJson<GetPostThreadResponse>("app.bsky.feed.getPostThread", {
    uri: atUri,
    depth: "1",
    parentHeight: "1",
  });
}

export function getPostTimestamp(post: FeedPost): string {
  return post.record?.createdAt ?? post.indexedAt ?? "";
}

export function getEngagement(post: FeedPost): number {
  return (
    (post.replyCount ?? 0) +
    (post.repostCount ?? 0) +
    (post.quoteCount ?? 0) +
    (post.likeCount ?? 0)
  );
}

export function getResponseRatio(post: FeedPost): number {
  const numerator = (post.quoteCount ?? 0) + (post.replyCount ?? 0);

  const denominator = (post.likeCount ?? 0) + (post.repostCount ?? 0);
  if (denominator === 0) {
    if (numerator < 3) {
      return 0;
    } else if (numerator >= 20) {
      return 2;
    } else {
      return 1;
    }
  }

  return numerator / denominator;
}

export function extractReplies(
  threadResponse: GetPostThreadResponse,
  rootUri: string,
): FeedPost[] {
  const replies: FeedPost[] = [];
  const seen = new Set<string>();

  const walk = (node?: ThreadView): void => {
    if (!node || typeof node !== "object") {
      return;
    }

    const post = node.post;
    if (post?.uri && post.uri !== rootUri && !seen.has(post.uri)) {
      seen.add(post.uri);
      replies.push(post);
    }

    if (Array.isArray(node.replies)) {
      node.replies.forEach((child) => walk(child));
    }
  };

  walk(threadResponse.thread);
  return replies;
}

function collectEmbedImages(
  embed: EmbedView | undefined,
  bucket: PostImage[],
  includeQuotedRecord: boolean,
): void {
  if (!embed) {
    return;
  }

  if (embed.images) {
    for (const image of embed.images) {
      bucket.push({
        thumb: image.thumb,
        fullsize: image.fullsize,
        alt: image.alt,
      });
    }
  }

  collectEmbedImages(embed.media, bucket, includeQuotedRecord);

  if (includeQuotedRecord && embed.record) {
    if (embed.record.embeds) {
      embed.record.embeds.forEach((nested) =>
        collectEmbedImages(nested, bucket, true),
      );
    }
    collectEmbedImages(embed.record.media, bucket, true);
  }

  if (embed.embeds) {
    embed.embeds.forEach((nested) =>
      collectEmbedImages(nested, bucket, includeQuotedRecord),
    );
  }
}

function hasOwnVideo(embed: EmbedView | undefined): boolean {
  if (!embed) {
    return false;
  }

  if (embed.$type?.includes("embed.video")) {
    return true;
  }

  if (embed.playlist) {
    return true;
  }

  if (hasOwnVideo(embed.media)) {
    return true;
  }

  if (embed.embeds) {
    return embed.embeds.some((nested) => hasOwnVideo(nested));
  }

  return false;
}

function collectPostImages(
  post: FeedPost,
  includeQuotedRecord: boolean,
): PostImage[] {
  const images: PostImage[] = [];
  collectEmbedImages(post.embed, images, includeQuotedRecord);

  if (Array.isArray(post.embeds)) {
    post.embeds.forEach((embed) =>
      collectEmbedImages(embed, images, includeQuotedRecord),
    );
  }

  return images.filter((image) => image.thumb || image.fullsize);
}

export function extractImages(post: FeedPost): PostImage[] {
  return collectPostImages(post, true);
}

export function extractOwnImages(post: FeedPost): PostImage[] {
  return collectPostImages(post, false);
}

export function hasOwnMedia(post: FeedPost): boolean {
  if (extractOwnImages(post).length > 0) {
    return true;
  }

  if (hasOwnVideo(post.embed)) {
    return true;
  }

  return post.embeds?.some((embed) => hasOwnVideo(embed)) ?? false;
}

export function toPostUrl(post: FeedPost): string {
  const rkey = post.uri.split("/").pop() ?? "";
  return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
}
