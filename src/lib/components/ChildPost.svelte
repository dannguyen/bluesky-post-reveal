<script lang="ts">
  import { extractOwnImages, getEngagement, getPostTimestamp, getResponseRatio, type FeedPost } from '$lib/bluesky';
  import { formatCompactCount, formatIsoTimestamp, formatRatio, humanTimeDurationFormatter } from '$lib/formatting';

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const AUTHOR_NAME_MAX_CHARS = 40;
  const AUTHOR_HANDLE_MAX_CHARS = 60;

  export let post: FeedPost;
  export let rootPostTimestampMs: number;
  export let rootPostTimestamp: string | undefined;
  $: firstImage = extractOwnImages(post)[0];
  $: firstImageUrl = firstImage?.fullsize ?? firstImage?.thumb;

  function getPostText(value: FeedPost): string {
    return value.record?.text?.trim() || '(No text in payload)';
  }

  function truncateWithEllipsis(value: string, maxChars: number): string {
    if (value.length <= maxChars) {
      return value;
    }

    return `${value.slice(0, maxChars - 1)}...`;
  }

  function authorDisplayName(value: FeedPost): string {
    return (value.author.displayName ?? value.author.handle).trim();
  }

  function authorDisplayNameShort(value: FeedPost): string {
    return truncateWithEllipsis(authorDisplayName(value), AUTHOR_NAME_MAX_CHARS);
  }

  function isAuthorDisplayNameTruncated(value: FeedPost): boolean {
    return authorDisplayName(value).length > AUTHOR_NAME_MAX_CHARS;
  }

  function authorHandleText(value: FeedPost): string {
    return `@${value.author.handle}`;
  }

  function authorHandleShort(value: FeedPost): string {
    return truncateWithEllipsis(authorHandleText(value), AUTHOR_HANDLE_MAX_CHARS);
  }

  function isAuthorHandleTruncated(value: FeedPost): boolean {
    return authorHandleText(value).length > AUTHOR_HANDLE_MAX_CHARS;
  }

  function toPostUrl(value: FeedPost): string {
    const rkey = value.uri.split('/').pop() ?? '';
    return `https://bsky.app/profile/${value.author.handle}/post/${rkey}`;
  }

  function responseLagHoursFromRoot(value: FeedPost): number | null {
    const responseMs = Date.parse(getPostTimestamp(value));
    if (!Number.isFinite(rootPostTimestampMs) || !Number.isFinite(responseMs)) {
      return null;
    }

    return (responseMs - rootPostTimestampMs) / (60 * 60 * 1000);
  }

  function responseLagYearsFromRoot(value: FeedPost): number | null {
    const responseMs = Date.parse(getPostTimestamp(value));
    if (!Number.isFinite(rootPostTimestampMs) || !Number.isFinite(responseMs)) {
      return null;
    }

    return (responseMs - rootPostTimestampMs) / (24 * 365 * 60 * 60 * 1000);
  }

  function responseYearPrefix(value: FeedPost): string {
    const lagYears = responseLagYearsFromRoot(value);
    if (lagYears === null || lagYears < 1) {
      return '';
    }

    const responseMs = Date.parse(getPostTimestamp(value));
    if (!Number.isFinite(responseMs)) {
      return '';
    }

    return `in ${new Date(responseMs).getFullYear()} `;
  }

  function joinedYearPrefix(value: FeedPost): string {
    const ageDays = getAccountAgeDaysRelativeToPost(value);
    if (ageDays === null || Math.abs(ageDays) < 365) {
      return '';
    }

    const createdAtMs = Date.parse(value.author.createdAt ?? '');
    if (!Number.isFinite(createdAtMs)) {
      return '';
    }

    return `in ${new Date(createdAtMs).getFullYear()} `;
  }


  function responseLagLabel(value: FeedPost): string {
    const lag = responseLagHoursFromRoot(value);
    if (lag === null) {
      return 'after unknown hours';
    }

    const formatted = humanTimeDurationFormatter(Math.abs(lag) * 60 * 60);
    if (lag >= 0) {
      return `after ${formatted}`;
    }

    return `${formatted} before`;
  }

  function getAccountAgeDaysRelativeToPost(value: FeedPost): number | null {
    const authorCreatedAtMs = Date.parse(value.author.createdAt ?? '');
    if (!Number.isFinite(rootPostTimestampMs) || !Number.isFinite(authorCreatedAtMs)) {
      return null;
    }

    return (rootPostTimestampMs - authorCreatedAtMs) / MS_PER_DAY;
  }

  function joinedAgeLabel(value: FeedPost): string {
    const ageDays = getAccountAgeDaysRelativeToPost(value);
    if (ageDays === null) {
      return 'unknown days before';
    }

    const formatted = humanTimeDurationFormatter(Math.abs(ageDays) * 24 * 60 * 60);
    if (ageDays >= 0) {
      return `${formatted} before`;
    }

    return `${formatted} after`;
  }

  function shouldHighlightRatio(value: FeedPost): boolean {
    return getEngagement(value) >= 20 && getResponseRatio(value) > 0.5;
  }
</script>

<header>
  <div class="author-chip">
    {#if post.author.avatar}
      <img src={post.author.avatar} alt={post.author.handle} class="author-thumb" loading="lazy" />
    {:else}
      <span class="author-thumb placeholder">{post.author.handle.charAt(0).toUpperCase()}</span>
    {/if}
    <div>
      <p class="author-line">
        <span
          class="author-name"
          title={isAuthorDisplayNameTruncated(post) ? authorDisplayName(post) : undefined}
          >{authorDisplayNameShort(post)}</span
        >
        <span
          class="author-handle"
          title={isAuthorHandleTruncated(post) ? authorHandleText(post) : undefined}
          >{authorHandleShort(post)}</span
        >
      </p>
      <p class="author-created">
        <span>
          Responded
          {responseYearPrefix(post)}
          <a
            href={toPostUrl(post)}
            target="_blank"
            rel="noreferrer"
            class="duration-hint"
            title={formatIsoTimestamp(rootPostTimestamp)}
            >{responseLagLabel(post)}</a
          >.
        </span>
        <span>
          Joined Bluesky
          {joinedYearPrefix(post)}
          <span class="duration-hint" title={formatIsoTimestamp(post.author.createdAt)}
            >{joinedAgeLabel(post)} post</span
          >.
        </span>
      </p>
    </div>
  </div>
</header>
<p class="item-text">{getPostText(post)}</p>
{#if firstImageUrl}
  <div class="child-media">
    <img src={firstImageUrl} alt={firstImage?.alt ?? 'Embedded media'} loading="lazy" />
  </div>
{/if}
<div class="item-stats-line">
  <span class="summary-stat">
    <span class="stat stat-engagements"><strong>{formatCompactCount(getEngagement(post))}</strong> engagements</span>
    <span class="stat stat-ratio" class:ratio-alert={shouldHighlightRatio(post)}
      ><strong>{formatRatio(getResponseRatio(post))}</strong> ratio</span
    >
  </span>
  <span class="stat stat-likes"><strong>{formatCompactCount(post.likeCount)}</strong> likes</span>
  <span class="stat stat-reposts"><strong>{formatCompactCount(post.repostCount)}</strong> reposts</span>
  <span class="stat stat-replies"><strong>{formatCompactCount(post.replyCount)}</strong> replies</span>
  <span class="stat stat-quotes"><strong>{formatCompactCount(post.quoteCount)}</strong> quotes</span>
</div>
