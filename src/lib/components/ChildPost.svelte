<script lang="ts">
  import { extractOwnImages, getEngagement, getResponseRatio, toPostUrl, type FeedPost } from '$lib/bluesky';
  import { formatCompactCount, formatIsoTimestamp, formatRatio } from '$lib/formatting';
  import {
    authorDisplayName,
    authorDisplayNameShort,
    authorHandleShort,
    authorHandleText,
    getPostText,
    isAuthorDisplayNameTruncated,
    isAuthorHandleTruncated,
    joinedAgeLabel,
    responseLagLabel,
    shouldHighlightRatio
  } from '$lib/child-post-presenter';

  export let post: FeedPost;
  export let rootPostTimestampMs: number;
  export let rootPostTimestamp: string | undefined;

  $: firstImage = extractOwnImages(post)[0];
  $: firstImageUrl = firstImage?.fullsize ?? firstImage?.thumb;
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
          <a href={toPostUrl(post)} target="_blank" rel="noreferrer" class="duration-hint" title={formatIsoTimestamp(rootPostTimestamp)}
            >{responseLagLabel(post, rootPostTimestampMs)}</a
          >.
        </span>
        <span>
          Joined Bluesky
          <span class="duration-hint" title={formatIsoTimestamp(post.author.createdAt)}
            >{joinedAgeLabel(post, rootPostTimestampMs)} post</span
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
