const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});
async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function onRequestPut({ request, env }) {
  if (!env.DB) return json(503, { success: false, code: "d1_not_configured", message: "Quotation storage is not connected." });
  if (!env.QUOTE_PDFS) return json(503, { success: false, code: "pdf_storage_not_configured", message: "Quotation PDF storage is not connected yet." });
  try {
    const id = String(request.headers.get("X-Quote-ID") || "").trim();
    const token = String(request.headers.get("X-Quote-Token") || "").trim();
    if (!id || !token) return json(400, { success: false, code: "missing_access" });
    const row = await env.DB.prepare("SELECT access_token_hash FROM quotes WHERE id=? AND expires_at > datetime('now')").bind(id).first();
    if (!row || row.access_token_hash !== await hashToken(token)) return json(404, { success: false, code: "quote_not_found" });
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length < 5 || bytes.length > 2 * 1024 * 1024 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
      return json(400, { success: false, code: "invalid_pdf", message: "The quotation PDF is invalid or too large." });
    }
    await env.QUOTE_PDFS.put(`quotes/${id}.pdf`, bytes, {
      httpMetadata: { contentType: "application/pdf", cacheControl: "private, no-store" },
      customMetadata: { quoteId: id }
    });
    return json(200, { success: true });
  } catch (error) {
    console.error("Quote PDF storage error:", error);
    return json(500, { success: false, code: "pdf_storage_failed", message: "We couldn't save the latest quotation PDF. Please try again." });
  }
}
