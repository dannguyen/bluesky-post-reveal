export interface Author {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  createdAt?: string;
}

export interface PostRecord {
  createdAt?: string;
  text?: string;
  reply?: {
    root?: { uri?: string };
    parent?: { uri?: string };
  };
}

export interface FeedPost {
  uri: string;
  cid?: string;
  author: Author;
  record?: PostRecord;
  embed?: EmbedView;
  embeds?: EmbedView[];
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
  likeCount?: number;
  indexedAt?: string;
}

export interface ResolveHandleResponse {
  did: string;
}

export interface GetPostsResponse {
  posts: FeedPost[];
}

export interface GetQuotesResponse {
  posts?: FeedPost[];
  cursor?: string;
}

export interface ThreadView {
  post?: FeedPost;
  replies?: ThreadView[];
}

export interface GetPostThreadResponse {
  thread?: ThreadView;
}

export interface ParsedPostUrl {
  sourceUrl: string;
  handle: string;
  rkey: string;
}

export interface PostImage {
  thumb?: string;
  fullsize?: string;
  alt?: string;
}

/** Structural type covering the embed view shapes we traverse for image/video extraction. */
export interface EmbedView {
  $type?: string;
  images?: PostImage[];
  media?: EmbedView;
  record?: EmbedRecord;
  embeds?: EmbedView[];
  playlist?: string;
}

export interface EmbedRecord {
  embeds?: EmbedView[];
  media?: EmbedView;
}
