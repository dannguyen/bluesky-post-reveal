<script lang="ts">
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
  import ChildPost from "$lib/components/ChildPost.svelte";
  import { PAGE_SIZE, clampPage, pageItems, totalPages } from "$lib/post-analysis";
  import type { FeedPost } from "$lib/bluesky";

  export let title: string;
  export let description: string;
  export let emptyMessage: string;
  export let posts: FeedPost[] = [];
  export let page = 1;
  export let rootPostTimestampMs: number;
  export let rootPostTimestamp: string | undefined;
  export let panelDelayMs = 0;

  $: pages = totalPages(posts, PAGE_SIZE);
  $: page = clampPage(page, pages);
  $: visiblePosts = pageItems(posts, page, PAGE_SIZE);

  function previousPage(): void {
    page = Math.max(1, page - 1);
  }

  function nextPage(): void {
    page = Math.min(pages, page + 1);
  }
</script>

<section class="panel list-panel" in:fly={{ y: 14, duration: 240, delay: panelDelayMs }}>
  <div class="list-head">
    <h2>{title}</h2>
    <p>Showing {visiblePosts.length} of {posts.length} collected {description} ({PAGE_SIZE} per page).</p>
  </div>

  {#if posts.length === 0}
    <p class="muted">{emptyMessage}</p>
  {:else}
    <nav class="pagination pagination-top" aria-label={`${title} pagination top`}>
      <button type="button" class="ghost" on:click={previousPage} disabled={page <= 1}>Previous</button>
      <p>Page {page} / {pages}</p>
      <button type="button" class="ghost" on:click={nextPage} disabled={page >= pages}>Next</button>
    </nav>

    {#each visiblePosts as post, index (post.uri)}
      <article
        class="item-card compact-card"
        animate:flip={{ duration: 260 }}
        in:fly={{ y: 8, duration: 210, delay: index * 16 }}
        out:fade={{ duration: 140 }}
      >
        <ChildPost {post} {rootPostTimestampMs} {rootPostTimestamp} />
      </article>
    {/each}

    <nav class="pagination pagination-bottom" aria-label={`${title} pagination bottom`}>
      <button type="button" class="ghost" on:click={previousPage} disabled={page <= 1}>Previous</button>
      <p>Page {page} / {pages}</p>
      <button type="button" class="ghost" on:click={nextPage} disabled={page >= pages}>Next</button>
    </nav>
  {/if}
</section>
