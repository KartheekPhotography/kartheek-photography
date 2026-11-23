export async function onRequestPost({ request, env }) {
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
      if (key === "bot-field" || value === "") continue;

      if (details[key]) {
        details[key] += ", " + value;
      } else {
        details[key] = value;
      }
    }

    // Validate required fields
    const requiredFields = ["name", "city", "service", "date", "phone"];

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
    ${safeName} just sent a wedding photography enquiry.
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
                New Wedding Enquiry
              </div>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:32px 36px 8px;font-family:Arial,sans-serif;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#5a524a;">
                <strong style="color:#2b2622;">${safeName}</strong>
                has just reached out through your website. Here are the details:
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

          ${replyButton}

          <!-- Footer -->
          <tr>
            <td align="center" style="background:#faf7f2;padding:20px 24px;font-family:Arial,sans-serif;font-size:12px;color:#9a8f80;">
              Sent from your website enquiry form &middot; kartheekphotography.com
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
      subject: `New Wedding Enquiry - ${details.name}`,
      html: emailHtml,
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

      return response(502, {
        success: false,
        message: "Unable to send your enquiry. Please try again.",
      });
    }

    return response(200, {
      success: true,
      message: "Enquiry sent successfully.",
    });

  } catch (error) {
    console.error("Enquiry function error:", error);

    return response(500, {
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}