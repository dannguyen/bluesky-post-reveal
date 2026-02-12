import { get, writable, type Readable } from "svelte/store";
import {
  CALL_DELAY_MS,
  buildAtUri,
  extractReplies,
  fetchPost,
  fetchQuotes,
  fetchThread,
  parsePostUrl,
  resolveDid,
  sleep,
  type FeedPost,
  type GetPostThreadResponse,
  type GetQuotesResponse,
  type ParsedPostUrl,
} from "$lib/bluesky";
import { mergePostsByUri } from "$lib/post-analysis";

export interface CollectorState {
  normalizedUrl: string;
  atUri: string;
  postData: FeedPost | null;
  quotes: FeedPost[];
  replies: FeedPost[];
  isBootstrapping: boolean;
  isPolling: boolean;
  pollStatus: string;
  errorMessage: string;
  hasReachedFinalQuoteCursor: boolean;
  isUserPaused: boolean;
}

export const INITIAL_COLLECTOR_STATE: CollectorState = {
  normalizedUrl: "",
  atUri: "",
  postData: null,
  quotes: [],
  replies: [],
  isBootstrapping: false,
  isPolling: false,
  pollStatus: "Idle",
  errorMessage: "",
  hasReachedFinalQuoteCursor: false,
  isUserPaused: false,
};

interface CollectorDependencies {
  callDelayMs: number;
  parsePostUrl: (inputUrl: string) => ParsedPostUrl;
  resolveDid: (handle: string) => Promise<string>;
  buildAtUri: (did: string, rkey: string) => string;
  fetchPost: (atUri: string) => Promise<FeedPost>;
  fetchQuotes: (atUri: string, cursor?: string) => Promise<GetQuotesResponse>;
  fetchThread: (atUri: string) => Promise<GetPostThreadResponse>;
  extractReplies: (
    threadResponse: GetPostThreadResponse,
    rootUri: string,
  ) => FeedPost[];
  sleep: (ms: number) => Promise<void>;
}

const DEFAULT_DEPENDENCIES: CollectorDependencies = {
  callDelayMs: CALL_DELAY_MS,
  parsePostUrl,
  resolveDid,
  buildAtUri,
  fetchPost,
  fetchQuotes,
  fetchThread,
  extractReplies,
  sleep,
};

export interface PostCollector {
  state: Readable<CollectorState>;
  fetchFromUrl: (inputUrl: string) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  downloadSnapshot: (inputUrl: string) => void;
  destroy: () => void;
}

export function createPostCollector(
  dependencyOverrides: Partial<CollectorDependencies> = {},
): PostCollector {
  const dependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...dependencyOverrides,
  };

  const state = writable<CollectorState>({ ...INITIAL_COLLECTOR_STATE });

  let runToken = 0;
  let quoteCursor: string | undefined;
  let hasFetchedRepliesOnce = false;

  function patch(partial: Partial<CollectorState>): void {
    state.update((current) => ({ ...current, ...partial }));
  }

  function resetCollection(): void {
    quoteCursor = undefined;
    hasFetchedRepliesOnce = false;
    patch({
      ...INITIAL_COLLECTOR_STATE,
    });
  }

  function stopPolling(status = "Paused"): void {
    runToken += 1;
    patch({
      isPolling: false,
      isBootstrapping: false,
      pollStatus: status,
      isUserPaused: status === "Paused",
    });
  }

  async function fetchFromUrl(inputUrl: string): Promise<void> {
    const token = runToken + 1;
    runToken = token;

    resetCollection();
    patch({
      isBootstrapping: true,
      errorMessage: "",
      isUserPaused: false,
    });

    try {
      patch({ pollStatus: "Parsing URL..." });
      const parsed = dependencies.parsePostUrl(inputUrl);

      patch({
        normalizedUrl: parsed.sourceUrl,
        pollStatus: `Resolving handle ${parsed.handle}...`,
      });
      const did = await dependencies.resolveDid(parsed.handle);
      if (token !== runToken) {
        return;
      }

      const atUri = dependencies.buildAtUri(did, parsed.rkey);
      patch({
        atUri,
        pollStatus: "Fetching post metadata...",
      });

      const postData = await dependencies.fetchPost(atUri);
      if (token !== runToken) {
        return;
      }

      patch({
        postData,
        isBootstrapping: false,
        isPolling: true,
        pollStatus: "Starting collection loop...",
      });

      void startPolling(token, atUri);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown setup error";
      patch({
        errorMessage: message,
        isBootstrapping: false,
        isPolling: false,
        pollStatus: "Failed",
      });
    }
  }

  async function resume(): Promise<void> {
    const current = get(state);
    if (!current.atUri || !current.postData || current.isPolling) {
      return;
    }

    if (current.hasReachedFinalQuoteCursor) {
      patch({
        pollStatus: `Quote pagination already complete: ${current.quotes.length} quotes and ${current.replies.length} replies collected.`,
      });
      return;
    }

    const token = runToken + 1;
    runToken = token;

    patch({
      errorMessage: "",
      isPolling: true,
      isUserPaused: false,
      pollStatus: "Resuming collection...",
    });

    void startPolling(token, current.atUri);
  }

  async function startPolling(token: number, rootAtUri: string): Promise<void> {
    let localQuoteCursor = quoteCursor;
    let reachedFinalCursor = get(state).hasReachedFinalQuoteCursor;

    while (token === runToken && !reachedFinalCursor) {
      try {
        patch({ pollStatus: "Polling quote posts..." });
        const quoteResponse = await dependencies.fetchQuotes(
          rootAtUri,
          localQuoteCursor,
        );
        if (token !== runToken) {
          return;
        }

        state.update((current) => ({
          ...current,
          quotes: mergePostsByUri(current.quotes, quoteResponse.posts ?? []),
        }));

        localQuoteCursor = quoteResponse.cursor;
        quoteCursor = quoteResponse.cursor;
        reachedFinalCursor = !quoteResponse.cursor;
        if (reachedFinalCursor) {
          patch({ hasReachedFinalQuoteCursor: true });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown quote polling error";
        patch({ errorMessage: `Quote polling error: ${message}` });
      }

      if (token !== runToken) {
        return;
      }

      await dependencies.sleep(dependencies.callDelayMs);
      if (token !== runToken) {
        return;
      }

      if (!hasFetchedRepliesOnce) {
        try {
          patch({
            pollStatus:
              "Fetching one-time replies snapshot from post thread...",
          });
          const threadResponse = await dependencies.fetchThread(rootAtUri);
          if (token !== runToken) {
            return;
          }

          const extracted = dependencies.extractReplies(
            threadResponse,
            rootAtUri,
          );
          state.update((current) => ({
            ...current,
            replies: mergePostsByUri(current.replies, extracted),
          }));
          hasFetchedRepliesOnce = true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown reply polling error";
          patch({ errorMessage: `Reply polling error: ${message}` });
        }
      }

      if (token !== runToken) {
        return;
      }

      if (reachedFinalCursor) {
        break;
      }

      const current = get(state);
      patch({
        pollStatus: `Collected ${current.quotes.length} quotes and ${current.replies.length} replies.`,
      });
      await dependencies.sleep(dependencies.callDelayMs);
    }

    if (token === runToken && reachedFinalCursor) {
      const current = get(state);
      patch({
        isPolling: false,
        isUserPaused: false,
        pollStatus: `Quote pagination complete: ${current.quotes.length} quotes and ${current.replies.length} replies collected.`,
      });
    }
  }

  function downloadSnapshot(inputUrl: string): void {
    const current = get(state);
    const payload = {
      url: current.normalizedUrl || inputUrl,
      postData: current.postData,
      replyData: current.replies,
      quoteData: current.quotes,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `bluesky-postmortems-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  return {
    state,
    fetchFromUrl,
    pause: () => stopPolling(),
    resume,
    downloadSnapshot,
    destroy: () => {
      runToken += 1;
    },
  };
}
