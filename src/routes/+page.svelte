<script lang="ts">
  import { onDestroy } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade, fly } from 'svelte/transition';
  import ChildPost from '$lib/components/ChildPost.svelte';
  import {
    formatCompactCount,
    formatCount,
    formatDurationFromDays,
    formatDurationFromHours,
    formatTimestamp
  } from '$lib/formatting';
  import {
    CALL_DELAY_MS,
    buildAtUri,
    extractImages,
    extractReplies,
    fetchPost,
    fetchQuotes,
    fetchThread,
    getEngagement,
    getPostTimestamp,
    parsePostUrl,
    resolveDid,
    sleep,
    sortPosts,
    type FeedPost,
    type SortDirection,
    type SortField
  } from '$lib/bluesky';

  const PAGE_SIZE = 10;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let inputUrl = 'https://bsky.app/profile/jimmyfallon.bsky.social/post/3jvuuju3amj2i';
  let normalizedUrl = '';
  let atUri = '';

  let postData: FeedPost | null = null;
  let quotes: FeedPost[] = [];
  let replies: FeedPost[] = [];

  let sortBy: SortField = 'engagement';
  let sortDirection: SortDirection = 'biggest';
  let minEngagementInput: number | '' = '';
  let accountOlderThanDaysInput: number | '' = '';
  let appliedMinEngagementInput: number | '' = '';
  let appliedAccountOlderThanDaysInput: number | '' = '';
  let quotePage = 1;
  let replyPage = 1;

  let isBootstrapping = false;
  let isPolling = false;
  let pollStatus = 'Idle';
  let errorMessage = '';

  let quoteCursor: string | undefined;
  let quoteRequests = 0;
  let replyRequests = 0;
  let hasFetchedRepliesOnce = false;
  let hasReachedFinalQuoteCursor = false;
  let isUserPaused = false;

  let runToken = 0;
  let filterSignature = `${sortBy}:${sortDirection}:none:none`;
  let lastFilterSignature = filterSignature;
  let filterApplyTimer: ReturnType<typeof setTimeout> | null = null;

  $: minEngagementThreshold = normalizeOptionalPositive(appliedMinEngagementInput);
  $: minAccountOlderDays = normalizeOptionalPositive(appliedAccountOlderThanDaysInput);
  $: rootImages = postData ? extractImages(postData) : [];
  $: rootPostTimestamp = postData ? getPostTimestamp(postData) : undefined;
  $: rootPostTimestampMs = Date.parse(rootPostTimestamp ?? '');
  $: sortedFilteredQuotes = sortPosts(
    quotes.filter(
      (item) =>
        passesMinEngagementFilter(item, minEngagementThreshold) &&
        passesAccountAgeFilter(item, rootPostTimestampMs, minAccountOlderDays)
    ),
    sortBy,
    sortDirection
  );
  $: sortedFilteredReplies = sortPosts(
    replies.filter(
      (item) =>
        passesMinEngagementFilter(item, minEngagementThreshold) &&
        passesAccountAgeFilter(item, rootPostTimestampMs, minAccountOlderDays)
    ),
    sortBy,
    sortDirection
  );
  $: quoteTotalPages = Math.max(1, Math.ceil(sortedFilteredQuotes.length / PAGE_SIZE));
  $: replyTotalPages = Math.max(1, Math.ceil(sortedFilteredReplies.length / PAGE_SIZE));
  $: quotePage = Math.min(quoteTotalPages, Math.max(1, quotePage));
  $: replyPage = Math.min(replyTotalPages, Math.max(1, replyPage));
  $: pagedQuotes = sortedFilteredQuotes.slice((quotePage - 1) * PAGE_SIZE, quotePage * PAGE_SIZE);
  $: pagedReplies = sortedFilteredReplies.slice((replyPage - 1) * PAGE_SIZE, replyPage * PAGE_SIZE);
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
  $: filterSignature = `${sortBy}:${sortDirection}:${minEngagementThreshold ?? 'none'}:${minAccountOlderDays ?? 'none'}`;
  $: if (filterSignature !== lastFilterSignature) {
    quotePage = 1;
    replyPage = 1;
    lastFilterSignature = filterSignature;
  }

  onDestroy(() => {
    runToken += 1;
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
    }, 500);
  }

  function mergePosts(existing: FeedPost[], incoming: FeedPost[]): FeedPost[] {
    const byUri = new Map(existing.map((post) => [post.uri, post]));
    incoming.forEach((post) => byUri.set(post.uri, post));
    return [...byUri.values()];
  }

  function normalizeOptionalPositive(value: number | string | null | undefined): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return parsed > 0 ? parsed : null;
  }

  function passesMinEngagementFilter(post: FeedPost, threshold: number | null): boolean {
    if (threshold === null) {
      return true;
    }

    return getEngagement(post) >= threshold;
  }

  function countItemsWithinWindow(items: FeedPost[], baseMs: number, windowMs: number): number {
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

  function averageAccountAgeDaysAtPost(items: FeedPost[], baseMs: number): number | null {
    if (!Number.isFinite(baseMs)) {
      return null;
    }

    let total = 0;
    let count = 0;

    for (const item of items) {
      const authorCreatedMs = Date.parse(item.author.createdAt ?? '');
      if (!Number.isFinite(authorCreatedMs)) {
        continue;
      }

      total += (baseMs - authorCreatedMs) / MS_PER_DAY;
      count += 1;
    }

    return count > 0 ? total / count : null;
  }

  function averageResponseHoursFromPost(items: FeedPost[], baseMs: number): number | null {
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

      totalHours += (itemMs - baseMs) / (60 * 60 * 1000);
      count += 1;
    }

    return count > 0 ? totalHours / count : null;
  }

  function highestEngagementPost(items: FeedPost[]): FeedPost | null {
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

  function getAccountAgeDaysRelativeToPost(post: FeedPost, rootCreatedAtMs: number): number | null {
    const authorCreatedAtMs = Date.parse(post.author.createdAt ?? '');
    if (!Number.isFinite(rootCreatedAtMs) || !Number.isFinite(authorCreatedAtMs)) {
      return null;
    }

    return (rootCreatedAtMs - authorCreatedAtMs) / MS_PER_DAY;
  }

  function passesAccountAgeFilter(post: FeedPost, rootCreatedAtMs: number, olderThresholdDays: number | null): boolean {
    const hasOlderFilter = olderThresholdDays !== null;
    if (!hasOlderFilter) {
      return true;
    }

    const accountAgeDays = getAccountAgeDaysRelativeToPost(post, rootCreatedAtMs);
    if (accountAgeDays === null) {
      return false;
    }

    if (hasOlderFilter && accountAgeDays < olderThresholdDays) {
      return false;
    }

    return true;
  }

  function getPostText(post: FeedPost): string {
    return post.record?.text?.trim() || '(No text in payload)';
  }

  function toPostUrl(post: FeedPost): string {
    const rkey = post.uri.split('/').pop() ?? '';
    return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
  }

  function resetCollection(): void {
    postData = null;
    quotes = [];
    replies = [];
    quoteCursor = undefined;
    quoteRequests = 0;
    replyRequests = 0;
    hasFetchedRepliesOnce = false;
    hasReachedFinalQuoteCursor = false;
    isUserPaused = false;
    quotePage = 1;
    replyPage = 1;
  }

  function stopPolling(status = 'Paused'): void {
    runToken += 1;
    isPolling = false;
    isBootstrapping = false;
    pollStatus = status;
    isUserPaused = status === 'Paused';
  }

  async function fetchThePost(): Promise<void> {
    const token = runToken + 1;
    runToken = token;

    errorMessage = '';
    resetCollection();
    isBootstrapping = true;
    isUserPaused = false;

    try {
      pollStatus = 'Parsing URL...';
      const parsed = parsePostUrl(inputUrl);
      normalizedUrl = parsed.sourceUrl;

      pollStatus = `Resolving handle ${parsed.handle}...`;
      const did = await resolveDid(parsed.handle);
      if (token !== runToken) {
        return;
      }

      atUri = buildAtUri(did, parsed.rkey);

      pollStatus = 'Fetching post metadata...';
      postData = await fetchPost(atUri);
      if (token !== runToken) {
        return;
      }

      isBootstrapping = false;
      isPolling = true;
      pollStatus = 'Starting collection loop...';

      void startPolling(token, atUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown setup error';
      errorMessage = message;
      isBootstrapping = false;
      isPolling = false;
      pollStatus = 'Failed';
    }
  }

  async function resumePolling(): Promise<void> {
    if (!atUri || isPolling || !postData) {
      return;
    }

    if (hasReachedFinalQuoteCursor) {
      pollStatus = `Quote pagination already complete: ${quotes.length} quotes and ${replies.length} replies collected.`;
      return;
    }

    const token = runToken + 1;
    runToken = token;

    errorMessage = '';
    isPolling = true;
    isUserPaused = false;
    pollStatus = 'Resuming collection...';

    void startPolling(token, atUri);
  }

  async function startPolling(token: number, rootAtUri: string): Promise<void> {
    let localQuoteCursor = quoteCursor;

    while (token === runToken && !hasReachedFinalQuoteCursor) {
      try {
        pollStatus = 'Polling quote posts...';
        const quoteResponse = await fetchQuotes(rootAtUri, localQuoteCursor);
        if (token !== runToken) {
          return;
        }

        quotes = mergePosts(quotes, quoteResponse.posts ?? []);
        quoteRequests += 1;

        localQuoteCursor = quoteResponse.cursor;
        quoteCursor = quoteResponse.cursor;

        if (!quoteResponse.cursor) {
          hasReachedFinalQuoteCursor = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown quote polling error';
        errorMessage = `Quote polling error: ${message}`;
      }

      if (token !== runToken) {
        return;
      }

      await sleep(CALL_DELAY_MS);
      if (token !== runToken) {
        return;
      }

      if (!hasFetchedRepliesOnce) {
        try {
          pollStatus = 'Fetching one-time replies snapshot from post thread...';
          const threadResponse = await fetchThread(rootAtUri);
          if (token !== runToken) {
            return;
          }

          const extracted = extractReplies(threadResponse, rootAtUri);
          replies = mergePosts(replies, extracted);
          replyRequests += 1;
          hasFetchedRepliesOnce = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown reply polling error';
          errorMessage = `Reply polling error: ${message}`;
        }
      }

      if (token !== runToken) {
        return;
      }

      if (hasReachedFinalQuoteCursor) {
        break;
      }

      pollStatus = `Collected ${quotes.length} quotes and ${replies.length} replies.`;
      await sleep(CALL_DELAY_MS);
    }

    if (token === runToken && hasReachedFinalQuoteCursor) {
      isPolling = false;
      isUserPaused = false;
      pollStatus = `Quote pagination complete: ${quotes.length} quotes and ${replies.length} replies collected.`;
    }
  }

  function downloadSnapshot(): void {
    const payload = {
      url: normalizedUrl || inputUrl,
      postData,
      replyData: replies,
      quoteData: quotes
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = href;
    link.download = `bluesky-postmortems-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(href);
  }
</script>

<main class="page-shell">
  <section class="panel hero" in:fly={{ y: -10, duration: 260 }}>
    <h1 class="eyebrow">Bluesky Postmortems</h1>
    <h2>Examine the engagement for any Bluesky post</h2>
    <p class="subhead">
      Paste a Bluesky post URL:
    </p>

    <form
      class="query-row"
      on:submit|preventDefault={() => {
        void fetchThePost();
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
              stopPolling();
            } else {
              void resumePolling();
            }
          }}>{isPolling ? 'Pause Polling' : 'Resume Polling'}</button
        >
      {/if}
      <button type="button" class="ghost" on:click={downloadSnapshot} disabled={!postData}>Download JSON</button>
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
      <section class="panel post-panel" in:fly={{ y: 12, duration: 240 }}>
        <div class="post-head">
          {#if postData.author.avatar}
            <img src={postData.author.avatar} alt={postData.author.handle} class="avatar" />
          {/if}
          <div>
            <h2>{postData.author.displayName ?? postData.author.handle}</h2>
            <p>@{postData.author.handle}</p>
          </div>
        </div>

        <p class="body-text">{getPostText(postData)}</p>

        {#if rootImages.length > 0}
          <div class="image-grid">
            {#each rootImages as image}
              <a href={image.fullsize ?? image.thumb} target="_blank" rel="noreferrer">
                <img src={image.thumb ?? image.fullsize} alt={image.alt ?? ''} loading="lazy" />
              </a>
            {/each}
          </div>
        {/if}

        <div class="metric-row">
          <span>Replies {formatCount(postData.replyCount)}</span>
          <span>Reposts {formatCount(postData.repostCount)}</span>
          <span>Quotes {formatCount(postData.quoteCount)}</span>
          <span>Likes {formatCount(postData.likeCount)}</span>
        </div>
        <p class="muted">Created {formatTimestamp(getPostTimestamp(postData))}</p>
      </section>

      <aside class="panel stats-panel" in:fly={{ y: 12, duration: 240, delay: 40 }}>
        <h2>Live Collection Stats</h2>

        <section class="stats-block">
          <h3>Quotes</h3>
          <dl class="stats-list">
            <div><dt>Collected</dt><dd>{formatCount(quotes.length)}</dd></div>
            <div><dt>First hour</dt><dd>{formatCount(quoteFirstHourCount)}</dd></div>
            <div><dt>First day</dt><dd>{formatCount(quoteFirstDayCount)}</dd></div>
            <div><dt>Avg response time</dt><dd>{formatDurationFromHours(averageQuoteResponseHours)}</dd></div>
            <div><dt>Avg quoter account age</dt><dd>{formatDurationFromDays(averageQuoteAccountAgeDays)}</dd></div>
            <div>
              <dt>Most engaged quote by</dt>
              <dd>
                {#if highestEngagementQuote}
                  <a href={toPostUrl(highestEngagementQuote)} target="_blank" rel="noreferrer" class="stats-link"
                    >@{highestEngagementQuote.author.handle} ({formatCount(getEngagement(highestEngagementQuote))})</a
                  >
                {:else}
                  <span>N/A</span>
                {/if}
              </dd>
            </div>
          </dl>
        </section>

        <section class="stats-block">
          <h3>Replies</h3>
          <dl class="stats-list">
            <div><dt>Collected</dt><dd>{formatCount(replies.length)}</dd></div>
            <div><dt>First hour</dt><dd>{formatCount(replyFirstHourCount)}</dd></div>
            <div><dt>First day</dt><dd>{formatCount(replyFirstDayCount)}</dd></div>
            <div><dt>Avg response time</dt><dd>{formatDurationFromHours(averageReplyResponseHours)}</dd></div>
            <div><dt>Avg replier account age</dt><dd>{formatDurationFromDays(averageReplyAccountAgeDays)}</dd></div>
            <div>
              <dt>Most engaged reply by</dt>
              <dd>
                {#if highestEngagementReply}
                  <a href={toPostUrl(highestEngagementReply)} target="_blank" rel="noreferrer" class="stats-link"
                    >@{highestEngagementReply.author.handle} ({formatCount(getEngagement(highestEngagementReply))})</a
                  >
                {:else}
                  <span>N/A</span>
                {/if}
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>

    <section class="panel filter-panel" in:fly={{ y: 12, duration: 240, delay: 70 }}>
      <h2>List Filters</h2>
      <div class="filter-stack">
        <label class="filter-row">
          <span>Sort by</span>
          <button
            type="button"
            class="ghost sort-direction-toggle"
            on:click={() => (sortDirection = sortDirection === 'biggest' ? 'smallest' : 'biggest')}>{sortDirection}</button
          >
          <select bind:value={sortBy}>
            <option value="engagement">Engagement</option>
            <option value="ratio">Ratio</option>
            <option value="timestamp">Timestamp</option>
            <option value="authorAge">Author age</option>
            <option value="likesPlusReposts">Likes + Reposts</option>
            <option value="repliesPlusQuotes">Replies + Quotes</option>
          </select>
        </label>

        <label class="filter-row">
          <span>Must have at least</span>
          <input
            type="number"
            min="0"
            step="1"
            bind:value={minEngagementInput}
            placeholder="(any)"
            on:input={scheduleFilterApply}
          />
          <span>engagements</span>
        </label>

        <label class="filter-row">
          <span>Account must be at least</span>
          <input
            type="number"
            min="0"
            step="1"
            bind:value={accountOlderThanDaysInput}
            placeholder="(off)"
            on:input={scheduleFilterApply}
          />
          <span>days older than the post</span>
        </label>
      </div>
      <p class="filter-note">
        Empty or 0 values disable each filter. Positive values apply the corresponding filter.
      </p>
    </section>

    <div class="list-columns" in:fade={{ duration: 220 }}>
      <section class="panel list-panel" in:fly={{ y: 14, duration: 240, delay: 100 }}>
        <div class="list-head">
          <h2>Quotes</h2>
          <p>Showing {pagedQuotes.length} of {sortedFilteredQuotes.length} collected quote posts (10 per page).</p>
        </div>

        {#if sortedFilteredQuotes.length === 0}
          <p class="muted">No quote posts match the current filter yet.</p>
        {:else}
          <nav class="pagination pagination-top" aria-label="Quotes pagination top">
            <button
              type="button"
              class="ghost"
              on:click={() => (quotePage = Math.max(1, quotePage - 1))}
              disabled={quotePage <= 1}>Previous</button
            >
            <p>Page {quotePage} / {quoteTotalPages}</p>
            <button
              type="button"
              class="ghost"
              on:click={() => (quotePage = Math.min(quoteTotalPages, quotePage + 1))}
              disabled={quotePage >= quoteTotalPages}>Next</button
            >
          </nav>

          {#each pagedQuotes as post, index (post.uri)}
            <article
              class="item-card compact-card"
              animate:flip={{ duration: 260 }}
              in:fly={{ y: 8, duration: 210, delay: index * 16 }}
              out:fade={{ duration: 140 }}
            >
              <ChildPost {post} rootPostTimestampMs={rootPostTimestampMs} rootPostTimestamp={rootPostTimestamp} />
            </article>
          {/each}

          <nav class="pagination pagination-bottom" aria-label="Quotes pagination bottom">
            <button
              type="button"
              class="ghost"
              on:click={() => (quotePage = Math.max(1, quotePage - 1))}
              disabled={quotePage <= 1}>Previous</button
            >
            <p>Page {quotePage} / {quoteTotalPages}</p>
            <button
              type="button"
              class="ghost"
              on:click={() => (quotePage = Math.min(quoteTotalPages, quotePage + 1))}
              disabled={quotePage >= quoteTotalPages}>Next</button
            >
          </nav>
        {/if}
      </section>

      <section class="panel list-panel" in:fly={{ y: 14, duration: 240, delay: 130 }}>
        <div class="list-head">
          <h2>Replies</h2>
          <p>Showing {pagedReplies.length} of {sortedFilteredReplies.length} collected replies (10 per page).</p>
        </div>

        {#if sortedFilteredReplies.length === 0}
          <p class="muted">No replies match the current filter yet.</p>
        {:else}
          <nav class="pagination pagination-top" aria-label="Replies pagination top">
            <button
              type="button"
              class="ghost"
              on:click={() => (replyPage = Math.max(1, replyPage - 1))}
              disabled={replyPage <= 1}>Previous</button
            >
            <p>Page {replyPage} / {replyTotalPages}</p>
            <button
              type="button"
              class="ghost"
              on:click={() => (replyPage = Math.min(replyTotalPages, replyPage + 1))}
              disabled={replyPage >= replyTotalPages}>Next</button
            >
          </nav>

          {#each pagedReplies as post, index (post.uri)}
            <article
              class="item-card compact-card"
              animate:flip={{ duration: 260 }}
              in:fly={{ y: 8, duration: 210, delay: index * 16 }}
              out:fade={{ duration: 140 }}
            >
              <ChildPost {post} rootPostTimestampMs={rootPostTimestampMs} rootPostTimestamp={rootPostTimestamp} />
            </article>
          {/each}

          <nav class="pagination pagination-bottom" aria-label="Replies pagination bottom">
            <button
              type="button"
              class="ghost"
              on:click={() => (replyPage = Math.max(1, replyPage - 1))}
              disabled={replyPage <= 1}>Previous</button
            >
            <p>Page {replyPage} / {replyTotalPages}</p>
            <button
              type="button"
              class="ghost"
              on:click={() => (replyPage = Math.min(replyTotalPages, replyPage + 1))}
              disabled={replyPage >= replyTotalPages}>Next</button
            >
          </nav>
        {/if}
      </section>
    </div>
  {/if}
</main>
