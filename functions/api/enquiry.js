export async function onRequestPost({ request, env }) {
  let activeClaim = null, activeClaimColumn = null, activeQuoteId = null;
  const headers = {
    "Content-Type": "application/json",
  };

  const response = (status, data) =>
    new Response(JSON.stringify(data), { status, headers });

  try {
    // Check that the Resend API key is configured in Cloudflare
    if (!env.RESEND_API_KEY) {
      return response(500, {
        success: false,
        code: "no_api_key",
        message: "Email service is not configured.",
      });
    }

    // Read submitted form data
    const formData = await request.formData();

    // Spam protection: silently accept submissions from bots
    if (formData.get("bot-field")) {
      return response(200, { success: true });
    }

    // Collect all form fields, including repeated checkbox values
    const details = {};

    for (const [key, value] of formData.entries()) {
      if (["bot-field", "quote", "quotation", "email_type", "quote_id"].includes(key) || value === "") continue;
      if (typeof value !== "string") continue;

      if (details[key]) {
        details[key] += ", " + value;
      } else {
        details[key] = value;
      }
    }

    // Validate required fields
    const requiredFields = ["name", "city", "phone", "date"];

    for (const field of requiredFields) {
      if (!details[field]) {
        return response(400, {
          success: false,
          message: `Please provide ${field}.`,
        });
      }
    }

    if (!formData.has("consent")) {
      return response(400, {
        success: false,
        message: "Please agree to be contacted.",
      });
    }

    // The quotation built in the browser: summary data + the PDF itself
    let quote;
    try {
      quote = JSON.parse(formData.get("quote") || "");
      if (!Array.isArray(quote.lines) || !Number.isFinite(quote.total)) throw new Error("bad quote");
    } catch {
      return response(400, { success: false, message: "Quotation details are missing." });
    }

    const pdfFile = formData.get("quotation");
    if (!pdfFile || typeof pdfFile === "string" || !pdfFile.size) {
      return response(400, { success: false, message: "Quotation PDF is missing." });
    }
    if (pdfFile.size > 2 * 1024 * 1024) {
      return response(413, { success: false, message: "Quotation PDF is too large." });
    }
    const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
    if (String.fromCharCode(...pdfBytes.slice(0, 5)) !== "%PDF-") {
      return response(400, { success: false, message: "Quotation PDF is invalid." });
    }
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i += 0x8000) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + 0x8000));
    }
    const pdfBase64 = btoa(binary);
    // Safe file name: letters, digits, dot, dash, underscore only
    const fileName = (pdfFile.name || "Quotation.pdf").replace(/[^\w.\-]+/g, "_").slice(0, 120) || "Quotation.pdf";

    // Escape values before inserting them into HTML
    const escapeHtml = (value) =>
      String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]);

    // ---------- Email presentation helpers ----------

    // "eventDate" / "event_date" -> "Event Date"
    const prettyLabel = (key) =>
      key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());

    // Make emails and phone numbers clickable
    const formatValue = (key, value) => {
      const safe = escapeHtml(value).replace(/\n/g, "<br>");
      if (/email/i.test(key)) {
        return `<a href="mailto:${safe}" style="color:#9a6b2f;text-decoration:none;">${safe}</a>`;
      }
      if (/phone|mobile|whatsapp/i.test(key)) {
        const tel = escapeHtml(String(value).replace(/[^\d+]/g, ""));
        return `<a href="tel:${tel}" style="color:#9a6b2f;text-decoration:none;">${safe}</a>`;
      }
      return safe;
    };

    // "consent" is only a tick-box, so it is hidden from the table
    const rows = Object.entries(details)
      .filter(([key]) => key !== "consent")
      .sort(([a], [b]) => {
        const order = ["name", "phone", "city", "date", "comments"];
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .map(([key, value]) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee6da;vertical-align:top;width:34%;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#9a8f80;">
            ${escapeHtml(prettyLabel(key))}
          </td>
          <td style="padding:14px 0 14px 12px;border-bottom:1px solid #eee6da;vertical-align:top;font-size:15px;line-height:1.5;color:#2b2622;">
            ${formatValue(key, value)}
          </td>
        </tr>
      `)
      .join("");

    const safeName = escapeHtml(details.name);
    const emailType = String(formData.get("email_type") || "first");
    if (!["first", "final"].includes(emailType)) {
      return response(400, { success: false, code: "invalid_email_type" });
    }
    const isFinal = emailType === "final";
    const quoteId = String(formData.get("quote_id") || "").trim();
    if (quoteId && env.DB) {
      const sentColumn = isFinal ? "second_email_sent_at" : "first_email_sent_at";
      const claimColumn = isFinal ? "second_email_claimed_at" : "first_email_claimed_at";
      const emailState = await env.DB.prepare(
        `SELECT ${sentColumn} AS sent_at, status FROM quotes WHERE id=?`
      ).bind(quoteId).first();
      if (!emailState) return response(404, { success: false, code: "quote_not_found" });
      if (emailState.sent_at) return response(200, { success: true, alreadySent: true });
      if (isFinal && emailState.status !== "submitted") {
        return response(409, { success: false, code: "quote_not_submitted" });
      }
      const claim = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
      const claimed = await env.DB.prepare(
        `UPDATE quotes SET ${claimColumn}=? WHERE id=? AND ${sentColumn} IS NULL
          AND (${claimColumn} IS NULL OR ${claimColumn} <= datetime('now', '-5 minutes'))${isFinal ? " AND status='submitted'" : ""}`
      ).bind(claim, quoteId).run();
      if (!(claimed.meta?.changes > 0)) {
        return response(409, { success: false, code: "email_in_progress", message: "This notification is already being processed. Please retry shortly." });
      }
      activeClaim = claim; activeClaimColumn = claimColumn; activeQuoteId = quoteId;
    }

    // Indian digit grouping, e.g. 255000 -> 2,55,000
    const inr = (n) => {
      const str = String(Math.abs(Math.round(Number(n) || 0)));
      const rest = str.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
      return (rest ? rest + "," : "") + str.slice(-3);
    };

    const quoteRows = quote.lines.slice(0, 40).map((line) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;vertical-align:top;font-size:15px;color:#2b2622;">
            ${escapeHtml(line.name)}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #eee6da;vertical-align:top;text-align:right;font-size:15px;color:#2b2622;white-space:nowrap;">
            &#8377; ${inr(line.amount)}
          </td>
        </tr>`).join("");
    const installmentsLine = quote.installments
      ? `<p style="margin:10px 0 0;font-size:13px;color:#9a8f80;">Wedding payable in ${escapeHtml(quote.installments)} installments.</p>`
      : "";

    // Reply button only appears if the form collects an email field
    const replyButton = details.email
      ? `
          <tr>
            <td align="center" style="padding:0 36px 36px;">
              <a href="mailto:${escapeHtml(details.email)}?subject=${encodeURIComponent("Re: Your wedding photography enquiry")}"
                 style="display:inline-block;background:#c9a46a;color:#1f1b18;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:.5px;padding:14px 32px;border-radius:999px;">
                Reply to ${safeName}
              </a>
            </td>
          </tr>`
      : "";

    const emailHeading = isFinal ? "Quotation Submitted" : "New Quotation";
    const emailIntro = isFinal
      ? "The customer has explicitly submitted their latest quotation. The final PDF is attached."
      : "just built a quotation on your website. Their details and the quotation are below, and the PDF is attached.";
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
</head>
<body style="margin:0;padding:0;background:#f4efe8;">
  <!-- Preheader (inbox preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${safeName} just built a quotation on your website.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:#1f1b18;padding:36px 24px 30px;">
              <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a46a;">
                Kartheek Photography
              </div>
              <div style="width:40px;height:1px;background:#c9a46a;margin:16px auto;"></div>
              <div style="font-size:26px;line-height:1.3;color:#ffffff;">
                ${emailHeading}
              </div>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:32px 36px 8px;font-family:Arial,sans-serif;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#5a524a;">
                ${isFinal ? `<strong style="color:#2b2622;">${safeName}</strong> ${emailIntro}` : `<strong style="color:#2b2622;">${safeName}</strong> ${emailIntro}`}
              </p>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:8px 36px 24px;font-family:Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rows}
              </table>
            </td>
          </tr>

          <!-- Quotation -->
          <tr>
            <td style="padding:0 36px 28px;font-family:Arial,sans-serif;">
              <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#9a8f80;padding-bottom:6px;border-bottom:1px solid #eee6da;">Quotation (PDF attached)</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${quoteRows}</table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:#faf7f2;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9a6b2f;font-weight:bold;">Total</td>
                  <td style="padding:14px 16px;text-align:right;font-size:20px;font-weight:bold;color:#2b2622;">&#8377;${inr(quote.total)}</td>
                </tr>
              </table>
              ${installmentsLine}
            </td>
          </tr>

          ${replyButton}

          <!-- Footer -->
          <tr>
            <td align="center" style="background:#faf7f2;padding:20px 24px;font-family:Arial,sans-serif;font-size:12px;color:#9a8f80;">
              Sent from your website quotation builder &middot; kartheekphotography.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Build the Resend payload
    const emailPayload = {
      from: "Kartheek Photography <enquiries@kartheekphotography.com>",
      to: ["kartheekphotography.kp@gmail.com"],
      subject: `${isFinal ? "Final Quotation Submitted" : "New Quotation"} - ${details.name.replace(/[\r\n]+/g, " ")} - ₹${inr(quote.total)}`,
      html: emailHtml,
      headers: quoteId ? { "X-Quote-ID": quoteId } : undefined,
      attachments: [{ filename: fileName, content: pdfBase64 }],
    };

    // If the form collects an email, replies go straight to the client
    if (details.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) {
      emailPayload.reply_to = details.email;
    }

    // Send enquiry email through Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendResult);
      if (activeClaim && activeClaimColumn && activeQuoteId && env.DB) {
        await env.DB.prepare(`UPDATE quotes SET ${activeClaimColumn}=NULL WHERE id=? AND ${activeClaimColumn}=?`)
          .bind(activeQuoteId, activeClaim).run();
        activeClaim = null;
      }
      return response(502, {
        success: false,
        code: "resend_rejected",
        message: "Unable to send your enquiry. Please try again.",
      });
    }

    if (quoteId && env.DB && activeClaim) {
      const sentAt = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
      if (isFinal) {
        await env.DB.prepare(`UPDATE quotes SET second_email_sent_at=?, final_email_sent_at=?, second_email_claimed_at=NULL
          WHERE id=? AND second_email_claimed_at=? AND status='submitted' AND second_email_sent_at IS NULL`)
          .bind(sentAt, sentAt, quoteId, activeClaim).run();
      } else {
        await env.DB.prepare(`UPDATE quotes SET first_email_sent_at=?, first_email_claimed_at=NULL
          WHERE id=? AND first_email_claimed_at=? AND first_email_sent_at IS NULL`)
          .bind(sentAt, quoteId, activeClaim).run();
      }
      activeClaim = null;
    }

    return response(200, {
      success: true,
      message: "Enquiry sent successfully.",
      emailId: resendResult.id || null,
    });

  } catch (error) {
    console.error("Enquiry function error:", error);
    if (activeClaim && activeClaimColumn && activeQuoteId && env.DB) {
      try {
        await env.DB.prepare(`UPDATE quotes SET ${activeClaimColumn}=NULL WHERE id=? AND ${activeClaimColumn}=?`)
          .bind(activeQuoteId, activeClaim).run();
      } catch (releaseError) {
        console.error("Could not release email claim:", releaseError);
      }
    }

    return response(500, {
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}