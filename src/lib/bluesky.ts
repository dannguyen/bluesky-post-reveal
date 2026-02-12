export const BSKY_PUBLIC_API = "https://public.api.bsky.app/xrpc";
export const CALL_DELAY_MS = 200;

export type SortField =
  | "engagement"
  | "ratio"
  | "timestamp"
  | "authorAge"
  | "likesPlusReposts"
  | "repliesPlusQuotes";
export type SortDirection = "biggest" | "smallest";

export interface Author {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  createdAt?: string;
}

export interface PostRecord {
  createdAt?: string;
  text?: string;
  reply?: {
    root?: { uri?: string };
    parent?: { uri?: string };
  };
}

export interface FeedPost {
  uri: string;
  cid?: string;
  author: Author;
  record?: PostRecord;
  embed?: unknown;
  embeds?: unknown[];
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
  likeCount?: number;
  indexedAt?: string;
}

export interface ResolveHandleResponse {
  did: string;
}

export interface GetPostsResponse {
  posts: FeedPost[];
}

export interface GetQuotesResponse {
  posts?: FeedPost[];
  cursor?: string;
}

export interface ThreadView {
  post?: FeedPost;
  replies?: ThreadView[];
  [key: string]: unknown;
}

export interface GetPostThreadResponse {
  thread?: ThreadView;
}

export interface ParsedPostUrl {
  sourceUrl: string;
  handle: string;
  rkey: string;
}

export interface PostImage {
  thumb?: string;
  fullsize?: string;
  alt?: string;
}

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

function maybePushImages(value: unknown, bucket: PostImage[]): void {
  if (!value || typeof value !== "object") {
    return;
  }

  const candidate = value as {
    images?: unknown[];
    media?: unknown;
    record?: unknown;
    embeds?: unknown[];
  };

  if (Array.isArray(candidate.images)) {
    for (const item of candidate.images) {
      if (item && typeof item === "object") {
        const image = item as {
          thumb?: string;
          fullsize?: string;
          alt?: string;
        };
        bucket.push({
          thumb: image.thumb,
          fullsize: image.fullsize,
          alt: image.alt,
        });
      }
    }
  }

  maybePushImages(candidate.media, bucket);

  if (candidate.record && typeof candidate.record === "object") {
    const record = candidate.record as { embeds?: unknown[]; media?: unknown };
    if (Array.isArray(record.embeds)) {
      record.embeds.forEach((embed) => maybePushImages(embed, bucket));
    }
    maybePushImages(record.media, bucket);
  }

  if (Array.isArray(candidate.embeds)) {
    candidate.embeds.forEach((embed) => maybePushImages(embed, bucket));
  }
}

function maybePushOwnImages(value: unknown, bucket: PostImage[]): void {
  if (!value || typeof value !== "object") {
    return;
  }

  const candidate = value as {
    images?: unknown[];
    media?: unknown;
    embeds?: unknown[];
  };

  if (Array.isArray(candidate.images)) {
    for (const item of candidate.images) {
      if (item && typeof item === "object") {
        const image = item as {
          thumb?: string;
          fullsize?: string;
          alt?: string;
        };
        bucket.push({
          thumb: image.thumb,
          fullsize: image.fullsize,
          alt: image.alt,
        });
      }
    }
  }

  // `media` is still owned by the current post in recordWithMedia views.
  maybePushOwnImages(candidate.media, bucket);

  if (Array.isArray(candidate.embeds)) {
    candidate.embeds.forEach((embed) => maybePushOwnImages(embed, bucket));
  }
}

function hasOwnVideo(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    $type?: unknown;
    playlist?: unknown;
    media?: unknown;
    embeds?: unknown[];
  };

  if (
    typeof candidate.$type === "string" &&
    candidate.$type.includes("embed.video")
  ) {
    return true;
  }

  if (typeof candidate.playlist === "string") {
    return true;
  }

  if (hasOwnVideo(candidate.media)) {
    return true;
  }

  if (Array.isArray(candidate.embeds)) {
    return candidate.embeds.some((embed) => hasOwnVideo(embed));
  }

  return false;
}

export function extractImages(post: FeedPost): PostImage[] {
  const images: PostImage[] = [];
  maybePushImages(post.embed, images);

  if (Array.isArray(post.embeds)) {
    post.embeds.forEach((embed) => maybePushImages(embed, images));
  }

  return images.filter((image) => image.thumb || image.fullsize);
}

export function extractOwnImages(post: FeedPost): PostImage[] {
  const images: PostImage[] = [];
  maybePushOwnImages(post.embed, images);

  if (Array.isArray(post.embeds)) {
    post.embeds.forEach((embed) => maybePushOwnImages(embed, images));
  }

  return images.filter((image) => image.thumb || image.fullsize);
}

export function hasOwnMedia(post: FeedPost): boolean {
  if (extractOwnImages(post).length > 0) {
    return true;
  }

  if (hasOwnVideo(post.embed)) {
    return true;
  }

  if (Array.isArray(post.embeds)) {
    return post.embeds.some((embed) => hasOwnVideo(embed));
  }

  return false;
}

export function toPostUrl(post: FeedPost): string {
  const rkey = post.uri.split("/").pop() ?? "";
  return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
}

function getSortValue(post: FeedPost, sortField: SortField): number {
  if (sortField === "engagement") {
    return getEngagement(post);
  }

  if (sortField === "ratio") {
    return getResponseRatio(post);
  }

  if (sortField === "likesPlusReposts") {
    return (post.likeCount ?? 0) + (post.repostCount ?? 0);
  }

  if (sortField === "repliesPlusQuotes") {
    return (post.replyCount ?? 0) + (post.quoteCount ?? 0);
  }

  if (sortField === "timestamp") {
    const ts = Date.parse(getPostTimestamp(post));
    return Number.isFinite(ts) ? ts : Number.NEGATIVE_INFINITY;
  }

  const authorCreated = Date.parse(post.author.createdAt ?? "");
  if (!Number.isFinite(authorCreated)) {
    return Number.NEGATIVE_INFINITY;
  }

  // Older accounts should rank as "bigger" age.
  return -authorCreated;
}

export function sortPosts(
  posts: FeedPost[],
  sortField: SortField,
  sortDirection: SortDirection,
): FeedPost[] {
  const sorted = [...posts];

  sorted.sort((a, b) => {
    const aValue = getSortValue(a, sortField);
    const bValue = getSortValue(b, sortField);
    if (sortDirection === "biggest") {
      return bValue - aValue;
    }

    return aValue - bValue;
  });

  return sorted;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
