const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const inr = value => Math.round(Number(value) || 0).toLocaleString("en-IN");
function base64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
const stamp = () => new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

async function sendInactivityEmail(row, env) {
  const customerName = String(row.customer_name || "Client").trim().replace(/\s+/g, " ");
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is missing");
  const quote = JSON.parse(row.quote_json || "{}");
  const object = await env.QUOTE_PDFS.get(`quotes/${row.id}.pdf`);
  if (!object) throw new Error(`Latest PDF is missing for quote ${row.id}`);
  const pdfBytes = new Uint8Array(await object.arrayBuffer());
  const filename = `Quotation-${customerName.replace(/[^\p{L}\p{N}_-]+/gu, "_")}.pdf`;
  const rows = (quote.lines || []).slice(0, 40).map(line => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #eee6da;color:#2b2622">${escapeHtml(line.name)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eee6da;text-align:right;color:#2b2622;white-space:nowrap">₹${inr(line.amount)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f4efe8;padding:28px 12px;font-family:Arial,sans-serif">
    <table role="presentation" style="max-width:600px;width:100%;margin:auto;background:#fff;border-radius:12px;overflow:hidden">
      <tr><td style="background:#1f1b18;padding:30px;text-align:center;color:#c9a46a;font-size:11px;letter-spacing:3px;text-transform:uppercase">Kartheek Photography
      <div style="width:40px;height:1px;background:#c9a46a;margin:16px auto"></div>
      <div style="color:#fff;font:26px Georgia,serif;letter-spacing:0;margin-top:0">Final Quotation</div></td></tr>
      <tr><td style="padding:28px 32px;color:#5a524a;line-height:1.65">
        <p><strong>${escapeHtml(customerName)}</strong> generated this quotation on the website, but has not explicitly submitted it.</p>
        <p>This is the latest saved version after 10 minutes of inactivity. The quotation PDF is attached for your reference.</p>
        <p style="font-size:12px;color:#9a8f80">Quote reference: ${escapeHtml(row.id)} · Revision ${row.revision}</p>
        <table role="presentation" width="100%" style="border-collapse:collapse">${rows}</table>
        <p style="margin-top:18px;padding:14px 16px;background:#faf7f2;color:#9a6b2f;font-weight:bold">Total: ₹${inr(quote.total)}</p>
        <p style="font-size:13px;color:#81766a">Customer: ${escapeHtml(customerName)}<br>Mobile: ${escapeHtml(row.customer_phone)}<br>Location: ${escapeHtml(row.event_location)}<br>Event date: ${escapeHtml(row.event_date)}</p>
      </td></tr>
      <tr><td style="background:#faf7f2;padding:18px;text-align:center;color:#9a8f80;font-size:12px">Automated 10-minute quotation inactivity follow-up · kartheekphotography.com</td></tr>
    </table></body></html>`;
  const subject = `Final Quotation Submitted - ${customerName.replace(/[\r\n]+/g, " ")} - ₹${inr(quote.total)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Kartheek Photography <enquiries@kartheekphotography.com>",
      to: ["kartheekphotography.kp@gmail.com"],
      subject,
      headers: { "X-Quote-ID": row.id, "X-Quote-Revision": String(row.revision) },
      html,
      attachments: [{ filename, content: base64(pdfBytes) }]
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend rejected inactivity email: ${JSON.stringify(result)}`);
}

async function processInactivity(env) {
  if (!env.DB || !env.QUOTE_PDFS) throw new Error("D1 DB and R2 QUOTE_PDFS bindings are required");
  const candidates = await env.DB.prepare(`SELECT id FROM quotes
    WHERE status='generated' AND second_email_sent_at IS NULL
      AND last_activity_at IS NOT NULL
      AND first_email_sent_at IS NOT NULL
      AND last_activity_at <= datetime('now', '-10 minutes')
      AND (second_email_claimed_at IS NULL OR second_email_claimed_at <= datetime('now', '-5 minutes'))
    ORDER BY last_activity_at ASC LIMIT 50`).all();

  for (const candidate of (candidates.results || [])) {
    const claim = stamp();
    const claimed = await env.DB.prepare(`UPDATE quotes SET second_email_claimed_at=?
      WHERE id=? AND status='generated' AND second_email_sent_at IS NULL
        AND last_activity_at <= datetime('now', '-10 minutes')
        AND (second_email_claimed_at IS NULL OR second_email_claimed_at <= datetime('now', '-5 minutes'))`)
      .bind(claim, candidate.id).run();
    if (!(claimed.meta?.changes > 0)) continue;

    try {
      const row = await env.DB.prepare(`SELECT id, customer_name, customer_phone, event_location, event_date,
          quote_json, revision, last_activity_at, first_email_sent_at, second_email_claimed_at, second_email_sent_at, status
        FROM quotes WHERE id=?`).bind(candidate.id).first();
      // Re-check after claiming. A successful rebuild resets the claim and the 10-minute clock.
      if (!row || row.status !== "generated" || row.second_email_claimed_at !== claim ||
          row.second_email_sent_at || !row.first_email_sent_at || !row.last_activity_at ||
          new Date(row.last_activity_at.replace(" ", "T") + "Z").getTime() > Date.now() - 10 * 60 * 1000) {
        await env.DB.prepare("UPDATE quotes SET second_email_claimed_at=NULL WHERE id=? AND second_email_claimed_at=?")
          .bind(candidate.id, claim).run();
        continue;
      }

      await sendInactivityEmail(row, env);
      const sentAt = stamp();
      await env.DB.prepare(`UPDATE quotes SET inactivity_email_sent_at=?, second_email_sent_at=?,
          second_email_claimed_at=NULL, inactivity_email_claimed_at=NULL
        WHERE id=? AND second_email_claimed_at=? AND status='generated' AND second_email_sent_at IS NULL`)
        .bind(sentAt, sentAt, row.id, claim).run();
      console.log(`10-minute inactivity email sent for quote ${row.id}, revision ${row.revision}`);
    } catch (error) {
      console.error(`Inactivity email failed for quote ${candidate.id}:`, error);
      await env.DB.prepare(`UPDATE quotes SET second_email_claimed_at=NULL, inactivity_email_claimed_at=NULL WHERE id=? AND second_email_claimed_at=?`)
        .bind(candidate.id, claim).run();
    }
  }
}

async function cleanupExpired(env) {
  if (!env.DB) throw new Error("D1 binding DB is missing");
  const expired = await env.DB.prepare("SELECT id FROM quotes WHERE expires_at <= datetime('now')").all();
  if (env.QUOTE_PDFS) {
    for (const row of (expired.results || [])) await env.QUOTE_PDFS.delete(`quotes/${row.id}.pdf`);
  }
  await env.DB.prepare(`DELETE FROM quote_revisions WHERE quote_id IN
    (SELECT id FROM quotes WHERE expires_at <= datetime('now'))`).run();
  const result = await env.DB.prepare("DELETE FROM quotes WHERE expires_at <= datetime('now')").run();
  console.log(`90-day quotation cleanup completed; deleted ${result.meta?.changes ?? 0} quotes`);
}

export default {
  async scheduled(controller, env, ctx) {
    // Cloudflare may report the every-minute schedule in either form.
    if (controller.cron === "*/1 * * * *" || controller.cron === "* * * * *") {
      ctx.waitUntil(processInactivity(env));
    }
    if (controller.cron === "17 0 * * *") {
      ctx.waitUntil(cleanupExpired(env));
    }
  }
};
