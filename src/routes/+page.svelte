<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import FilterPanel from '$lib/components/FilterPanel.svelte';
  import LiveStatsPanel from '$lib/components/LiveStatsPanel.svelte';
  import PostDetailsPanel from '$lib/components/PostDetailsPanel.svelte';
  import PostListColumn from '$lib/components/PostListColumn.svelte';
  import { formatCount } from '$lib/formatting';
  import { extractImages, getPostTimestamp, type FeedPost, type SortDirection, type SortField } from '$lib/bluesky';
  import {
    ONE_DAY_MS,
    ONE_HOUR_MS,
    averageAccountAgeDaysAtPost,
    averageResponseHoursFromPost,
    countItemsWithinWindow,
    getFilteredSortedPosts,
    highestEngagementPost,
    normalizeOptionalPositive
  } from '$lib/post-analysis';
  import { createPostCollector } from '$lib/post-collector';

  const collector = createPostCollector();
  const collectorState = collector.state;

  let inputUrl = 'https://bsky.app/profile/jimmyfallon.bsky.social/post/3jvuuju3amj2i';

  let postData: FeedPost | null = null;
  let quotes: FeedPost[] = [];
  let replies: FeedPost[] = [];
  let isBootstrapping = false;
  let isPolling = false;
  let isUserPaused = false;
  let hasReachedFinalQuoteCursor = false;
  let pollStatus = 'Idle';
  let errorMessage = '';

  let sortBy: SortField = 'engagement';
  let sortDirection: SortDirection = 'biggest';
  let minEngagementInput: number | '' = '';
  let accountOlderThanDaysInput: number | '' = '';
  let hasMediaOnlyInput = false;
  let appliedMinEngagementInput: number | '' = '';
  let appliedAccountOlderThanDaysInput: number | '' = '';
  let appliedHasMediaOnlyInput = false;
  let quotePage = 1;
  let replyPage = 1;

  let filterApplyTimer: ReturnType<typeof setTimeout> | null = null;
  let filterSignature = `${sortBy}:${sortDirection}:none:none:all-media`;
  let lastFilterSignature = filterSignature;

  $: postData = $collectorState.postData;
  $: quotes = $collectorState.quotes;
  $: replies = $collectorState.replies;
  $: isBootstrapping = $collectorState.isBootstrapping;
  $: isPolling = $collectorState.isPolling;
  $: isUserPaused = $collectorState.isUserPaused;
  $: hasReachedFinalQuoteCursor = $collectorState.hasReachedFinalQuoteCursor;
  $: pollStatus = $collectorState.pollStatus;
  $: errorMessage = $collectorState.errorMessage;

  $: minEngagementThreshold = normalizeOptionalPositive(appliedMinEngagementInput);
  $: minAccountOlderDays = normalizeOptionalPositive(appliedAccountOlderThanDaysInput);
  $: rootImages = postData ? extractImages(postData) : [];
  $: rootPostTimestamp = postData ? getPostTimestamp(postData) : undefined;
  $: rootPostTimestampMs = Date.parse(rootPostTimestamp ?? '');
  $: filterOptions = {
    minEngagementThreshold,
    minAccountOlderDays,
    requireOwnMedia: appliedHasMediaOnlyInput,
    rootPostTimestampMs
  };

  $: sortedFilteredQuotes = getFilteredSortedPosts(quotes, filterOptions, sortBy, sortDirection);
  $: sortedFilteredReplies = getFilteredSortedPosts(replies, filterOptions, sortBy, sortDirection);

  $: quoteFirstHourCount = countItemsWithinWindow(quotes, rootPostTimestampMs, ONE_HOUR_MS);
  $: quoteFirstDayCount = countItemsWithinWindow(quotes, rootPostTimestampMs, ONE_DAY_MS);
  $: replyFirstHourCount = countItemsWithinWindow(replies, rootPostTimestampMs, ONE_HOUR_MS);
  $: replyFirstDayCount = countItemsWithinWindow(replies, rootPostTimestampMs, ONE_DAY_MS);

  $: averageQuoteAccountAgeDays = averageAccountAgeDaysAtPost(quotes, rootPostTimestampMs);
  $: averageReplyAccountAgeDays = averageAccountAgeDaysAtPost(replies, rootPostTimestampMs);
  $: averageQuoteResponseHours = averageResponseHoursFromPost(quotes, rootPostTimestampMs);
  $: averageReplyResponseHours = averageResponseHoursFromPost(replies, rootPostTimestampMs);

  $: highestEngagementQuote = highestEngagementPost(quotes);
  $: highestEngagementReply = highestEngagementPost(replies);

  $: statusLabel = isBootstrapping || isPolling ? 'fetching' : hasReachedFinalQuoteCursor ? 'complete' : pollStatus.toLowerCase();

  $: filterSignature = `${sortBy}:${sortDirection}:${minEngagementThreshold ?? 'none'}:${minAccountOlderDays ?? 'none'}:${appliedHasMediaOnlyInput ? 'media-only' : 'all-media'}`;
  $: if (filterSignature !== lastFilterSignature) {
    quotePage = 1;
    replyPage = 1;
    lastFilterSignature = filterSignature;
  }

  onDestroy(() => {
    collector.destroy();
    if (filterApplyTimer) {
      clearTimeout(filterApplyTimer);
    }
  });

  function scheduleFilterApply(): void {
    if (filterApplyTimer) {
      clearTimeout(filterApplyTimer);
    }

    filterApplyTimer = setTimeout(() => {
      appliedMinEngagementInput = minEngagementInput;
      appliedAccountOlderThanDaysInput = accountOlderThanDaysInput;
      appliedHasMediaOnlyInput = hasMediaOnlyInput;
    }, 500);
  }
</script>

<main class="page-shell">
  <section class="panel hero" in:fly={{ y: -10, duration: 260 }}>
    <h1 class="eyebrow">Bluesky Postmortems</h1>
    <h2>Examine the engagement for any Bluesky post</h2>
    <p class="subhead">Paste a Bluesky post URL:</p>

    <form
      class="query-row"
      on:submit|preventDefault={() => {
        void collector.fetchFromUrl(inputUrl);
      }}
    >
      <label class="sr-only" for="post-url">Bluesky post URL</label>
      <input id="post-url" type="url" bind:value={inputUrl} placeholder="https://bsky.app/profile/.../post/..." />
      <button type="submit" disabled={isBootstrapping}>{isBootstrapping ? 'Loading...' : 'Get Post Data'}</button>
    </form>

    <div class="action-grid">
      {#if postData && (isPolling || isUserPaused)}
        <button
          type="button"
          class="ghost"
          on:click={() => {
            if (isPolling) {
              collector.pause();
            } else {
              void collector.resume();
            }
          }}>{isPolling ? 'Pause Polling' : 'Resume Polling'}</button
        >
      {/if}
      <button type="button" class="ghost" on:click={() => collector.downloadSnapshot(inputUrl)} disabled={!postData}
        >Download JSON</button
      >
    </div>

    <p class="collection-status">
      Collected {formatCount(quotes.length)} quotes and {formatCount(replies.length)} replies. [{statusLabel}]
    </p>

    {#if errorMessage}
      <p class="error">{errorMessage}</p>
    {/if}
  </section>

  {#if postData}
    <div class="post-stats-grid" in:fade={{ duration: 220 }} out:fade={{ duration: 180 }}>
      <div in:fly={{ y: 12, duration: 240 }}>
        <PostDetailsPanel post={postData} images={rootImages} />
      </div>

      <div in:fly={{ y: 12, duration: 240, delay: 40 }}>
        <LiveStatsPanel
          quoteCount={quotes.length}
          {quoteFirstHourCount}
          {quoteFirstDayCount}
          averageQuoteResponseHours={averageQuoteResponseHours}
          averageQuoteAccountAgeDays={averageQuoteAccountAgeDays}
          {highestEngagementQuote}
          replyCount={replies.length}
          {replyFirstHourCount}
          {replyFirstDayCount}
          averageReplyResponseHours={averageReplyResponseHours}
          averageReplyAccountAgeDays={averageReplyAccountAgeDays}
          {highestEngagementReply}
        />
      </div>
    </div>

    <div in:fly={{ y: 12, duration: 240, delay: 70 }}>
      <FilterPanel
        bind:sortBy
        bind:sortDirection
        bind:minEngagementInput
        bind:accountOlderThanDaysInput
        bind:hasMediaOnlyInput
        on:filterinput={scheduleFilterApply}
      />
    </div>

    <div class="list-columns" in:fade={{ duration: 220 }}>
      <PostListColumn
        title="Quotes"
        description="quote posts"
        emptyMessage="No quote posts match the current filter yet."
        posts={sortedFilteredQuotes}
        bind:page={quotePage}
        {rootPostTimestampMs}
        {rootPostTimestamp}
        panelDelayMs={100}
      />

      <PostListColumn
        title="Replies"
        description="replies"
        emptyMessage="No replies match the current filter yet."
        posts={sortedFilteredReplies}
        bind:page={replyPage}
        {rootPostTimestampMs}
        {rootPostTimestamp}
        panelDelayMs={130}
      />
    </div>
  {/if}
</main>
