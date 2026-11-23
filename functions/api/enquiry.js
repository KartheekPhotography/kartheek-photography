
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

    const rows = Object.entries(details)
      .map(([key, value]) => `
        <tr>
          <td style="padding:10px;border:1px solid #ddd;font-weight:bold;">
            ${escapeHtml(key)}
          </td>
          <td style="padding:10px;border:1px solid #ddd;">
            ${escapeHtml(value)}
          </td>
        </tr>
      `)
      .join("");

    // Send enquiry email through Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Kartheek Photography <enquiries@kartheekphotography.com>",
        to: ["kartheekphotography.kp@gmail.com"],
        subject: `New Wedding Enquiry - ${details.name}`,
        html: `
          <div style="font-family:Arial,sans-serif;color:#222;">
            <h2>New Wedding Photography Enquiry</h2>
            <p>You have received a new enquiry through your website.</p>
            <table style="border-collapse:collapse;width:100%;">
              ${rows}
            </table>
            <p style="margin-top:20px;">
              Kartheek Photography
            </p>
          </div>
        `,
      }),
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

