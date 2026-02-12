<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SortDirection, SortField } from '$lib/bluesky';

  const dispatch = createEventDispatcher<{ filterinput: void }>();

  export let sortBy: SortField = 'engagement';
  export let sortDirection: SortDirection = 'biggest';
  export let minEngagementInput: number | '' = '';
  export let accountOlderThanDaysInput: number | '' = '';
  export let hasMediaOnlyInput = false;

  function notifyFilterInput(): void {
    dispatch('filterinput');
  }

  function toggleSortDirection(): void {
    sortDirection = sortDirection === 'biggest' ? 'smallest' : 'biggest';
  }
</script>

<section class="panel filter-panel">
  <h2>List Filters</h2>
  <div class="filter-stack">
    <label class="filter-row">
      <span>Sort by</span>
      <button type="button" class="ghost sort-direction-toggle" on:click={toggleSortDirection}>{sortDirection}</button>
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
        on:input={notifyFilterInput}
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
        on:input={notifyFilterInput}
      />
      <span>days older than the post</span>
    </label>

    <label class="filter-row checkbox-row">
      <input type="checkbox" bind:checked={hasMediaOnlyInput} on:change={notifyFilterInput} />
      <span>Post has images/video</span>
    </label>
  </div>
  <p class="filter-note">Empty or 0 values disable numeric filters. Enable "Post has images/video" to require media.</p>
</section>
