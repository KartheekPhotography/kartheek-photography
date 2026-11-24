/* =========================================================
   QUOTATION CONFIG
   Every price, label, description, message, note and term lives here.
   Edit this file to change the quotation; no logic changes needed.
   Amounts are in INR. Prices are only ever shown in the PDF.
   ========================================================= */
(function (root) {
  const HYBRID_NOTE =
    "Our hybrid style blends traditional and candid shooting, so 2 Persons Coverage still captures the unscripted, heartfelt moments. You are in safe hands.";

  const COVERAGE_MESSAGES = {
    2: 'Includes Traditional and Candid Photography and Videography, shot in our signature hybrid style by a 2-person team. Expecting a larger guest list? 4 Persons Coverage will be the better fit.',
    4: 'Includes Traditional and Candid Photography and Videography, with a dedicated team member for each style, plus complimentary Drone coverage.'
  };

  const CFG = {
    /* ---------- PRICES (INR) ---------- */
    PRICES: {
      engagement:   { 2: 20000, 4: 35000 },
      reception:    { 2: 20000, 4: 35000 },
      pellikuthuru: { 2: 15000 },
      pellikoduku:  { 2: 15000 },
      vratham:      { 2: 15000 },
      haldi_bride:  { 2: 20000 },
      haldi_groom:  { 2: 20000 },
      haldi_couple: { 4: 30000 },
      sangeeth:     { 4: 30000 },
      mehandi:      { 2: 15000 },
      wedding:      { 4: 70000 },
      prewedding:   { photos: 30000, video: 30000, both: 50000 },
      albums:       { 50: 20000, 100: 35000, 150: 50000 }
    },

    /* ---------- EVENTS (form order = PDF order) ----------
       kind: choice  = pick one option (nothing preselected)
             fixed   = one fixed option, preselected and locked
             multi   = tick one or more options (pre-wedding)
             haldi   = tick Bride / Groom / Couple with exclusion rules   */
    EVENTS: [
      { key: 'engagement', label: 'Engagement', kind: 'choice', compare: true,
        options: [{ value: 2, label: '2 Persons Coverage' }, { value: 4, label: '4 Persons Coverage' }],
        messages: COVERAGE_MESSAGES },
      { key: 'prewedding', label: 'Pre-Wedding', kind: 'multi',
        options: [{ id: 'photos', label: 'Photos' }, { id: 'video', label: 'Cinematic Video' }] },
      { key: 'pellikuthuru', label: 'Pellikuthuru', kind: 'fixed', fixed: '2 Persons Coverage', note: HYBRID_NOTE },
      { key: 'pellikoduku',  label: 'Pellikoduku',  kind: 'fixed', fixed: '2 Persons Coverage', note: HYBRID_NOTE },
      { key: 'vratham',      label: 'Vratham',      kind: 'fixed', fixed: '2 Persons Coverage', note: HYBRID_NOTE },
      { key: 'haldi', label: 'Haldi', kind: 'haldi',
        options: [
          { id: 'bride',  label: 'Bride Haldi (2 Persons)',  note: HYBRID_NOTE },
          { id: 'groom',  label: 'Groom Haldi (2 Persons)',  note: HYBRID_NOTE },
          { id: 'couple', label: 'Couple Haldi (4 Persons)', note: 'Couple Haldi comes with 4 Persons Coverage as standard, so every moment of the ritual is beautifully covered.' }
        ] },
      { key: 'mehandi',  label: 'Mehandi',  kind: 'fixed', fixed: '2 Persons Coverage' },
      { key: 'sangeeth', label: 'Sangeeth', kind: 'fixed', fixed: '4 Persons Coverage',
        note: 'Sangeeth comes with 4 Persons Coverage as standard, to capture the music, dance and celebration from every angle.' },
      { key: 'wedding', label: 'Wedding', kind: 'fixed', fixed: '4 Persons Coverage',
        note: 'The Wedding comes with 4 Persons Coverage as standard, along with Drone coverage and a Wedding Highlights Video.' },
      { key: 'reception', label: 'Reception', kind: 'choice', compare: true,
        options: [{ value: 2, label: '2 Persons Coverage' }, { value: 4, label: '4 Persons Coverage' }],
        messages: COVERAGE_MESSAGES },
      { key: 'albums', label: 'Albums', kind: 'choice',
        options: [{ value: 50, label: '50 sheets' }, { value: 100, label: '100 sheets' }, { value: 150, label: '150 sheets' }] }
    ],

    /* ---------- COMPARE POPUP (Engagement and Reception) ---------- */
    COMPARE: {
      title: 'Compare 2 vs 4 persons',
      link: 'Compare 2 vs 4 persons',
      head: ['', '2 Persons', '4 Persons'],
      rows: [
        ['Traditional', '✓', '✓'],
        ['Candid', '✓ (limited)', '✓ (wide coverage, thanks to a dedicated person)'],
        ['Drone', '✗', '✓ (added by default, complimentary)'],
        ['Wide coverage', '✗', '✓'],
        ['Highlights Video', '✗', '✓']
      ]
    },

    /* ---------- PDF ROW TEXT ---------- */
    PDF_NAMES: {
      engagement: { 2: 'Engagement - 2 persons', 4: 'Engagement - 4 persons' },
      reception:  { 2: 'Reception - 2 persons',  4: 'Reception - 4 persons' },
      prewedding: 'Pre-Wedding',
      pellikuthuru: 'Pellikuthuru', pellikoduku: 'Pellikoduku', vratham: 'Vratham',
      haldi_bride: 'Bride Haldi', haldi_groom: 'Groom Haldi', haldi_couple: 'Couple Haldi',
      sangeeth: 'Sangeeth', mehandi: 'Mehandi', wedding: 'Wedding', albums: 'Albums'
    },
    // Each value is an array: one entry per line inside the SERVICES cell
    SERVICES: {
      engagement: {
        2: ['Cinematic Video, Candid and Traditional Photography & Videography'],
        4: ['Cinematic, Candid and Traditional Photography & Videography (with Drone Coverage), Engagement Highlights Video']
      },
      reception: {
        2: ['Cinematic Video, Candid and Traditional Photography & Videography'],
        4: ['Cinematic, Candid and Traditional Photography & Videography (with Drone Coverage), Reception Highlights Video']
      },
      prewedding: {
        photos: ['Unlimited edited photographs', 'Photo slideshow video', 'Customized Pre-Wedding Magazine', 'Customized Wedding invitation image'],
        video:  ['Cinematic video song, including aerial drone shots', 'Save-the-date video']
      },
      pellikuthuru: ['Traditional Photography & Videography'],
      pellikoduku:  ['Traditional Photography & Videography'],
      vratham:      ['Traditional Photography & Videography'],
      haldi_bride:  ['Cinematic Video, Candid & Traditional Photography & Videography'],
      haldi_groom:  ['Cinematic Video, Candid & Traditional Photography & Videography'],
      haldi_couple: ['Cinematic Video, Candid & Traditional Photography & Videography'],
      sangeeth:     ['Cinematic Video, Candid & Traditional Photography & Videography'],
      mehandi:      ['Cinematic Video, Candid Photography & Videography'],
      wedding:      ['Coverage of Wedding Rituals, Cinematic, Candid and Traditional Photography & Videography (with Drone Coverage), Wedding Highlights Video'],
      albums: {
        50:  ['One Premium Album (50 Sheets)'],
        100: ['Two Premium Albums (50 Sheets each)'],
        150: ['Three Premium Albums (50 Sheets each)']
      }
    },

    /* ---------- INSTALLMENTS (Wedding only) ----------
       base count when Wedding is selected, plus one for each extra listed */
    INSTALLMENTS: { base: 4, extras: ['engagement', 'prewedding'] },

    /* ---------- TERMS & CONDITIONS ----------
       when: always | wedding | prewedding | prewedding_both   ({n} = installments) */
    TERMS: [
      { when: 'always',   text: 'A minimum of 10% of the total amount is required upfront as an advance to confirm your booking.' },
      { when: 'wedding',  text: 'For your convenience, the total amount will be divided into {n} installments, based on this quotation.' },
      { when: 'always',   text: 'Travel charges are included for all events except the pre-wedding shoot.' },
      { when: 'prewedding', text: 'For the pre-wedding shoot, the client will take care of travel and accommodation arrangements.' },
      { when: 'prewedding_both', text: 'When both photography and videography are selected, a minimum of 2 days is required to cover the pre-wedding shoot.' },
      { when: 'always',   text: 'All photos will be professionally edited, and all videos will be delivered in 4K ultra-high quality.' },
      { when: 'always',   text: 'A pen drive containing all edited photos and videos will be provided at the time of album delivery.' }
    ],

    /* ---------- PDF DESIGN ---------- */
    PDF: {
      title: 'WEDDING QUOTATION',
      tagline: 'Redefine Capturing!',
      studio: 'Kartheek Photography',
      instagram: 'kartheek__photography',
      thanks: 'Thank you!',
      colors: {               // hex; tweak to match the sample exactly
        accent: '#FBA677', peach: '#FEE9DD', ink: '#2B2622', grey: '#7A7570',
        line: '#E6E1DB', box: '#F8F7F6', white: '#FFFFFF'
      }
    },

    /* ---------- EMAIL ---------- */
    /* ---------- FORM COPY ---------- */
    COPY: {
      eventsNote: "Select every event you'd like us to cover. Options for each event will appear below.",
      preweddingNote: 'Choose both Photos and Cinematic Video for the complete story. Covering both needs a minimum of 2 days.',
      albumsNote: 'Each album has 50 sheets. Choose the size that suits your story.',
      building: 'Building…',
      sendFailed: "We couldn't send your quotation just now, so it hasn't been created. Please check your connection and try again, or message us on WhatsApp and we'll help right away.",
      buildFailed: "Something went wrong while building your quotation. Please try again, or message us on WhatsApp and we'll help right away.",
      sentOk: '✓ Your quotation has been shared with Kartheek Photography. We will be in touch shortly.'
    },

    FILE_NAME: 'Quotation_{name}_{date}.pdf'   // {date} = DD-MM-YYYY
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CFG;
  root.QUOTE_CONFIG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
