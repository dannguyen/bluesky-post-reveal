<script lang="ts">
  import { formatCount, formatDurationFromDays, formatDurationFromHours } from '$lib/formatting';
  import { getEngagement, toPostUrl } from '$lib/bluesky';
  import type { CollectionStats } from '$lib/post-analysis';

  export let quoteStats: CollectionStats;
  export let replyStats: CollectionStats;

  const sections = [
    { label: 'Quotes', responderLabel: 'quoter' },
    { label: 'Replies', responderLabel: 'replier' },
  ] as const;

  $: statsBySection = [quoteStats, replyStats];
</script>

<aside class="panel stats-panel">
  <h2>Live Collection Stats</h2>

  {#each sections as section, i}
    {@const stats = statsBySection[i]}
    <section class="stats-block">
      <h3>{section.label}</h3>
      <dl class="stats-list">
        <div class="stats-row"><dt>Collected</dt><dd>{formatCount(stats.count)}</dd></div>
        <div class="stats-row"><dt>First hour</dt><dd>{formatCount(stats.firstHourCount)}</dd></div>
        <div class="stats-row"><dt>First day</dt><dd>{formatCount(stats.firstDayCount)}</dd></div>
        <div class="stats-row"><dt>Avg response time</dt><dd>{formatDurationFromHours(stats.avgResponseHours)}</dd></div>
        <div class="stats-row"><dt>Avg {section.responderLabel} account age</dt><dd>{formatDurationFromDays(stats.avgAccountAgeDays)}</dd></div>
        <div class="stats-row stats-row-link">
          <dt>Most engaged {section.label.toLowerCase().slice(0, -1)} by</dt>
          <dd>
            {#if stats.highestEngagement}
              <a href={toPostUrl(stats.highestEngagement)} target="_blank" rel="noreferrer" class="stats-link"
                >@{stats.highestEngagement.author.handle} ({formatCount(getEngagement(stats.highestEngagement))})</a
              >
            {:else}
              <span>N/A</span>
            {/if}
          </dd>
        </div>
      </dl>
    </section>
  {/each}
</aside>
