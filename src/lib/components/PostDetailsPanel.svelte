<script lang="ts">
  import { formatCount, formatTimestamp } from '$lib/formatting';
  import { getPostTimestamp, type FeedPost, type PostImage } from '$lib/bluesky';
  import { getPostText } from '$lib/child-post-presenter';

  export let post: FeedPost;
  export let images: PostImage[] = [];
</script>

<section class="panel post-panel">
  <div class="post-meta-summary">
    <div class="metric-row">
      <span><strong>{formatCount(post.replyCount)}</strong> replies</span>
      <span><strong>{formatCount(post.repostCount)}</strong> reposts</span>
      <span><strong>{formatCount(post.quoteCount)}</strong> quotes</span>
      <span><strong>{formatCount(post.likeCount)}</strong> likes</span>
    </div>
    <p class="muted">Created {formatTimestamp(getPostTimestamp(post))}</p>
    <div class="post-meta-lines">
      <p><strong>URI:</strong> <code>{post.uri}</code></p>
      <p><strong>Author DID:</strong> <code>{post.author.did}</code></p>
    </div>
  </div>

  <article class="post-repro">
    <div class="post-head">
      {#if post.author.avatar}
        <img src={post.author.avatar} alt={post.author.handle} class="avatar" />
      {/if}
      <div>
        <h2>{post.author.displayName ?? post.author.handle}</h2>
        <p>@{post.author.handle}</p>
      </div>
    </div>

    <p class="body-text">{getPostText(post)}</p>

    {#if images.length > 0}
      <div class="image-grid post-media-strip">
        {#each images as image}
          <a href={image.fullsize ?? image.thumb} target="_blank" rel="noreferrer">
            <img src={image.thumb ?? image.fullsize} alt={image.alt ?? ''} loading="lazy" />
          </a>
        {/each}
      </div>
    {/if}
  </article>
</section>
