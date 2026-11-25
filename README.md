# Kartheek Photography website

Open index.html in a browser to preview (needs internet for the Google fonts).

## Where your photos go
src/
  logo/logo.png            your logo (white or transparent PNG works best on the dark header). Keep the name logo.png
  carousel/                the main 16:9 carousel on the home page: 01.jpg, 02.jpg, 03.jpg ...
  gallery/
    weddings/carousel-1/   01.jpg, 02.jpg ...   (weddings has 3 carousels)
    weddings/carousel-2/
    weddings/carousel-3/
    pre-weddings/carousel-1/ and carousel-2/
    engagement/carousel-1/ and carousel-2/
    haldi/carousel-1/ and carousel-2/
    sangeeth/carousel-1/ and carousel-2/
    mahendi/carousel-1/ and carousel-2/

Rules
- Name photos in order: 01, 02, 03 ... (jpg, jpeg, png or webp). Delete the sample photos first.
- Use landscape 16:9 photos (for example 1920 x 1080). Keep each under about 400 KB for a fast site.
- The page shows photos until the first missing number, so do not skip a number.
- To add another carousel to a category, make a new folder carousel-4 and add a title in the CATS list at the top of js/main.js.

## Films (YouTube)
Edit the FILMS list in js/main.js. Add one line per film:
  {id:'https://youtu.be/VIDEOID', title:'Priya & Rahul', tag:'Wedding film'},
- id: the YouTube link or the 11-character video ID.
- Thumbnails: put them in src/films/wedding-films/ and src/films/pre-wedding-films/, named 01.jpg, 02.jpg, 03.jpg ... in the same order as the films in the list (16:9, e.g. 1280 x 720; jpg, png or webp). Just replace the sample files. If a number is missing, YouTube's thumbnail is used.
- thumb: optional per film, to point one film at a different image.
- To add a category (for example Engagement films), add a new block with a title and a videos list.
- The sample videos are placeholders. Replace them with yours.

## Quotation builder (Build your shoot form)
The form builds a PDF quotation in the browser, emails it to the studio as an attachment, and shows it to the visitor in a popup (Download / Edit / Submit quotation).
No price is shown on the form. Prices only appear in the PDF.

Where things live
- js/quote-config.js    ALL prices, event names, notes, messages, PDF wording, terms and PDF colours. Edit this to change anything.
- js/quote-pricing.js   the pricing / installments / validation logic (pure functions, no page code)
- js/quote-pdf.js       the PDF generator (A4, rupee sign, Indian digit grouping, table continues on a 2nd page)
- js/quote-datepicker.js  the themed calendar for the event date
- js/quote-form.js      the form behaviour, the Compare popup, the quotation popup, the email call
- js/quote-assets.js    generated: Roboto font subset + dark logo for the PDF. After changing src/logo/logo.png run: python3 tools/build_assets.py
- js/vendor/            pdf.js (shows the PDF in the popup, works on phones)
- functions/api/enquiry.js   Cloudflare Pages Function: receives the form + PDF and sends the email through Resend (attachment included)

Email: needs the RESEND_API_KEY secret in Cloudflare (unchanged). Recipient and sender are at the bottom of functions/api/enquiry.js.
The first successful Build Quotation saves the lead and emails the studio. Later Builds save changed data as revisions without repeated emails. The customer can use Submit quotation in the PDF popup to send the latest PDF as a second notification.

If sending fails, check in this order: (1) the site must be deployed on Cloudflare Pages with the functions/ folder (use Git deploy or `wrangler pages deploy`; drag-and-drop uploads and other hosts do not run functions), (2) RESEND_API_KEY is set under Pages > Settings > Environment variables (Production), then redeploy, (3) the domain kartheekphotography.com is verified in Resend, because the sender is enquiries@kartheekphotography.com. The error on the form shows the code (404/405 = function not deployed, 500 no_api_key = key missing, 502 resend_rejected = Resend refused, see Cloudflare logs).
To change PDF colours, edit PDF.colors in js/quote-config.js.

Tests (optional): node tests/acceptance.test.js (pricing + PDF text, needs poppler) and node tests/ui.test.js (browser flow, needs Playwright).

## Contact card and QR
- Phone / WhatsApp number (8374967795) and the Instagram link are in the "Prefer to talk?" card in index.html. Search for 918374967795 to change the number.
- The QR code is src/qr/instagram.png. To use your own Instagram QR, replace that file (keep the name; a square image works best).

## Rows of boxes
The gallery albums and the film boxes are centred when they fit. If there are more boxes than the screen can show, arrows appear on the sides to move to the next set (on phones you can also use the arrows or swipe the titles area).

## Gallery boxes
Each category shows 4 albums across on a computer (3 on tablets, 2 on phones). More albums than that scroll with the side arrows.
The extra albums use sample pictures (carousel-4, carousel-5 ...). Replace the pictures in those folders with yours, or delete a folder and remove its title from the CATS list in js/main.js.


## Cloudflare D1 quotation integration (new)

The quote builder now expects a D1 database binding named `DB` on the Pages Functions runtime.
The existing pricing engine (`js/quote-pricing.js`) and PDF renderer (`js/quote-pdf.js`) are unchanged.

### Database setup
1. In Cloudflare, create a D1 database named `kartheek-quotes`.
2. Add a D1 binding named `DB` to the Pages project (Pages > Settings > Functions > D1 database bindings).
3. Run the migration from this project root:
   `npx wrangler d1 migrations apply kartheek-quotes --remote`
   If you use Wrangler configuration, copy the binding from `wrangler.pages.toml.example` and replace the database ID.
4. Deploy the Pages project again.

The new `/api/quote` endpoint stores a quote, updates its latest selection and creates a revision record.
The first successful build emails the studio once. Rebuilding updates the stored quote without sending another email.
The customer can explicitly choose **Submit quotation** in the PDF popup to send the latest PDF as a second notification and mark the record submitted.
The mandatory customer fields are now name, mobile, location and event date.

### 90-day retention
The `expires_at` value is refreshed to 90 days after every successful save. `cleanup-worker.js` deletes expired quote records and revision rows.
Deploy this small scheduled Worker separately using `wrangler.cleanup.toml.example` (copy it to `wrangler.cleanup.toml`, replace the D1 database ID, then run `npx wrangler deploy --config wrangler.cleanup.toml`). It runs daily at 00:17 UTC.

### Important current scope
- D1 stores the latest customer details, selections, quote summary and revision history.
- PDFs are generated in the browser and attached to the first-build / explicit-submit emails; PDFs are not stored in D1.
- The owner dashboard and customer resume-link flow are not included in this integration stage.
- Customer selections remain in the browser until Build Quotation is clicked. Every successful Build saves the latest data to D1; a new revision is created only when the data changes. A no-change Build refreshes the 10-minute inactivity clock without creating a duplicate revision.
- If the customer never presses Submit, the record remains `generated` (not a confirmed booking) and is still retained until 90 days after its last save.
- Do not add the D1 database ID or any secret to client-side JavaScript. `RESEND_API_KEY` remains a server-side Cloudflare secret.


### 10-minute inactivity follow-up (new)

- The 10-minute countdown starts only after a successful Build Quotation and resets after every successful Build (including a no-change Build).
- The countdown is a visual indicator only. The page does not auto-refresh at timeout.
- A separate scheduled Cloudflare Worker checks every minute. If a quote is still `generated` and has had no successful Build for 10 minutes, it sends one reply-style follow-up email to the studio with the latest saved quotation PDF attached. Closing the customer's browser does not stop this process.
- The follow-up subject begins with `Re: New Quotation` and includes the customer/quote details. The same `X-Quote-ID` header is included for correlation. This is reply-style grouping; exact inbox threading depends on the receiving mail client/provider.
- The latest PDF is stored privately in the R2 bucket `kartheek-quote-pdfs`; D1 stores the quote data and revision history. The PDF is replaced on every successful Build.
- A successful explicit Submit marks the quote `submitted`, sends the final email, suppresses inactivity follow-up, closes the quotation popup and resets the form. The popup has no X close control; Edit and successful Submit are its only close paths.
- The scheduled Worker also retains the existing daily 90-day cleanup and removes the corresponding R2 PDF objects.

#### Additional Cloudflare setup required

1. Create the R2 bucket: `npx wrangler r2 bucket create kartheek-quote-pdfs`.
2. In Pages > Settings > Bindings, add an R2 bucket binding named `QUOTE_PDFS` pointing to `kartheek-quote-pdfs`. Keep the D1 binding named `DB`.
3. Apply the new migration after the existing initial migration: `npx wrangler d1 migrations apply kartheek-quotes --remote`.
4. Copy `wrangler.cleanup.toml.example` to `wrangler.cleanup.toml`, replace `database_id`, and deploy the scheduled Worker: `npx wrangler deploy --config wrangler.cleanup.toml`.
5. Add the Resend key to the scheduled Worker as a secret: `npx wrangler secret put RESEND_API_KEY --config wrangler.cleanup.toml`.
6. Ensure the Pages project still has its own `RESEND_API_KEY` secret for the first and explicit-submit emails, then redeploy Pages.

The scheduled Worker needs D1 binding `DB`, R2 binding `QUOTE_PDFS`, and the `RESEND_API_KEY` secret. The Pages Functions need D1 binding `DB`, R2 binding `QUOTE_PDFS`, and `RESEND_API_KEY`.


## Email automation deployment (Cloudflare)

This project uses a separate scheduled Worker (`cleanup-worker.js`) in addition to the Pages Functions.

1. Apply migrations `0001`, `0002`, and the new `0003_atomic_email_notifications.sql` to the production D1 database before deploying the updated Pages Functions or Worker.
2. Deploy Pages from the project root as usual. The Pages project must retain `DB` (D1), `QUOTE_PDFS` (R2), and the `RESEND_API_KEY` secret.
3. Deploy the scheduled Worker from this project root using `wrangler.cleanup.toml`. It defines the `DB` and `QUOTE_PDFS` bindings and both Cron schedules. Add the `RESEND_API_KEY` secret to the Worker separately; Pages secrets are not automatically shared with standalone Workers.
4. The one-minute Cron checks generated quotations after ten minutes of inactivity. The daily Cron removes expired quotations and their stored PDFs.
5. Test both mutually exclusive second-email paths with separate test quotations: explicit Submit sends the final PDF email; leaving a quote idle sends the inactivity PDF email. Verify the attached PDF is the latest revision and check Resend delivery logs.

The browser countdown closes the quotation preview and clears the local form at ten minutes. It does not delete the saved quotation; the scheduled Worker still processes it.
