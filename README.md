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

## Enquiry form (Netlify)
The "Build your shoot" form in index.html is a Netlify Form named "enquiry". Deploy the site on Netlify, then turn on email notifications:
Site settings > Forms > Form notifications > Add notification > Email.
Submissions also appear under Forms in the Netlify dashboard. The form must stay in index.html (Netlify reads it at deploy time).
Fields: name, city, service, events, coverage choices, date, budget, phone, comments, consent, plus a "summary" line that reads like "Wedding: Engagement (2 persons coverage), Haldi (Bride)".
To change the events or options, edit the form in index.html and the matching code under "enquiry form" in js/main.js.

## Contact card and QR
- Phone / WhatsApp number (8374967795) and the Instagram link are in the "Prefer to talk?" card in index.html. Search for 918374967795 to change the number.
- The QR code is src/qr/instagram.png. To use your own Instagram QR, replace that file (keep the name; a square image works best).

## Rows of boxes
The gallery albums and the film boxes are centred when they fit. If there are more boxes than the screen can show, arrows appear on the sides to move to the next set (on phones you can also use the arrows or swipe the titles area).

## Gallery boxes
Each category shows 4 albums across on a computer (3 on tablets, 2 on phones). More albums than that scroll with the side arrows.
The extra albums use sample pictures (carousel-4, carousel-5 ...). Replace the pictures in those folders with yours, or delete a folder and remove its title from the CATS list in js/main.js.
