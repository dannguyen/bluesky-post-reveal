import {
  getEngagement,
  getPostTimestamp,
  getResponseRatio,
  hasOwnMedia,
  type FeedPost,
} from "$lib/bluesky";

export type SortField =
  | "engagement"
  | "ratio"
  | "timestamp"
  | "authorAge"
  | "likesPlusReposts"
  | "repliesPlusQuotes";
export type SortDirection = "biggest" | "smallest";

export const PAGE_SIZE = 10;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;

export interface CollectionStats {
  count: number;
  firstHourCount: number;
  firstDayCount: number;
  avgResponseHours: number | null;
  avgAccountAgeDays: number | null;
  highestEngagement: FeedPost | null;
}

export interface FilterOptions {
  minEngagementThreshold: number | null;
  minAccountOlderDays: number | null;
  requireOwnMedia: boolean;
  rootPostTimestampMs: number;
}

export function mergePostsByUri(
  existing: FeedPost[],
  incoming: FeedPost[],
): FeedPost[] {
  const byUri = new Map(existing.map((post) => [post.uri, post]));
  incoming.forEach((post) => byUri.set(post.uri, post));
  return [...byUri.values()];
}

export function normalizeOptionalPositive(
  value: number | string | null | undefined,
): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed > 0 ? parsed : null;
}

export function getAccountAgeDaysRelativeToPost(
  post: FeedPost,
  rootPostTimestampMs: number,
): number | null {
  const authorCreatedAtMs = Date.parse(post.author.createdAt ?? "");
  if (
    !Number.isFinite(rootPostTimestampMs) ||
    !Number.isFinite(authorCreatedAtMs)
  ) {
    return null;
  }

  return (rootPostTimestampMs - authorCreatedAtMs) / MS_PER_DAY;
}

export function passesMinEngagementFilter(
  post: FeedPost,
  threshold: number | null,
): boolean {
  if (threshold === null) {
    return true;
  }

  return getEngagement(post) >= threshold;
}

export function passesAccountAgeFilter(
  post: FeedPost,
  rootPostTimestampMs: number,
  olderThresholdDays: number | null,
): boolean {
  if (olderThresholdDays === null) {
    return true;
  }

  const accountAgeDays = getAccountAgeDaysRelativeToPost(
    post,
    rootPostTimestampMs,
  );
  if (accountAgeDays === null) {
    return false;
  }

  return accountAgeDays >= olderThresholdDays;
}

export function passesMediaFilter(
  post: FeedPost,
  requireOwnMedia: boolean,
): boolean {
  if (!requireOwnMedia) {
    return true;
  }

  return hasOwnMedia(post);
}

export function getFilteredSortedPosts(
  posts: FeedPost[],
  filterOptions: FilterOptions,
  sortBy: SortField,
  sortDirection: SortDirection,
): FeedPost[] {
  const filtered = posts.filter(
    (post) =>
      passesMinEngagementFilter(post, filterOptions.minEngagementThreshold) &&
      passesAccountAgeFilter(
        post,
        filterOptions.rootPostTimestampMs,
        filterOptions.minAccountOlderDays,
      ) &&
      passesMediaFilter(post, filterOptions.requireOwnMedia),
  );

  return sortPosts(filtered, sortBy, sortDirection);
}

export function countItemsWithinWindow(
  items: FeedPost[],
  baseMs: number,
  windowMs: number,
): number {
  if (!Number.isFinite(baseMs)) {
    return 0;
  }

  let count = 0;
  for (const item of items) {
    const itemMs = Date.parse(getPostTimestamp(item));
    if (!Number.isFinite(itemMs)) {
      continue;
    }

    const delta = itemMs - baseMs;
    if (delta >= 0 && delta <= windowMs) {
      count += 1;
    }
  }

  return count;
}

export function averageAccountAgeDaysAtPost(
  items: FeedPost[],
  baseMs: number,
): number | null {
  if (!Number.isFinite(baseMs)) {
    return null;
  }

  let total = 0;
  let count = 0;

  for (const item of items) {
    const authorCreatedMs = Date.parse(item.author.createdAt ?? "");
    if (!Number.isFinite(authorCreatedMs)) {
      continue;
    }

    total += (baseMs - authorCreatedMs) / MS_PER_DAY;
    count += 1;
  }

  return count > 0 ? total / count : null;
}

export function averageResponseHoursFromPost(
  items: FeedPost[],
  baseMs: number,
): number | null {
  if (!Number.isFinite(baseMs)) {
    return null;
  }

  let totalHours = 0;
  let count = 0;

  for (const item of items) {
    const itemMs = Date.parse(getPostTimestamp(item));
    if (!Number.isFinite(itemMs)) {
      continue;
    }

    totalHours += (itemMs - baseMs) / ONE_HOUR_MS;
    count += 1;
  }

  return count > 0 ? totalHours / count : null;
}

export function highestEngagementPost(items: FeedPost[]): FeedPost | null {
  if (items.length === 0) {
    return null;
  }

  let best = items[0];
  for (const item of items.slice(1)) {
    if (getEngagement(item) > getEngagement(best)) {
      best = item;
    }
  }

  return best;
}

export function computeCollectionStats(
  posts: FeedPost[],
  rootPostTimestampMs: number,
): CollectionStats {
  return {
    count: posts.length,
    firstHourCount: countItemsWithinWindow(
      posts,
      rootPostTimestampMs,
      ONE_HOUR_MS,
    ),
    firstDayCount: countItemsWithinWindow(
      posts,
      rootPostTimestampMs,
      MS_PER_DAY,
    ),
    avgResponseHours: averageResponseHoursFromPost(posts, rootPostTimestampMs),
    avgAccountAgeDays: averageAccountAgeDaysAtPost(posts, rootPostTimestampMs),
    highestEngagement: highestEngagementPost(posts),
  };
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

  // authorAge: older accounts rank as "bigger" age.
  const authorCreated = Date.parse(post.author.createdAt ?? "");
  if (!Number.isFinite(authorCreated)) {
    return Number.NEGATIVE_INFINITY;
  }

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

export function totalPages(items: FeedPost[], pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(items.length / pageSize));
}

export function clampPage(page: number, pages: number): number {
  return Math.min(pages, Math.max(1, page));
}

export function pageItems<T>(
  items: T[],
  page: number,
  pageSize = PAGE_SIZE,
): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
