<script lang="ts">
  import { formatCount, formatDurationFromDays, formatDurationFromHours } from '$lib/formatting';
  import { getEngagement, toPostUrl, type FeedPost } from '$lib/bluesky';

  export let quoteCount = 0;
  export let quoteFirstHourCount = 0;
  export let quoteFirstDayCount = 0;
  export let averageQuoteResponseHours: number | null = null;
  export let averageQuoteAccountAgeDays: number | null = null;
  export let highestEngagementQuote: FeedPost | null = null;

  export let replyCount = 0;
  export let replyFirstHourCount = 0;
  export let replyFirstDayCount = 0;
  export let averageReplyResponseHours: number | null = null;
  export let averageReplyAccountAgeDays: number | null = null;
  export let highestEngagementReply: FeedPost | null = null;
</script>

<aside class="panel stats-panel">
  <h2>Live Collection Stats</h2>

  <section class="stats-block">
    <h3>Quotes</h3>
    <dl class="stats-list">
      <div class="stats-row"><dt>Collected</dt><dd>{formatCount(quoteCount)}</dd></div>
      <div class="stats-row"><dt>First hour</dt><dd>{formatCount(quoteFirstHourCount)}</dd></div>
      <div class="stats-row"><dt>First day</dt><dd>{formatCount(quoteFirstDayCount)}</dd></div>
      <div class="stats-row"><dt>Avg response time</dt><dd>{formatDurationFromHours(averageQuoteResponseHours)}</dd></div>
      <div class="stats-row"><dt>Avg quoter account age</dt><dd>{formatDurationFromDays(averageQuoteAccountAgeDays)}</dd></div>
      <div class="stats-row stats-row-link">
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
      <div class="stats-row"><dt>Collected</dt><dd>{formatCount(replyCount)}</dd></div>
      <div class="stats-row"><dt>First hour</dt><dd>{formatCount(replyFirstHourCount)}</dd></div>
      <div class="stats-row"><dt>First day</dt><dd>{formatCount(replyFirstDayCount)}</dd></div>
      <div class="stats-row"><dt>Avg response time</dt><dd>{formatDurationFromHours(averageReplyResponseHours)}</dd></div>
      <div class="stats-row"><dt>Avg replier account age</dt><dd>{formatDurationFromDays(averageReplyAccountAgeDays)}</dd></div>
      <div class="stats-row stats-row-link">
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
