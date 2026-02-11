<title>Notes to AI Agent</title>

# Project Overview

Tentative name: Bluesky Postmortems

I want a one-page static web app that, given the URL to a post on the social media network Bluesky, fetches and renders the post's data and metadata, and its associated data, particularly its replies and its quote-posts. This app should provide a convenient and comprehensive view of the post, including a showcase of its best/most engaged-with quotes and replies.

# Detailed requirements and use case

When the user visits the Bluesky Postmortems webapp, they are given a prompt to paste in a URL to a Bluesky post, e.g.

    https://bsky.app/profile/bsky.app/post/3mehblstckk2e

Upon submitting the URL, the webapp should call the relevant Bluesky public APIs to fetch the post's metadata and render it similar to how it appears on the native Bluesky website client.

In the background, the webapp should be continuously polling the public API for the quotes and replies to the post (the endpoints typically limit us to 100 items), asychronously updating the collection of the quotes and replies to the post and displaying them. By default, the webapp should show the top 5 quotes and the top 5 replies in descending order of engagement (reply count + repost count + quote count). But the user should also be able to sort by timestamp (oldest, or newest), and set a filter for minimum number of engagements.

As the website is collecting the quotes and replies, it should have a continuously updating progress counter so that the user knows how many things have been collected so far.

The webapp should also provide a "Download" button, and when pressed, it should provide for download a JSON file containing the data collected so far. The structure of this JSON should be:

```json
{
    "url": "https://etc...",
    "postData": {...},
    "replyData": {...},
    "quoteData": {...}
}
```

# Technical requirements

The app should be built using the Svelte 5.0 app, and it should use TypeScript. It should use Svelte's static adapter, allowing it to be deployed on Github Pages via Github Actions

By default, use a 0.2 second delay between each API call as to not overload the public API.

# API Details

This section lists the available APIs to use, along with sample calls and responses.

## Get the user's unique identifier with `com.atproto.identity.resolveHandle`

Fetch the user's `did` by using the `identity.resolveHandle` endpoint.

API docs:
https://docs.bsky.app/docs/api/com-atproto-identity-resolve-handle

Sample API call:

```html
https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=bsky.app
```

Sample API response:

```json
{ "did": "did:plc:z72i7hdynmk6r22z27h6tvur" }
```

## Get the post's metadata with `app.bsky.feed.getPosts`

Fetch the post metadata using the `app.bsky.feed.getPosts` endpoint

API docs:
https://docs.bsky.app/docs/api/app-bsky-feed-get-posts

Sample API call:

```html
https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e
```

Sample API response:

```json
{
  "posts": [
    {
      "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e",
      "cid": "bafyreifq6u7lljh462yxkbl3aivqvw5v7gavk5lwr2mrfnnzzvbtplwwli",
      "author": {
        "did": "did:plc:z72i7hdynmk6r22z27h6tvur",
        "handle": "bsky.app",
        "displayName": "Bluesky",
        "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreihwihm6kpd6zuwhhlro75p5qks5qtrcu55jp3gddbfjsieiv7wuka@jpeg",
        "associated": {
          "chat": {
            "allowIncoming": "none"
          },
          "activitySubscription": {
            "allowSubscriptions": "followers"
          }
        },
        "labels": [],
        "createdAt": "2023-04-12T04:53:57.057Z",
        "verification": {
          "verifications": [],
          "verifiedStatus": "none",
          "trustedVerifierStatus": "valid"
        }
      },
      "record": {
        "$type": "app.bsky.feed.post",
        "createdAt": "2026-02-09T20:21:49.929Z",
        "embed": {
          "$type": "app.bsky.embed.images",
          "images": [
            {
              "alt": "A demonstration of where you can find the drafts feature in the top right corner of the post composer on Bluesky.",
              "aspectRatio": {
                "height": 640,
                "width": 1080
              },
              "image": {
                "$type": "blob",
                "ref": {
                  "$link": "bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza"
                },
                "mimeType": "image/jpeg",
                "size": 366075
              }
            }
          ]
        },
        "langs": ["en"],
        "text": "v1.116 is rolling out now!\n\nFor all the overthinkers and perfectionists out there, we're launching Drafts."
      },
      "embed": {
        "$type": "app.bsky.embed.images#view",
        "images": [
          {
            "thumb": "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza@jpeg",
            "fullsize": "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza@jpeg",
            "alt": "A demonstration of where you can find the drafts feature in the top right corner of the post composer on Bluesky.",
            "aspectRatio": {
              "height": 640,
              "width": 1080
            }
          }
        ]
      },
      "bookmarkCount": 366,
      "replyCount": 880,
      "repostCount": 3305,
      "likeCount": 15102,
      "quoteCount": 2435,
      "indexedAt": "2026-02-09T20:21:52.754Z",
      "labels": []
    }
  ]
}
```

## Get quotes of the post with `app.bsky.feed.getQuotes`

API docs:

https://docs.bsky.app/docs/api/app-bsky-feed-get-quotes

Sample API call:

```html
https://public.api.bsky.app/xrpc/app.bsky.feed.getQuotes?uri=at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e
```

Sample response:

```json
{
  "posts": [
    {
      "uri": "at://did:plc:s5br5iqnzmjvbihs2u7koyjo/app.bsky.feed.post/3mejwv5ekmk2n",
      "cid": "bafyreiadfxkna6vnqoanaegbck7pduesthqjk745psag6iuwtg3mbusf2u",
      "author": {
        "did": "did:plc:s5br5iqnzmjvbihs2u7koyjo",
        "handle": "calthalas.bsky.social",
        "displayName": "Mateusz Fafinski",
        "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:s5br5iqnzmjvbihs2u7koyjo/bafkreidcidtyk5chi5akhq7xhawshq3spluozfhnj5ieosoofslc3hrray@jpeg",
        "associated": {
          "activitySubscription": {
            "allowSubscriptions": "followers"
          }
        },
        "labels": [],
        "createdAt": "2023-07-06T20:14:08.346Z"
      },
      "record": {
        "$type": "app.bsky.feed.post",
        "createdAt": "2026-02-10T21:48:11.026Z",
        "embed": {
          "$type": "app.bsky.embed.record",
          "record": {
            "cid": "bafyreifq6u7lljh462yxkbl3aivqvw5v7gavk5lwr2mrfnnzzvbtplwwli",
            "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e"
          }
        },
        "langs": ["en"],
        "text": "Great, now we also need the peer-review option and every post by an academic will be delayed by two to three years (or just desk-rejected by the moderation team)."
      },
      "embed": {
        "$type": "app.bsky.embed.record#view",
        "record": {
          "$type": "app.bsky.embed.record#viewRecord",
          "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e",
          "cid": "bafyreifq6u7lljh462yxkbl3aivqvw5v7gavk5lwr2mrfnnzzvbtplwwli",
          "author": {
            "did": "did:plc:z72i7hdynmk6r22z27h6tvur",
            "handle": "bsky.app",
            "displayName": "Bluesky",
            "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreihwihm6kpd6zuwhhlro75p5qks5qtrcu55jp3gddbfjsieiv7wuka@jpeg",
            "associated": {
              "chat": {
                "allowIncoming": "none"
              },
              "activitySubscription": {
                "allowSubscriptions": "followers"
              }
            },
            "labels": [],
            "createdAt": "2023-04-12T04:53:57.057Z",
            "verification": {
              "verifications": [],
              "verifiedStatus": "none",
              "trustedVerifierStatus": "valid"
            }
          },
          "value": {
            "$type": "app.bsky.feed.post",
            "createdAt": "2026-02-09T20:21:49.929Z",
            "embed": {
              "$type": "app.bsky.embed.images",
              "images": [
                {
                  "alt": "A demonstration of where you can find the drafts feature in the top right corner of the post composer on Bluesky.",
                  "aspectRatio": {
                    "height": 640,
                    "width": 1080
                  },
                  "image": {
                    "$type": "blob",
                    "ref": {
                      "$link": "bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza"
                    },
                    "mimeType": "image/jpeg",
                    "size": 366075
                  }
                }
              ]
            },
            "langs": ["en"],
            "text": "v1.116 is rolling out now!\n\nFor all the overthinkers and perfectionists out there, we're launching Drafts."
          },
          "labels": [],
          "likeCount": 15108,
          "replyCount": 880,
          "repostCount": 3305,
          "quoteCount": 2436,
          "indexedAt": "2026-02-09T20:21:52.754Z",
          "embeds": [
            {
              "$type": "app.bsky.embed.images#view",
              "images": [
                {
                  "thumb": "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza@jpeg",
                  "fullsize": "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza@jpeg",
                  "alt": "A demonstration of where you can find the drafts feature in the top right corner of the post composer on Bluesky.",
                  "aspectRatio": {
                    "height": 640,
                    "width": 1080
                  }
                }
              ]
            }
          ]
        }
      },
      "bookmarkCount": 0,
      "replyCount": 0,
      "repostCount": 1,
      "likeCount": 3,
      "quoteCount": 0,
      "indexedAt": "2026-02-10T21:48:11.558Z",
      "labels": []
    },
    {
      "uri": "at://did:plc:ewscn2jetx2hufuuk5qdrttb/app.bsky.feed.post/3mejvw7p2s22i",
      "cid": "bafyreiapnp7eli7cth5likdncsj6knncqhbmjlrbq2srifuf36b3drcwku",
      "author": {
        "did": "did:plc:ewscn2jetx2hufuuk5qdrttb",
        "handle": "dav14l.bsky.social",
        "displayName": "Dav14L",
        "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:ewscn2jetx2hufuuk5qdrttb/bafkreifhwi6eikg77b5dpabogx5q37noan2redc3oyamy4gwdkz2qjhitu@jpeg",
        "associated": {
          "chat": {
            "allowIncoming": "following"
          },
          "activitySubscription": {
            "allowSubscriptions": "followers"
          }
        },
        "labels": [],
        "createdAt": "2023-12-02T16:50:35.242Z"
      },
      "record": {
        "$type": "app.bsky.feed.post",
        "createdAt": "2026-02-10T21:30:53.279Z",
        "embed": {
          "$type": "app.bsky.embed.record",
          "record": {
            "cid": "bafyreifq6u7lljh462yxkbl3aivqvw5v7gavk5lwr2mrfnnzzvbtplwwli",
            "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e"
          }
        },
        "langs": ["es"],
        "text": "Esto vendrá bien"
      },
      "embed": {
        "$type": "app.bsky.embed.record#view",
        "record": {
          "$type": "app.bsky.embed.record#viewRecord",
          "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e",
          "cid": "bafyreifq6u7lljh462yxkbl3aivqvw5v7gavk5lwr2mrfnnzzvbtplwwli",
          "author": {
            "did": "did:plc:z72i7hdynmk6r22z27h6tvur",
            "handle": "bsky.app",
            "displayName": "Bluesky",
            "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreihwihm6kpd6zuwhhlro75p5qks5qtrcu55jp3gddbfjsieiv7wuka@jpeg",
            "associated": {
              "chat": {
                "allowIncoming": "none"
              },
              "activitySubscription": {
                "allowSubscriptions": "followers"
              }
            },
            "labels": [],
            "createdAt": "2023-04-12T04:53:57.057Z",
            "verification": {
              "verifications": [],
              "verifiedStatus": "none",
              "trustedVerifierStatus": "valid"
            }
          },
          "value": {
            "$type": "app.bsky.feed.post",
            "createdAt": "2026-02-09T20:21:49.929Z",
            "embed": {
              "$type": "app.bsky.embed.images",
              "images": [
                {
                  "alt": "A demonstration of where you can find the drafts feature in the top right corner of the post composer on Bluesky.",
                  "aspectRatio": {
                    "height": 640,
                    "width": 1080
                  },
                  "image": {
                    "$type": "blob",
                    "ref": {
                      "$link": "bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza"
                    },
                    "mimeType": "image/jpeg",
                    "size": 366075
                  }
                }
              ]
            },
            "langs": ["en"],
            "text": "v1.116 is rolling out now!\n\nFor all the overthinkers and perfectionists out there, we're launching Drafts."
          },
          "labels": [],
          "likeCount": 15108,
          "replyCount": 880,
          "repostCount": 3305,
          "quoteCount": 2436,
          "indexedAt": "2026-02-09T20:21:52.754Z",
          "embeds": [
            {
              "$type": "app.bsky.embed.images#view",
              "images": [
                {
                  "thumb": "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza@jpeg",
                  "fullsize": "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza@jpeg",
                  "alt": "A demonstration of where you can find the drafts feature in the top right corner of the post composer on Bluesky.",
                  "aspectRatio": {
                    "height": 640,
                    "width": 1080
                  }
                }
              ]
            }
          ]
        }
      },
      "bookmarkCount": 0,
      "replyCount": 0,
      "repostCount": 0,
      "likeCount": 1,
      "quoteCount": 0,
      "indexedAt": "2026-02-10T21:30:54.650Z",
      "labels": []
    },
    {
      "uri": "at://did:plc:zar4pvoftibx4qqp5pcppn4b/app.bsky.feed.post/3mejvrirczs2a",
      "cid": "bafyreigm4d6zv5zoy3deoh2gbyk3irujtjo325uwkchmaiecgzglvnic74",
      "author": {
        "did": "did:plc:zar4pvoftibx4qqp5pcppn4b",
        "handle": "jonnavyblue.bsky.social",
        "displayName": "Jon",
        "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:zar4pvoftibx4qqp5pcppn4b/bafkreiex3qj7e6hg64gslxpwanm4vlcamj5inqhnybalnzoxnrf6rwgmpa@jpeg",
        "associated": {
          "chat": {
            "allowIncoming": "none"
          },
          "activitySubscription": {
            "allowSubscriptions": "none"
          }
        },
        "labels": [],
        "createdAt": "2025-01-16T21:37:53.744Z"
      },
      "record": {
        "$type": "app.bsky.feed.post",
        "createdAt": "2026-02-10T21:28:15.001Z",
        "embed": {
          "$type": "app.bsky.embed.recordWithMedia",
          "media": {
            "$type": "app.bsky.embed.images",
            "images": [
              {
                "alt": "",
                "aspectRatio": {
                  "height": 1231,
                  "width": 769
                },
                "image": {
                  "$type": "blob",
                  "ref": {
                    "$link": "bafkreiby6sa5qzgdkll43ro4nxto77ip5ve2r2otqkklzn7wuu7zc3lvvy"
                  },
                  "mimeType": "image/jpeg",
                  "size": 66378
                }
              },
              {
                "alt": "",
                "aspectRatio": {
                  "height": 1220,
                  "width": 762
                },
                "image": {
                  "$type": "blob",
                  "ref": {
                    "$link": "bafkreic27z4q3fsbqwytlodyxeaenxnddudi4jsvfy6qqromnp2gvwtzem"
                  },
                  "mimeType": "image/jpeg",
                  "size": 58727
                }
              }
            ]
          },
          "record": {
            "$type": "app.bsky.embed.record",
            "record": {
              "cid": "bafyreifq6u7lljh462yxkbl3aivqvw5v7gavk5lwr2mrfnnzzvbtplwwli",
              "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e"
            }
          }
        },
        "langs": ["en"],
        "text": "This is useful 😊👍"
      },
      "embed": {
        "$type": "app.bsky.embed.recordWithMedia#view",
        "media": {
          "$type": "app.bsky.embed.images#view",
          "images": [
            {
              "thumb": "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:zar4pvoftibx4qqp5pcppn4b/bafkreiby6sa5qzgdkll43ro4nxto77ip5ve2r2otqkklzn7wuu7zc3lvvy@jpeg",
              "fullsize": "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:zar4pvoftibx4qqp5pcppn4b/bafkreiby6sa5qzgdkll43ro4nxto77ip5ve2r2otqkklzn7wuu7zc3lvvy@jpeg",
              "alt": "",
              "aspectRatio": {
                "height": 1231,
                "width": 769
              }
            },
            {
              "thumb": "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:zar4pvoftibx4qqp5pcppn4b/bafkreic27z4q3fsbqwytlodyxeaenxnddudi4jsvfy6qqromnp2gvwtzem@jpeg",
              "fullsize": "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:zar4pvoftibx4qqp5pcppn4b/bafkreic27z4q3fsbqwytlodyxeaenxnddudi4jsvfy6qqromnp2gvwtzem@jpeg",
              "alt": "",
              "aspectRatio": {
                "height": 1220,
                "width": 762
              }
            }
          ]
        },
        "record": {
          "record": {
            "$type": "app.bsky.embed.record#viewRecord",
            "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e",
            "cid": "bafyreifq6u7lljh462yxkbl3aivqvw5v7gavk5lwr2mrfnnzzvbtplwwli",
            "author": {
              "did": "did:plc:z72i7hdynmk6r22z27h6tvur",
              "handle": "bsky.app",
              "displayName": "Bluesky",
              "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreihwihm6kpd6zuwhhlro75p5qks5qtrcu55jp3gddbfjsieiv7wuka@jpeg",
              "associated": {
                "chat": {
                  "allowIncoming": "none"
                },
                "activitySubscription": {
                  "allowSubscriptions": "followers"
                }
              },
              "labels": [],
              "createdAt": "2023-04-12T04:53:57.057Z",
              "verification": {
                "verifications": [],
                "verifiedStatus": "none",
                "trustedVerifierStatus": "valid"
              }
            },
            "value": {
              "$type": "app.bsky.feed.post",
              "createdAt": "2026-02-09T20:21:49.929Z",
              "embed": {
                "$type": "app.bsky.embed.images",
                "images": [
                  {
                    "alt": "A demonstration of where you can find the drafts feature in the top right corner of the post composer on Bluesky.",
                    "aspectRatio": {
                      "height": 640,
                      "width": 1080
                    },
                    "image": {
                      "$type": "blob",
                      "ref": {
                        "$link": "bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza"
                      },
                      "mimeType": "image/jpeg",
                      "size": 366075
                    }
                  }
                ]
              },
              "langs": ["en"],
              "text": "v1.116 is rolling out now!\n\nFor all the overthinkers and perfectionists out there, we're launching Drafts."
            },
            "labels": [],
            "likeCount": 15108,
            "replyCount": 880,
            "repostCount": 3305,
            "quoteCount": 2436,
            "indexedAt": "2026-02-09T20:21:52.754Z",
            "embeds": [
              {
                "$type": "app.bsky.embed.images#view",
                "images": [
                  {
                    "thumb": "https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza@jpeg",
                    "fullsize": "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreig25lv2oqbjffi3kmrcwt4qlphl42be75s2o5lcqncvz6qsgt5fza@jpeg",
                    "alt": "A demonstration of where you can find the drafts feature in the top right corner of the post composer on Bluesky.",
                    "aspectRatio": {
                      "height": 640,
                      "width": 1080
                    }
                  }
                ]
              }
            ]
          }
        }
      },
      "bookmarkCount": 1,
      "replyCount": 0,
      "repostCount": 0,
      "likeCount": 1,
      "quoteCount": 0,
      "indexedAt": "2026-02-10T21:28:17.352Z",
      "labels": []
    }
  ],
  "cursor": "2026-02-10T21:28:15.001Z",
  "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e"
}
```

## Get replies with `api.bsky.feed.getPostThread`

API docs:
https://docs.bsky.app/docs/api/app-bsky-feed-get-post-thread

Sample API call:

```html
https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e
```

Sample response: [tests/samples/getPostThread.response.json](tests/samples/getPostThread.response.json)

## (not used right now) Get who reposted with `app.bsky.feed.getRepostedBy`

API docs:
https://docs.bsky.app/docs/api/app-bsky-feed-get-reposted-by

Sample API call:

```html
https://public.api.bsky.app/xrpc/app.bsky.feed.getRepostedBy?uri=at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e
```

Sample response:

```json
{
  "repostedBy": [
    {
      "did": "did:plc:zzxbqqvtorcbydmiye63cubz",
      "handle": "nongrencute.bsky.social",
      "displayName": "butsnew🐼🐱‧₊˚ ♡",
      "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:zzxbqqvtorcbydmiye63cubz/bafkreie32bm3ddcnyerkng3lveqoufgxcpzv45r7wvh2fhvkci5o2xqgj4@jpeg",
      "associated": {
        "chat": {
          "allowIncoming": "all"
        },
        "activitySubscription": {
          "allowSubscriptions": "followers"
        }
      },
      "labels": [],
      "createdAt": "2023-10-08T03:07:56.153Z",
      "description": "บัทส์นิว 20^ 猫まんじゅう ଘ(੭ˊᵕˋ)੭* ੈ✩‧₊˚ ♡ multifandom ニュー🦈🩷 KissCross💜💛\nPLAVE💙💜🩷❤️🖤 💜💙 *นุยำรวมทุกแอค\nตามนิยาย มังงะ มันฮวา อนิเมะ เกม วีทูป",
      "indexedAt": "2026-02-04T15:51:52.546Z"
    },
    {
      "did": "did:plc:zzsy5wrxm5em6o56zltrifif",
      "handle": "piyoiiio.bsky.social",
      "displayName": "ななな",
      "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:zzsy5wrxm5em6o56zltrifif/bafkreigrwam255wpfh3tltxqhoobyy5x3zz6i3zbheb7caauldh3rss6ye@jpeg",
      "associated": {
        "chat": {
          "allowIncoming": "following"
        },
        "activitySubscription": {
          "allowSubscriptions": "followers"
        }
      },
      "labels": [],
      "createdAt": "2024-02-07T09:16:53.375Z",
      "description": "v用 → https://bsky.app/profile/mochimentai5.bsky.social",
      "indexedAt": "2026-01-13T17:52:50.124Z"
    }
  ],
  "cursor": "did:plc:zzsy5wrxm5em6o56zltrifif",
  "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mehblstckk2e"
}
```
