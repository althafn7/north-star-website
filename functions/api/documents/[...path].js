// Cloudflare Pages Function: /api/documents/[...path]
// Serves and deletes project documents stored in Cloudflare R2

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// GET: Stream document to browser (view inline or download)
export async function onRequestGet(context) {
  const { request, params, env } = context;
  const url = new URL(request.url);

  let key = "";
  if (params && params.path && Array.isArray(params.path) && params.path.length > 0) {
    key = params.path.join("/");
  } else if (url.searchParams.get("key")) {
    key = url.searchParams.get("key");
  }

  if (!key) {
    return new Response("Missing document key", { status: 400, headers: CORS_HEADERS });
  }

  // Decode URI components if needed
  try {
    key = decodeURIComponent(key);
  } catch (e) {}

  if (!env || !env.DOCUMENTS_BUCKET) {
    return new Response("R2 storage bucket is not bound", { status: 503, headers: CORS_HEADERS });
  }

  try {
    const object = await env.DOCUMENTS_BUCKET.get(key);
    if (!object) {
      return new Response("Document not found in storage", { status: 404, headers: CORS_HEADERS });
    }

    const contentType = object.httpMetadata?.contentType || "application/pdf";
    const originalName = object.customMetadata?.originalName || key.split("/").pop() || "document.pdf";
    const download = url.searchParams.get("download") === "1";

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(originalName)}"`
    );
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(object.body, { headers });
  } catch (err) {
    return new Response("Error retrieving document: " + err.message, { status: 500, headers: CORS_HEADERS });
  }
}

// DELETE: Delete document from R2
export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const url = new URL(request.url);

  let key = "";
  if (params && params.path && Array.isArray(params.path) && params.path.length > 0) {
    key = params.path.join("/");
  } else if (url.searchParams.get("key")) {
    key = url.searchParams.get("key");
  }

  if (!key) {
    return new Response(JSON.stringify({ error: "Missing document key" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  try {
    key = decodeURIComponent(key);
  } catch (e) {}

  if (!env || !env.DOCUMENTS_BUCKET) {
    return new Response(JSON.stringify({ success: true, notice: "Local document entry cleared" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  try {
    await env.DOCUMENTS_BUCKET.delete(key);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to delete from R2: " + err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
}
