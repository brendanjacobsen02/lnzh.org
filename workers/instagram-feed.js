const DEFAULT_GRAPH_VERSION = "v25.0";
const DEFAULT_MEDIA_LIMIT = 12;
const DEFAULT_STORIES_LIMIT = 8;
const DEFAULT_CACHE_TTL_SECONDS = 900;

const MEDIA_FIELDS = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "permalink",
    "thumbnail_url",
    "timestamp",
    "username",
    "children{media_type,media_url,thumbnail_url,permalink}"
].join(",");

const STORY_FIELDS = [
    "id",
    "media_type",
    "media_url",
    "permalink",
    "thumbnail_url",
    "timestamp",
    "username"
].join(",");

const ASSET_FIELDS = [
    "id",
    "media_type",
    "media_url",
    "thumbnail_url"
].join(",");

export default {
    async fetch(request, env, ctx) {
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(env) });
        }

        if (request.method !== "GET") {
            return jsonResponse({ error: "method_not_allowed" }, 405, env);
        }

        const url = new URL(request.url);

        try {
            if (url.pathname === "/" || url.pathname === "/health") {
                return jsonResponse({ ok: true, service: "instagram-feed" }, 200, env);
            }

            if (url.pathname === "/media") {
                return cachedJson(request, env, ctx, () => fetchMedia(env, url));
            }

            if (url.pathname === "/stories") {
                return cachedJson(request, env, ctx, () => fetchStories(env, url));
            }

            if (url.pathname === "/all") {
                return cachedJson(request, env, ctx, () => fetchAll(env, url));
            }

            if (url.pathname.startsWith("/asset/")) {
                return cachedAsset(request, env, ctx, url);
            }

            return jsonResponse({ error: "not_found" }, 404, env);
        } catch (error) {
            return jsonResponse({
                error: "instagram_backend_error",
                message: error.message
            }, error.status || 500, env);
        }
    }
};

async function fetchAll(env, requestUrl) {
    const [media, stories] = await Promise.allSettled([
        fetchMedia(env, requestUrl),
        fetchStories(env, requestUrl)
    ]);

    return {
        fetched_at: new Date().toISOString(),
        media: resultValue(media),
        stories: resultValue(stories),
        errors: [resultError("media", media), resultError("stories", stories)].filter(Boolean)
    };
}

async function fetchMedia(env, requestUrl) {
    const limit = readLimit(requestUrl, "limit", env.INSTAGRAM_MEDIA_LIMIT, DEFAULT_MEDIA_LIMIT);
    return fetchInstagramEdge(env, "media", MEDIA_FIELDS, limit);
}

async function fetchStories(env, requestUrl) {
    const limit = readLimit(requestUrl, "limit", env.INSTAGRAM_STORIES_LIMIT, DEFAULT_STORIES_LIMIT);
    return fetchInstagramEdge(env, "stories", STORY_FIELDS, limit);
}

async function fetchInstagramEdge(env, edge, fields, limit) {
    const accessToken = requireEnv(env, "INSTAGRAM_ACCESS_TOKEN");
    const userId = requireEnv(env, "INSTAGRAM_USER_ID");
    const graphVersion = env.GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION;
    const endpoint = new URL(`https://graph.facebook.com/${graphVersion}/${userId}/${edge}`);

    endpoint.searchParams.set("fields", fields);
    endpoint.searchParams.set("limit", String(limit));
    endpoint.searchParams.set("access_token", accessToken);

    const response = await fetch(endpoint, {
        headers: { "Accept": "application/json" }
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = payload?.error?.message || `Instagram ${edge} request failed`;
        const error = new Error(message);
        error.status = response.status;
        error.details = payload?.error;
        throw error;
    }

    return {
        fetched_at: new Date().toISOString(),
        source: "instagram_graph_api",
        edge,
        data: Array.isArray(payload.data) ? payload.data.map(normalizeMedia) : [],
        paging: payload.paging || null
    };
}

async function cachedJson(request, env, ctx, load) {
    const cacheTtl = Number(env.CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS);
    const cache = caches.default;
    const cacheKey = new Request(request.url, request);

    if (cacheTtl > 0) {
        const cached = await cache.match(cacheKey);
        if (cached) {
            return withCors(cached, env);
        }
    }

    const payload = await load();
    const response = jsonResponse(payload, 200, env, {
        "Cache-Control": `public, max-age=${cacheTtl}`
    });

    if (cacheTtl > 0) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
}

function normalizeMedia(item) {
    const assetUrl = item.media_url ? `/asset/${encodeURIComponent(item.id)}` : null;
    const normalized = {
        id: item.id,
        media_type: item.media_type,
        media_url: item.media_url || null,
        asset_url: assetUrl,
        thumbnail_url: item.thumbnail_url || null,
        permalink: item.permalink || null,
        timestamp: item.timestamp || null,
        username: item.username || null
    };

    if (item.caption) {
        normalized.caption = item.caption;
    }

    if (item.children?.data) {
        normalized.children = item.children.data.map((child) => ({
            id: child.id,
            media_type: child.media_type,
            media_url: child.media_url || null,
            asset_url: child.media_url ? `/asset/${encodeURIComponent(child.id)}` : null,
            thumbnail_url: child.thumbnail_url || null,
            permalink: child.permalink || null
        }));
    }

    return normalized;
}

async function cachedAsset(request, env, ctx, url) {
    const cacheTtl = Number(env.CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS);
    const cache = caches.default;
    const cacheKey = new Request(request.url, request);

    if (cacheTtl > 0) {
        const cached = await cache.match(cacheKey);
        if (cached) {
            return withCors(cached, env);
        }
    }

    const mediaId = decodeURIComponent(url.pathname.replace(/^\/asset\//, ""));
    const asset = await fetchInstagramAsset(env, mediaId);
    const response = withCors(asset, env);

    if (cacheTtl > 0 && response.ok) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
}

async function fetchInstagramAsset(env, mediaId) {
    if (!/^[A-Za-z0-9_:-]+$/.test(mediaId)) {
        return jsonResponse({ error: "invalid_media_id" }, 400, env);
    }

    const accessToken = requireEnv(env, "INSTAGRAM_ACCESS_TOKEN");
    const graphVersion = env.GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION;
    const endpoint = new URL(`https://graph.facebook.com/${graphVersion}/${mediaId}`);

    endpoint.searchParams.set("fields", ASSET_FIELDS);
    endpoint.searchParams.set("access_token", accessToken);

    const metadataResponse = await fetch(endpoint, {
        headers: { "Accept": "application/json" }
    });
    const metadata = await metadataResponse.json().catch(() => ({}));

    if (!metadataResponse.ok || !metadata.media_url) {
        return jsonResponse({
            error: "instagram_asset_unavailable",
            message: metadata?.error?.message || "Media URL is not available"
        }, metadataResponse.status || 404, env);
    }

    const mediaResponse = await fetch(metadata.media_url, {
        headers: { "Accept": "*/*" }
    });

    if (!mediaResponse.ok) {
        return jsonResponse({
            error: "instagram_asset_fetch_failed",
            status: mediaResponse.status
        }, mediaResponse.status, env);
    }

    const headers = new Headers(mediaResponse.headers);
    headers.set("Cache-Control", `public, max-age=${Number(env.CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS)}`);
    headers.set("X-Instagram-Media-Id", mediaId);
    headers.set("X-Instagram-Media-Type", metadata.media_type || "unknown");

    return new Response(mediaResponse.body, {
        status: mediaResponse.status,
        statusText: mediaResponse.statusText,
        headers
    });
}

function readLimit(url, paramName, envValue, fallback) {
    const raw = url.searchParams.get(paramName) || envValue || fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(1, Math.min(Math.floor(value), 50));
}

function requireEnv(env, key) {
    if (!env[key]) {
        const error = new Error(`Missing required environment variable: ${key}`);
        error.status = 500;
        throw error;
    }
    return env[key];
}

function resultValue(result) {
    return result.status === "fulfilled" ? result.value : null;
}

function resultError(name, result) {
    if (result.status === "fulfilled") {
        return null;
    }
    return {
        edge: name,
        message: result.reason?.message || "request_failed",
        status: result.reason?.status || 500
    };
}

function jsonResponse(payload, status, env, headers = {}) {
    return new Response(JSON.stringify(payload, null, 2), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(env),
            ...headers
        }
    });
}

function corsHeaders(env) {
    return {
        "Access-Control-Allow-Origin": env.CORS_ORIGIN || "https://lnzh.org",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}

function withCors(response, env) {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(env))) {
        headers.set(key, value);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}
