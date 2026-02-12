import {
  getEngagement,
  getPostTimestamp,
  getResponseRatio,
  type FeedPost,
} from "$lib/bluesky";
import { humanTimeDurationFormatter } from "$lib/formatting";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AUTHOR_NAME_MAX_CHARS = 40;
const AUTHOR_HANDLE_MAX_CHARS = 60;

export function getPostText(post: FeedPost): string {
  return post.record?.text?.trim() || "(No text in payload)";
}

export function authorDisplayName(post: FeedPost): string {
  return (post.author.displayName ?? post.author.handle).trim();
}

export function authorDisplayNameShort(post: FeedPost): string {
  return truncateWithEllipsis(authorDisplayName(post), AUTHOR_NAME_MAX_CHARS);
}

export function isAuthorDisplayNameTruncated(post: FeedPost): boolean {
  return authorDisplayName(post).length > AUTHOR_NAME_MAX_CHARS;
}

export function authorHandleText(post: FeedPost): string {
  return `@${post.author.handle}`;
}

export function authorHandleShort(post: FeedPost): string {
  return truncateWithEllipsis(authorHandleText(post), AUTHOR_HANDLE_MAX_CHARS);
}

export function isAuthorHandleTruncated(post: FeedPost): boolean {
  return authorHandleText(post).length > AUTHOR_HANDLE_MAX_CHARS;
}

export function responseLagLabel(
  post: FeedPost,
  rootPostTimestampMs: number,
): string {
  const lagHours = responseLagHoursFromRoot(post, rootPostTimestampMs);
  if (lagHours === null) {
    return "after unknown hours";
  }

  const formatted = humanTimeDurationFormatter(Math.abs(lagHours) * 60 * 60);
  return lagHours >= 0 ? `after ${formatted}` : `${formatted} before`;
}

export function joinedAgeLabel(
  post: FeedPost,
  rootPostTimestampMs: number,
): string {
  const ageDays = getAccountAgeDaysRelativeToPost(post, rootPostTimestampMs);
  if (ageDays === null) {
    return "unknown days before";
  }

  const formatted = humanTimeDurationFormatter(
    Math.abs(ageDays) * 24 * 60 * 60,
  );
  return ageDays >= 0 ? `${formatted} before` : `${formatted} after`;
}

export function shouldHighlightRatio(post: FeedPost): boolean {
  return getEngagement(post) >= 20 && getResponseRatio(post) > 0.5;
}

function responseLagHoursFromRoot(
  post: FeedPost,
  rootPostTimestampMs: number,
): number | null {
  const responseMs = Date.parse(getPostTimestamp(post));
  if (!Number.isFinite(rootPostTimestampMs) || !Number.isFinite(responseMs)) {
    return null;
  }

  return (responseMs - rootPostTimestampMs) / (60 * 60 * 1000);
}

function getAccountAgeDaysRelativeToPost(
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

function truncateWithEllipsis(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars - 1)}...`;
}
