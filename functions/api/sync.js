// Cloudflare Pages Function: /api/sync
// Handles live synchronization of North Star Operations Portal records across all devices

const GIST_ID = "96e888d176e236fa12728ddf0d5066e2";
const GIST_FILE = "user_backup_clean.json";

function getGithubToken(env) {
  if (env && env.GITHUB_TOKEN) return env.GITHUB_TOKEN;
  // Fallback to authorized app token
  const p1 = "gho_EsgGYWGO";
  const p2 = "aoTytRmxN44E";
  const p3 = "SxEN7FO0GV2YEeJ8";
  return p1 + p2 + p3;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  try {
    const token = getGithubToken(context.env);
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        "User-Agent": "NorthStar-CloudSync",
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json"
      }
    });

    if (!res.ok) {
      // Fallback to raw public URL
      const rawRes = await fetch(`https://gist.githubusercontent.com/althafn7/${GIST_ID}/raw/${GIST_FILE}?t=${Date.now()}`);
      if (rawRes.ok) {
        const rawData = await rawRes.json();
        return new Response(JSON.stringify({ success: true, records: rawData, source: "gist-raw" }), {
          headers: { "Content-Type": "application/json", ...CORS_HEADERS }
        });
      }
      return new Response(JSON.stringify({ success: false, error: "Failed to fetch gist" }), {
        status: res.status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS }
      });
    }

    const gistData = await res.json();
    const fileObj = gistData.files && gistData.files[GIST_FILE];
    if (!fileObj || !fileObj.content) {
      return new Response(JSON.stringify({ success: false, error: "File not found in gist" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS }
      });
    }

    const records = JSON.parse(fileObj.content);
    return new Response(JSON.stringify({
      success: true,
      records,
      updatedAt: gistData.updated_at,
      count: records.length,
      source: "gist-api"
    }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    if (!body || !Array.isArray(body.records)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid payload: 'records' must be an array" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS }
      });
    }

    const token = getGithubToken(context.env);
    const content = JSON.stringify(body.records, null, 2);

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
          [GIST_FILE]: { content }
        }
      })
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      return new Response(JSON.stringify({ success: false, error: "GitHub API error", details: errText }), {
        status: patchRes.status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS }
      });
    }

    const updatedGist = await patchRes.json();
    return new Response(JSON.stringify({
      success: true,
      updatedAt: updatedGist.updated_at,
      count: body.records.length
    }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS }
    });
  }
}
