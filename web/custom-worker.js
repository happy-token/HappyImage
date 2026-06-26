// Custom Cloudflare Worker entry that wraps the OpenNext worker.
// Intercepts /seed-gallery/* requests and serves them from R2 storage,
// delegates everything else to the Next.js OpenNext handler.

// Re-export Durable Object classes so existing bindings stay intact.
export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js";

import openNextDefault from "./.open-next/worker.js";

const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

/**
 * Fetch a file from R2 and return it as an HTTP response.
 */
async function serveFromR2(key, env) {
  const object = await env.SEED_GALLERY.get(key, {
    onlyIf: (head) => {
      // Skip conditional check — always serve the stored version
      return true;
    },
  });

  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  headers.set("content-type", MIME_MAP[ext] || "application/octet-stream");

  // Immutable cache: images & static data never change once published
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");

  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Proxy seed-gallery static files from R2
    if (url.pathname.startsWith("/seed-gallery/")) {
      const key = url.pathname.slice(1); // remove leading "/"
      return serveFromR2(key, env);
    }

    // Delegate to the OpenNext / Next.js worker
    return openNextDefault.fetch(request, env, ctx);
  },
};
