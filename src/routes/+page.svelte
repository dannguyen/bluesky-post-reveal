<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import FilterPanel from '$lib/components/FilterPanel.svelte';
  import LiveStatsPanel from '$lib/components/LiveStatsPanel.svelte';
  import PostDetailsPanel from '$lib/components/PostDetailsPanel.svelte';
  import PostListColumn from '$lib/components/PostListColumn.svelte';
  import { formatCount } from '$lib/formatting';
  import { extractImages, getPostTimestamp } from '$lib/bluesky';
  import {
    MS_PER_DAY,
    ONE_HOUR_MS,
    averageAccountAgeDaysAtPost,
    averageResponseHoursFromPost,
    countItemsWithinWindow,
    getFilteredSortedPosts,
    highestEngagementPost,
    normalizeOptionalPositive,
    type SortDirection,
    type SortField
  } from '$lib/post-analysis';
  import { createPostCollector } from '$lib/post-collector';

  const collector = createPostCollector();
  const collectorState = collector.state;
  $: cs = $collectorState;

  let inputUrl = 'https://bsky.app/profile/jimmyfallon.bsky.social/post/3jvuuju3amj2i';

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

  $: minEngagementThreshold = normalizeOptionalPositive(appliedMinEngagementInput);
  $: minAccountOlderDays = normalizeOptionalPositive(appliedAccountOlderThanDaysInput);
  $: rootImages = cs.postData ? extractImages(cs.postData) : [];
  $: rootPostTimestamp = cs.postData ? getPostTimestamp(cs.postData) : undefined;
  $: rootPostTimestampMs = Date.parse(rootPostTimestamp ?? '');
  $: filterOptions = {
    minEngagementThreshold,
    minAccountOlderDays,
    requireOwnMedia: appliedHasMediaOnlyInput,
    rootPostTimestampMs
  };

  $: sortedFilteredQuotes = getFilteredSortedPosts(cs.quotes, filterOptions, sortBy, sortDirection);
  $: sortedFilteredReplies = getFilteredSortedPosts(cs.replies, filterOptions, sortBy, sortDirection);

  $: quoteFirstHourCount = countItemsWithinWindow(cs.quotes, rootPostTimestampMs, ONE_HOUR_MS);
  $: quoteFirstDayCount = countItemsWithinWindow(cs.quotes, rootPostTimestampMs, MS_PER_DAY);
  $: replyFirstHourCount = countItemsWithinWindow(cs.replies, rootPostTimestampMs, ONE_HOUR_MS);
  $: replyFirstDayCount = countItemsWithinWindow(cs.replies, rootPostTimestampMs, MS_PER_DAY);

  $: averageQuoteAccountAgeDays = averageAccountAgeDaysAtPost(cs.quotes, rootPostTimestampMs);
  $: averageReplyAccountAgeDays = averageAccountAgeDaysAtPost(cs.replies, rootPostTimestampMs);
  $: averageQuoteResponseHours = averageResponseHoursFromPost(cs.quotes, rootPostTimestampMs);
  $: averageReplyResponseHours = averageResponseHoursFromPost(cs.replies, rootPostTimestampMs);

  $: highestEngagementQuote = highestEngagementPost(cs.quotes);
  $: highestEngagementReply = highestEngagementPost(cs.replies);

  $: statusLabel = cs.isBootstrapping || cs.isPolling ? 'fetching' : cs.hasReachedFinalQuoteCursor ? 'complete' : cs.pollStatus.toLowerCase();

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
      <button type="submit" disabled={cs.isBootstrapping}>{cs.isBootstrapping ? 'Loading...' : 'Get Post Data'}</button>
    </form>

    <div class="action-grid">
      {#if cs.postData && (cs.isPolling || cs.isUserPaused)}
        <button
          type="button"
          class="ghost"
          on:click={() => {
            if (cs.isPolling) {
              collector.pause();
            } else {
              void collector.resume();
            }
          }}>{cs.isPolling ? 'Pause Polling' : 'Resume Polling'}</button
        >
      {/if}
      <button type="button" class="ghost" on:click={() => collector.downloadSnapshot(inputUrl)} disabled={!cs.postData}
        >Download JSON</button
      >
    </div>

    <p class="collection-status">
      Collected {formatCount(cs.quotes.length)} quotes and {formatCount(cs.replies.length)} replies. [{statusLabel}]
    </p>

    {#if cs.errorMessage}
      <p class="error">{cs.errorMessage}</p>
    {/if}
  </section>

  {#if cs.postData}
    <div class="post-stats-grid" in:fade={{ duration: 220 }} out:fade={{ duration: 180 }}>
      <div in:fly={{ y: 12, duration: 240 }}>
        <PostDetailsPanel post={cs.postData} images={rootImages} />
      </div>

      <div in:fly={{ y: 12, duration: 240, delay: 40 }}>
        <LiveStatsPanel
          quoteCount={cs.quotes.length}
          {quoteFirstHourCount}
          {quoteFirstDayCount}
          averageQuoteResponseHours={averageQuoteResponseHours}
          averageQuoteAccountAgeDays={averageQuoteAccountAgeDays}
          {highestEngagementQuote}
          replyCount={cs.replies.length}
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
