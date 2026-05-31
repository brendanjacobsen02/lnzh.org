# Instagram Backend

This repo is a static site, so Instagram content must be fetched through a backend endpoint. The backend in `workers/instagram-feed.js` is a Cloudflare Worker that returns JSON only. It does not add any visible website element.

## What This Supports

- `GET /media` returns recent posts, reels, videos, and carousel items for the authorized Instagram account.
- `GET /stories` returns active stories for the authorized account when the account and token have the required access.
- `GET /all` returns both payloads and reports partial errors if one edge is unavailable.
- `GET /asset/:id` proxies the raw image or video bytes for a media ID that the authorized token can access.
- The JSON response includes both Instagram's direct `media_url` and a local `asset_url`, so the frontend can later render media through this backend without using an Instagram embed.

## What It Does Not Do

This does not scrape Instagram pages or bypass login/API restrictions. Meta can block scraping, stories are time-limited, and direct media URLs can expire. Use the official API token for your own account.

## Required Instagram Setup

Use a Meta Developer app with Instagram API access for the Instagram account you own or administer. In practice, the account usually needs to be a professional Creator or Business account. For stories, the token must have access to the stories edge; if that permission is unavailable, `/stories` will return a JSON error while `/media` can still work.

You need:

- `INSTAGRAM_USER_ID`: the Instagram professional account ID.
- `INSTAGRAM_ACCESS_TOKEN`: a long-lived access token authorized for that account.

Useful Meta docs:

- Instagram Platform overview: https://developers.facebook.com/docs/instagram-platform/
- Instagram API with Instagram Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
- Instagram Graph API with Facebook Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/
- IG User media edge: https://developers.facebook.com/docs/instagram-platform/reference/instagram-user/media/
- IG User stories edge: https://developers.facebook.com/docs/instagram-platform/reference/instagram-user/stories/

## Local Worker Setup

Copy the example config if you deploy with Wrangler:

```sh
cp wrangler.instagram.example.toml wrangler.toml
```

Create local secrets in `.dev.vars` for local testing:

```sh
INSTAGRAM_USER_ID=your_instagram_user_id
INSTAGRAM_ACCESS_TOKEN=your_long_lived_access_token
```

Run locally:

```sh
npx wrangler dev --config wrangler.toml
```

Check endpoints:

```sh
curl http://127.0.0.1:8787/media
curl http://127.0.0.1:8787/stories
curl http://127.0.0.1:8787/all
curl http://127.0.0.1:8787/asset/<media_id> --output instagram-media.bin
```

## Deployment

Set production secrets:

```sh
npx wrangler secret put INSTAGRAM_USER_ID --config wrangler.toml
npx wrangler secret put INSTAGRAM_ACCESS_TOKEN --config wrangler.toml
npx wrangler deploy --config wrangler.toml
```

If the Worker is hosted on a subdomain, later frontend code can fetch:

```js
fetch("https://your-worker.example.workers.dev/media")
```

Keep `CORS_ORIGIN` set to `https://lnzh.org` unless you intentionally need another origin.
