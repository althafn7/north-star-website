// Cloudflare Pages Function: /api/documents/upload
// Handles secure upload of Job Attachments (Method Statements, JHA, Drawings, Certificates) to Cloudflare R2

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const recordId = (formData.get("recordId") || "general").trim();
    const jobRef = (formData.get("jobRef") || "NSTS").trim();
    const category = (formData.get("category") || "General").trim();
    const notes = (formData.get("notes") || "").trim();

    if (!file || typeof file === "string") {
      return new Response(
        JSON.stringify({ error: "No file was uploaded." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const originalName = file.name || "document.pdf";
    const cleanJobRef = jobRef.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cleanFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const docId = `doc_${timestamp}_${Math.random().toString(36).substring(2, 6)}`;
    const r2Key = `jobs/${cleanJobRef}/${timestamp}_${cleanFileName}`;

    const mimeType = file.type || "application/octet-stream";
    const fileSize = file.size || 0;

    // Check if Cloudflare R2 Bucket is bound
    if (env && env.DOCUMENTS_BUCKET) {
      // Stream file directly into Cloudflare R2
      await env.DOCUMENTS_BUCKET.put(r2Key, file.stream(), {
        httpMetadata: {
          contentType: mimeType,
          contentDisposition: `inline; filename="${originalName}"`
        },
        customMetadata: {
          originalName: originalName,
          recordId: recordId,
          jobRef: jobRef,
          category: category,
          uploadDate: new Date().toISOString()
        }
      });

      const docUrl = `/api/documents/${encodeURIComponent(r2Key)}`;

      return new Response(
        JSON.stringify({
          success: true,
          storage: "r2",
          document: {
            id: docId,
            name: originalName,
            r2Key: r2Key,
            url: docUrl,
            size: fileSize,
            type: mimeType,
            category: category,
            notes: notes,
            uploadDate: new Date().toISOString()
          }
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    } else {
      // Fallback: If R2 is not yet bound in Cloudflare Dashboard
      // Files <= 3.5 MB can be converted to data URL for seamless functionality
      if (fileSize <= 3.5 * 1024 * 1024) {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:${mimeType};base64,${base64}`;

        return new Response(
          JSON.stringify({
            success: true,
            storage: "fallback",
            notice: "Cloudflare R2 bucket not yet linked in Dashboard; file stored as direct attachment.",
            document: {
              id: docId,
              name: originalName,
              r2Key: "inline",
              url: dataUrl,
              size: fileSize,
              type: mimeType,
              category: category,
              notes: notes,
              uploadDate: new Date().toISOString()
            }
          }),
          { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            error: "File size exceeds 3.5 MB. Please link your Cloudflare R2 bucket 'northstar-documents' in Cloudflare Pages dashboard to enable unlimited 10GB uploads."
          }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Upload failed: " + (err.message || String(err)) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}
