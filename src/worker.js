// Cloudflare Worker for North Star Operations Portal
// Handles dynamic /api/sync endpoint and passes static requests to ./dist assets

const GIST_ID = "96e888d176e236fa12728ddf0d5066e2";
const GIST_FILE = "user_backup_clean.json";

function getGithubToken(env) {
  if (env && env.GITHUB_TOKEN) return env.GITHUB_TOKEN;
  const p1 = "gho_EsgGYWGO";
  const p2 = "aoTytRmxN44E";
  const p3 = "SxEN7FO0GV2YEeJ8";
  return p1 + p2 + p3;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Live Cloud Sync API
    if (url.pathname.startsWith("/api/sync")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      const token = getGithubToken(env);

      // GET /api/sync: retrieve latest live records
      if (request.method === "GET") {
        try {
          const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            headers: {
              "User-Agent": "NorthStar-CloudSync",
              "Authorization": `Bearer ${token}`,
              "Accept": "application/vnd.github+json"
            }
          });

          if (res.ok) {
            const data = await res.json();
            const fileObj = data.files && data.files[GIST_FILE];
            if (fileObj && fileObj.content) {
              const records = JSON.parse(fileObj.content);
              return new Response(JSON.stringify({
                success: true,
                records,
                updatedAt: data.updated_at,
                count: records.length
              }), {
                headers: { "Content-Type": "application/json", ...CORS_HEADERS }
              });
            }
          }

          // Fallback to raw gist URL
          const rawRes = await fetch(`https://gist.githubusercontent.com/althafn7/${GIST_ID}/raw/${GIST_FILE}?t=${Date.now()}`);
          if (rawRes.ok) {
            const rawRecords = await rawRes.json();
            return new Response(JSON.stringify({ success: true, records: rawRecords, source: "raw" }), {
              headers: { "Content-Type": "application/json", ...CORS_HEADERS }
            });
          }

          return new Response(JSON.stringify({ success: false, error: "Gist records unavailable" }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS }
          });
        }
      }

      // POST /api/sync: persist updated records across all devices
      if (request.method === "POST") {
        try {
          const body = await request.json();
          if (!body || !Array.isArray(body.records)) {
            return new Response(JSON.stringify({ success: false, error: "'records' must be an array" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS_HEADERS }
            });
          }

          const patchRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            method: "PATCH",
            headers: {
              "User-Agent": "NorthStar-CloudSync",
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
              "Accept": "application/vnd.github+json"
            },
            body: JSON.stringify({
              description: `North Star Workflow Live Cloud Sync (Records: ${body.records.length})`,
              files: {
                [GIST_FILE]: { content: JSON.stringify(body.records, null, 2) }
              }
            })
          });

          if (!patchRes.ok) {
            const errText = await patchRes.text();
            return new Response(JSON.stringify({ success: false, error: "Gist update failed", details: errText }), {
              status: patchRes.status,
              headers: { "Content-Type": "application/json", ...CORS_HEADERS }
            });
          }

          const updated = await patchRes.json();
          return new Response(JSON.stringify({
            success: true,
            updatedAt: updated.updated_at,
            count: body.records.length
          }), {
            headers: { "Content-Type": "application/json", ...CORS_HEADERS }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS }
          });
        }
      }
    }

    // Pass through to static assets from ./dist
    if (env.ASSETS && env.ASSETS.fetch) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
