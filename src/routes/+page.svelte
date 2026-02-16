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
    computeCollectionStats,
    getFilteredSortedPosts,
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
  let debouncedMinEngagement: number | '' = '';
  let debouncedAccountOlderDays: number | '' = '';
  let debouncedHasMediaOnly = false;
  let quotePage = 1;
  let replyPage = 1;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  $: rootImages = cs.postData ? extractImages(cs.postData) : [];
  $: rootPostTimestamp = cs.postData ? getPostTimestamp(cs.postData) : undefined;
  $: rootPostTimestampMs = Date.parse(rootPostTimestamp ?? '');
  $: filterOptions = {
    minEngagementThreshold: normalizeOptionalPositive(debouncedMinEngagement),
    minAccountOlderDays: normalizeOptionalPositive(debouncedAccountOlderDays),
    requireOwnMedia: debouncedHasMediaOnly,
    rootPostTimestampMs
  };

  $: sortedFilteredQuotes = getFilteredSortedPosts(cs.quotes, filterOptions, sortBy, sortDirection);
  $: sortedFilteredReplies = getFilteredSortedPosts(cs.replies, filterOptions, sortBy, sortDirection);

  $: quoteStats = computeCollectionStats(cs.quotes, rootPostTimestampMs);
  $: replyStats = computeCollectionStats(cs.replies, rootPostTimestampMs);

  $: statusLabel = cs.isBootstrapping || cs.isPolling ? 'fetching' : cs.hasReachedFinalQuoteCursor ? 'complete' : cs.pollStatus.toLowerCase();

  // Reset pagination when sort changes
  let lastSortKey = `${sortBy}:${sortDirection}`;
  $: {
    const sortKey = `${sortBy}:${sortDirection}`;
    if (sortKey !== lastSortKey) {
      lastSortKey = sortKey;
      quotePage = 1;
      replyPage = 1;
    }
  }

  onDestroy(() => {
    collector.destroy();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  function scheduleFilterApply(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debouncedMinEngagement = minEngagementInput;
      debouncedAccountOlderDays = accountOlderThanDaysInput;
      debouncedHasMediaOnly = hasMediaOnlyInput;
      quotePage = 1;
      replyPage = 1;
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
        <LiveStatsPanel {quoteStats} {replyStats} />
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
