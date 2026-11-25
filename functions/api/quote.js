const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});
const asText = (v, max = 2000) => String(v ?? "").trim().slice(0, max);
async function hashToken(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function safeJson(value, max = 50000) {
  const s = JSON.stringify(value);
  if (!s || s.length > max) throw new Error("payload_too_large");
  return s;
}
function deadlineMs() { return Date.now() + 10 * 60 * 1000; }

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json(503, { success: false, code: "d1_not_configured", message: "Quotation storage is not connected yet." });
  try {
    const body = await request.json();
    const action = body.action || "save";
    const client = body.client || {};
    const name = asText(client.name, 120);
    const phone = asText(client.phone, 30);
    const city = asText(client.city, 160);
    const eventDate = asText(body.eventDate, 30);
    const comments = asText(body.comments, 3000);
    if (!name || !phone || !city || !eventDate) {
      return json(400, { success: false, code: "invalid_customer", message: "Please provide your name, contact number, location and event date." });
    }
    if (!body.selection || !body.quote || !Array.isArray(body.quote.lines) || !Number.isFinite(body.quote.total)) {
      return json(400, { success: false, code: "invalid_quote", message: "Quotation details are incomplete." });
    }
    const selectionJson = safeJson(body.selection);
    const quoteJson = safeJson(body.quote);
    const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

    if (action === "create") {
      const id = crypto.randomUUID();
      const token = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
      const tokenHash = await hashToken(token);
      await env.DB.prepare(`INSERT INTO quotes
        (id, access_token_hash, customer_name, customer_phone, event_location, event_date, comments,
         selection_json, quote_json, revision, status, created_at, updated_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'generated', ?, ?, datetime('now', '+90 days'), ?)`)
        .bind(id, tokenHash, name, phone, city, eventDate, comments, selectionJson, quoteJson, now, now, now).run();
      await env.DB.prepare(`INSERT INTO quote_revisions (quote_id, revision, selection_json, quote_json, created_at) VALUES (?, 1, ?, ?, ?)`)
        .bind(id, selectionJson, quoteJson, now).run();
      return json(200, { success: true, id, token, revision: 1, status: "generated", inactivityDeadline: deadlineMs() });
    }

    if (!["save", "submit"].includes(action)) return json(400, { success: false, code: "invalid_action" });
    const id = asText(body.id, 80), token = asText(body.token, 128);
    if (!id || !token) return json(400, { success: false, code: "missing_access" });
    const tokenHash = await hashToken(token);
    const existing = await env.DB.prepare(`SELECT id, access_token_hash, revision, status,
        customer_name, customer_phone, event_location, event_date, comments,
        selection_json, quote_json, inactivity_email_sent_at
      FROM quotes WHERE id = ? AND expires_at > datetime('now')`)
      .bind(id).first();
    if (!existing || existing.access_token_hash !== tokenHash) return json(404, { success: false, code: "quote_not_found" });

    const changed =
      existing.customer_name !== name ||
      existing.customer_phone !== phone ||
      existing.event_location !== city ||
      existing.event_date !== eventDate ||
      (existing.comments || "") !== comments ||
      existing.selection_json !== selectionJson ||
      existing.quote_json !== quoteJson;

    const status = action === "submit" ? "submitted" : existing.status;
    let revision = existing.revision;

    if (changed) {
      revision += 1;
      await env.DB.prepare(`UPDATE quotes SET customer_name=?, customer_phone=?, event_location=?, event_date=?, comments=?,
          selection_json=?, quote_json=?, revision=?, status=?, updated_at=?, last_activity_at=?,
          expires_at=datetime('now', '+90 days'),
          inactivity_email_claimed_at=CASE WHEN inactivity_email_sent_at IS NULL THEN NULL ELSE inactivity_email_claimed_at END
        WHERE id=?`)
        .bind(name, phone, city, eventDate, comments, selectionJson, quoteJson, revision, status, now, now, id).run();
      await env.DB.prepare(`INSERT INTO quote_revisions (quote_id, revision, selection_json, quote_json, created_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(id, revision, selectionJson, quoteJson, now).run();
    } else {
      // A successful Build resets inactivity even when the selection did not change.
      await env.DB.prepare(`UPDATE quotes SET status=?, updated_at=?, last_activity_at=?,
          expires_at=datetime('now', '+90 days'),
          inactivity_email_claimed_at=CASE WHEN inactivity_email_sent_at IS NULL THEN NULL ELSE inactivity_email_claimed_at END
        WHERE id=?`)
        .bind(status, now, now, id).run();
    }

    return json(200, {
      success: true, id, revision, status, unchanged: !changed,
      inactivityDeadline: action === "submit" ? null : deadlineMs()
    });
  } catch (error) {
    console.error("Quote storage error:", error);
    return json(500, { success: false, code: error.message === "payload_too_large" ? "payload_too_large" : "storage_failed", message: "We couldn't save your quotation. Please try again." });
  }
}
