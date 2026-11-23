
const $ = s => document.querySelector(s);

/* =========================================================
   IMAGEKIT CONFIGURATION
   ========================================================= */

const IMAGEKIT_BASE = 'https://ik.imagekit.io/goamqjl1w7';

const imageUrl = path =>
  `${IMAGEKIT_BASE}/${String(path).replace(/^\/+/, '')}`;


/* =========================================================
   GALLERY CATEGORIES
   ========================================================= */

const CATS = [
  {
    id: 'pre-weddings',
    title: 'Pre-weddings',
    subs: [
      'Vikram Srilekha',
      'Pre-wedding 2',
      'Pre-wedding 3',
      'Pre-wedding 4',
      'Pre-wedding 5',
      'Pre-wedding 6',
      'Pre-wedding 7',
      'Pre-wedding 8',
      'Pre-wedding 9',
      'Pre-wedding 10'
    ]
  },
  {
    id: 'weddings',
    title: 'Weddings',
    subs: [
      'Laxman & Dhanalakshmi',
      'Harsha & Harika',
      'Charan & Priyanka',
      'Ajay & Leela',
      'Santhosh & Yanvitha',
      'Vikram & Srilekha'
    ]
  },
  {
    id: 'engagement',
    title: 'Engagement',
    subs: [
      'Engagement 1',
      'Engagement 2',
      'Engagement 3',
      'Engagement 4',
      'Engagement 5'
    ]
  },
  {
    id: 'haldi',
    title: 'Haldi',
    subs: [
      'Haldi 1',
      'Haldi 2',
      'Haldi 3',
      'Haldi 4',
      'Haldi 5'
    ]
  },
  {
    id: 'sangeeth',
    title: 'Sangeeth',
    subs: [
      'Sangeeth 1',
      'Sangeeth 2'
    ]
  },
  {
    id: 'mahendi',
    title: 'Mahendi',
    subs: [
      'Mahendi 1',
      'Mahendi 2',
      'Mahendi 3',
      'Mahendi 4',
      'Mahendi 5'
    ]
  }
];


/* =========================================================
   IMAGE LOADING
   ========================================================= */

const EXT = ['jpg', 'jpeg', 'png', 'webp'];

const probe = url => new Promise(resolve => {
  const img = new Image();

  img.onload = () => resolve(true);
  img.onerror = () => resolve(false);

  img.src = url;
});

async function findImages(folder) {
  const out = [];

  for (let n = 1; n <= 60; n++) {
    const nn = String(n).padStart(2, '0');
    let found = null;

    for (const ext of EXT) {
      const url = imageUrl(`${folder}/${nn}.${ext}`);

      if (await probe(url)) {
        found = url;
        break;
      }
    }

    if (!found) break;

    out.push(found);
  }

  return out;
}


/* =========================================================
   CAROUSEL
   ========================================================= */

function carousel(root, urls, options = {}) {
  const N = urls.length;

  let current = 0;
  let timer;
  let startX = null;
  let hovering = false;
  let destroyed = false;
  let visible = false;
  let started = false;
  let observer;

  root.innerHTML = `
    <div class="car">
      <div class="sls"></div>
      <button class="ar l" aria-label="Previous photo">‹</button>
      <button class="ar r" aria-label="Next photo">›</button>
    </div>
    <div class="dots"></div>
  `;

  const car = root.querySelector('.car');
  const box = root.querySelector('.sls');
  const dots = root.querySelector('.dots');
  const slides = [];

  urls.forEach((url, i) => {
    const slide = document.createElement('div');
    slide.className = 'slide';

    box.appendChild(slide);
    slides.push(slide);

    const button = document.createElement('button');
    button.setAttribute('aria-label', `Show photo ${i + 1}`);
    button.onclick = () => go(i);

    dots.appendChild(button);
  });

  const load = i => {
    const slide = slides[i];

    if (slide && !slide.style.backgroundImage) {
      slide.style.backgroundImage = `url("${urls[i]}")`;
    }
  };

  function play() {
    clearInterval(timer);

    if (
      !destroyed &&
      N > 1 &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      timer = setInterval(() => {
        if (!document.hidden && !hovering && visible) {
          go(current + 1);
        }
      }, options.interval || 5000);
    }
  }

  function go(n, quiet = false) {
    current = (n + N) % N;

    load(current);
    load((current + 1) % N);

    [...box.children].forEach((slide, i) => {
      slide.classList.toggle('on', i === current);
    });

    [...dots.children].forEach((dot, i) => {
      dot.classList.toggle('on', i === current);
    });

    if (!quiet) play();
  }

  root.querySelector('.l').onclick = () => go(current - 1);
  root.querySelector('.r').onclick = () => go(current + 1);

  car.addEventListener('pointerenter', e => {
    if (e.pointerType === 'mouse') hovering = true;
  });

  car.addEventListener('pointerleave', () => {
    hovering = false;
  });

  car.addEventListener('pointerdown', e => {
    startX = e.clientX;
  });

  car.addEventListener('pointerup', e => {
    if (startX === null) return;

    const dx = e.clientX - startX;
    startX = null;

    if (Math.abs(dx) > 50) {
      go(current + (dx < 0 ? 1 : -1));
    } else if (options.open && !e.target.closest('button')) {
      options.open(urls, current);
    }
  });

  const start = () => {
    if (started || destroyed) return;

    started = true;

    const img = new Image();

    img.onload = img.onerror = () => {
      load(0);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (destroyed) return;

          go(0, true);
          setTimeout(play, options.delay || 0);
        });
      });
    };

    img.src = urls[0];
  };

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;

      if (visible) start();
    }, {
      rootMargin: '200px'
    });

    observer.observe(root);
  } else {
    visible = true;
    start();
  }

  return () => {
    destroyed = true;
    clearInterval(timer);

    if (observer) observer.disconnect();
  };
}


/* =========================================================
   MAIN HERO CAROUSEL
   ========================================================= */

findImages('src/carousel').then(urls => {
  if (urls.length) {
    carousel($('#heroCar'), urls, {
      interval: 3500
    });
  } else {
    $('#heroCar').innerHTML =
      '<p class="empty">No carousel images found.</p>';
  }
});


/* =========================================================
   HEADLINE FOCUS LENS
   ========================================================= */

const hl = $('#hl');
const cur = $('#cur');

let moved = false;

function lens(x, y) {
  const rect = hl.getBoundingClientRect();

  hl.style.setProperty('--x', (x - rect.left) + 'px');
  hl.style.setProperty('--y', (y - rect.top) + 'px');
}

addEventListener('pointermove', e => {
  cur.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;

  const rect = hl.getBoundingClientRect();
  const padding = 70;

  const inHeadline =
    e.clientX >= rect.left - padding &&
    e.clientX <= rect.right + padding &&
    e.clientY >= rect.top - padding &&
    e.clientY <= rect.bottom + padding;

  const mouse = e.pointerType === 'mouse';

  const show = mouse && (
    inHeadline || !!e.target.closest('.car')
  );

  cur.classList.toggle('show', show);
  document.body.classList.toggle('nc', show);

  cur.classList.toggle('lens', inHeadline && mouse);

  if (inHeadline) {
    moved = true;
    lens(e.clientX, e.clientY);
  }
}, {
  passive: true
});

document.documentElement.addEventListener('mouseleave', () => {
  cur.classList.remove('show');
  document.body.classList.remove('nc');
});

hl.addEventListener('pointerdown', e => {
  moved = true;
  lens(e.clientX, e.clientY);
});

if (matchMedia('(pointer: coarse)').matches) {
  $('#hint').textContent =
    'Wedding photography and films from Hyderabad. Touch and drag over the headline to bring it into focus.';
}

(function loop(t) {
  if (!moved) {
    const rect = hl.getBoundingClientRect();

    hl.style.setProperty(
      '--x',
      (rect.width * 0.5 + Math.sin(t / 1100) * rect.width * 0.4) + 'px'
    );

    hl.style.setProperty(
      '--y',
      (rect.height * 0.5 + Math.cos(t / 800) * rect.height * 0.15) + 'px'
    );
  }

  requestAnimationFrame(loop);
})(0);

document.addEventListener('pointerover', e => {
  cur.classList.toggle(
    'big',
    !!e.target.closest(
      'a,button,.card,.chip,.dots button,.opt,select,.consent'
    )
  );
});


/* =========================================================
   MOVING QUOTE
   ========================================================= */

const words = [
  'Some moments are too precious to fade, some emotions too beautiful to express, and every love story deserves to be remembered forever.'
];

$('#mq').innerHTML = [...words, ...words]
  .map(word => `<span>${word}</span>`)
  .join('<span></span>');


/* =========================================================
   HORIZONTAL RAIL
   ========================================================= */

function rail(root) {
  const track = root.querySelector('.track');
  const left = root.querySelector('.rarr.l');
  const right = root.querySelector('.rarr.r');

  const update = () => {
    left.hidden = track.scrollLeft < 6;

    right.hidden =
      track.scrollLeft + track.clientWidth >= track.scrollWidth - 6;
  };

  const step = () => {
    const child = track.children[0];

    const width = child
      ? child.getBoundingClientRect().width
      : 300;

    return Math.max(
      1,
      Math.floor(track.clientWidth / (width + 18))
    ) * (width + 18);
  };

  left.onclick = () => {
    track.scrollBy({
      left: -step(),
      behavior: 'smooth'
    });
  };

  right.onclick = () => {
    track.scrollBy({
      left: step(),
      behavior: 'smooth'
    });
  };

  track.addEventListener('scroll', update, {
    passive: true
  });

  addEventListener('resize', update);

  new MutationObserver(() => {
    track.scrollLeft = 0;
    update();
  }).observe(track, {
    childList: true
  });

  if (window.ResizeObserver) {
    new ResizeObserver(update).observe(track);
  }

  update();
}


/* =========================================================
   GALLERY CATEGORIES
   ========================================================= */

let stops = [];

$('#tabs').innerHTML = CATS.map((category, i) => `
  <button class="chip${i ? '' : ' on'}" data-i="${i}">
    ${category.title}
  </button>
`).join('');

function showCat(i) {
  stops.forEach(stop => stop());
  stops = [];

  const category = CATS[i];

  $('#subs').innerHTML = category.subs.map((title, k) => `
    <div class="sub">
      <h3>${title}</h3>
      <div class="carousel" id="sc${k}">
        <p class="empty">Loading…</p>
      </div>
    </div>
  `).join('');

  category.subs.forEach((title, k) => {
    const folder =
      `src/gallery/${category.id}/carousel-${k + 1}`;

    const element = $('#sc' + k);

    findImages(folder).then(urls => {
      if (!document.body.contains(element)) return;

      if (!urls.length) {
        element.innerHTML =
          '<p class="empty">No images available.</p>';
        return;
      }

      stops.push(
        carousel(element, urls, {
          interval: 4200,
          delay: k * 1300,
          open: openLB
        })
      );
    });
  });
}

$('#tabs').onclick = e => {
  const button = e.target.closest('.chip');

  if (!button) return;

  document.querySelectorAll('#tabs .chip').forEach(item => {
    item.classList.toggle('on', item === button);
  });

  showCat(+button.dataset.i);
};

showCat(0);
rail($('#subsRail'));


/* =========================================================
   FILMS
   ========================================================= */

const FILMS = [
  {
    title: 'Wedding films',
    folder: 'wedding-films',
    videos: [
      {
        id: 'https://youtu.be/Ec_4JnoCcRI',
        title: 'Santosh & Yanvita',
        tag: 'Visakhapatnam'
      },
      {
        id: 'https://youtu.be/RRbdhcJasiA',
        title: 'Vikram & Sri Lekha',
        tag: 'Hyderabad'
      },
      {
        id: 'https://youtu.be/Ra5dnigt2kQ',
        title: 'Jaikanth & Manasa',
        tag: 'Rajahmundry'
      },
      {
        id: 'https://youtu.be/oUmAgI-SpA4',
        title: 'Sravan & Renuka',
        tag: 'Annavaram'
      },
      {
        id: 'https://youtu.be/NWULlW78itM',
        title: 'Sai & Geetha',
        tag: 'Khammam'
      },
      {
        id: 'https://youtu.be/PqKYrMFVWmY',
        title: 'Charan & Priyanka',
        tag: 'Hyderabad'
      },
      {
        id: 'https://youtu.be/J1ZaP93LsHI',
        title: 'Harsha & Harika',
        tag: 'Hyderabad'
      }
    ]
  },
  {
    title: 'Pre-wedding films',
    folder: 'pre-wedding-films',
    videos: [
      {
        id: 'https://youtu.be/8P40y-0E0ow',
        title: 'Vikram & Srilekha',
        tag: 'Vishakapatnam'
      },
      {
        id: 'https://youtu.be/bHG22aGzQL4',
        title: 'Kushal & Indu Priya',
        tag: 'Honnavar'
      },
      {
        id: 'https://youtu.be/8CtwwPF7jU0',
        title: 'Gyanadeep & Grayathri',
        tag: 'Hyderabad'
      },
      {
        id: 'https://youtu.be/JF0uOamiEqc',
        title: 'Srikanth & Neha',
        tag: 'Ooty'
      },
      {
        id: 'https://youtu.be/fv6gI9W_B1k',
        title: 'Manoj & Likitha',
        tag: 'Mumbai'
      },
      {
        id: 'https://youtu.be/LqieRmqoVaY',
        title: 'Santhosh & Yanvitha',
        tag: 'Visakhapatnam'
      },
      {
        id: 'https://youtu.be/gQJ0bX8ODME',
        title: 'Nagasai & Geethavani',
        tag: 'Goa'
      }
    ]
  }
];


/* Extract YouTube video ID safely */

const ytId = value => {
  const input = String(value).trim();

  const match = input.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/
  );

  return match ? match[1] : input;
};


function thumbList(category, video, i) {
  const id = ytId(video.id);
  const number = String(i + 1).padStart(2, '0');

  return [
    ...(video.thumb ? [video.thumb] : []),

    ...['jpg', 'jpeg', 'png', 'webp'].map(ext =>
      imageUrl(`src/films/${category.folder}/${number}.${ext}`)
    ),

    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  ];
}


$('#filmSections').innerHTML = FILMS.map((category, ci) => `
  <div class="fcat">
    <h2>${category.title}</h2>

    ${ci === 0
      ? '<p class="sub">Tap a film to watch it right here.</p>'
      : ''
    }

    <div class="rail">
      <button
        type="button"
        class="rarr l"
        aria-label="Previous films"
        hidden
      >‹</button>

      <div class="films track">
        ${category.videos.map((video, i) => `
          <button
            class="vid"
            data-c="${ci}"
            data-i="${i}"
            aria-label="Play ${video.title}"
          >
            <img
              loading="lazy"
              alt=""
              data-n="0"
              data-s='${JSON.stringify(thumbList(category, video, i))}'
            >

            <span class="pl"></span>

            <span class="meta">
              <h3>${video.title}</h3>
              <small>${video.tag || ''}</small>
            </span>
          </button>
        `).join('')}
      </div>

      <button
        type="button"
        class="rarr r"
        aria-label="Next films"
        hidden
      >›</button>
    </div>
  </div>
`).join('');


$('#filmSections').querySelectorAll('.rail').forEach(rail);

$('#filmSections').querySelectorAll('img').forEach(img => {
  const sources = JSON.parse(img.dataset.s);

  const next = () => {
    const n = +img.dataset.n;

    if (n < sources.length) {
      img.dataset.n = n + 1;
      img.src = sources[n];
    } else {
      img.style.display = 'none';
    }
  };

  img.addEventListener('error', next);
  next();
});


/* =========================================================
   VIDEO POPUP
   ========================================================= */

function openVB(categoryIndex, videoIndex) {
  const video = FILMS[categoryIndex].videos[videoIndex];

  $('#vt').textContent = video.title;

  const id = ytId(video.id);

  $('#vframe').innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1"
      title="${video.title}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen
    ></iframe>
  `;

  $('#vyt').href =
    `https://www.youtube.com/watch?v=${id}`;

  $('#vb').classList.add('open');
}

function closeVB() {
  $('#vb').classList.remove('open');
  $('#vframe').innerHTML = '';
}

$('#filmSections').onclick = e => {
  const button = e.target.closest('.vid');

  if (button) {
    openVB(+button.dataset.c, +button.dataset.i);
  }
};

$('#vclose').onclick = closeVB;

$('#vb').addEventListener('click', e => {
  if (e.target.id === 'vb') closeVB();
});

addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#vb').classList.contains('open')) {
    closeVB();
  }
});


/* =========================================================
   LIGHTBOX
   ========================================================= */

let LB = {
  urls: [],
  i: 0
};

function showLB() {
  LB.i = (LB.i + LB.urls.length) % LB.urls.length;
  $('#lbart').src = LB.urls[LB.i];
}

function openLB(urls, i) {
  LB = {
    urls,
    i
  };

  showLB();
  $('#lb').classList.add('open');
}

$('#close').onclick = () => {
  $('#lb').classList.remove('open');
};

$('#prev').onclick = () => {
  LB.i--;
  showLB();
};

$('#next').onclick = () => {
  LB.i++;
  showLB();
};

addEventListener('keydown', e => {
  if (!$('#lb').classList.contains('open')) return;

  if (e.key === 'Escape') $('#close').click();
  if (e.key === 'ArrowRight') $('#next').click();
  if (e.key === 'ArrowLeft') $('#prev').click();
});


/* =========================================================
   ENQUIRY FORM
   Cloudflare Pages Function + Resend
   ========================================================= */

const F = $('#enqForm');

const evs = [
  ...F.querySelectorAll('input[name=events]')
];

const panels = [
  ...F.querySelectorAll('.panel')
];

const send = $('#send');

const pw = evs.find(i => i.dataset.k === 'prewedding');

const haldi = F.querySelector('.panel[data-k=haldi]');

let autoPre = false;


/* Set minimum date to today */

$('#date').min = new Date(
  Date.now() - new Date().getTimezoneOffset() * 6e4
).toISOString().slice(0, 10);


/* Get selected radio value */

const pick = name => {
  const selected = F.querySelector(
    `input[name=${name}]:checked`
  );

  return selected ? selected.value : '';
};


/* Format date */

function fmt(date) {
  return date
    ? new Date(date + 'T00:00').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : '';
}


/* Additional event details */

const detail = {
  engagement: () => pick('engagement_coverage'),

  prewedding: () => pick('prewedding_type'),

  haldi: () => [
    ...haldi.querySelectorAll('input:checked')
  ].map(i => i.value).join(' + '),

  sangeeth: () => pick('sangeeth_coverage'),

  reception: () => pick('reception_coverage'),

  albums: () => pick('album_sheets')
};


/* Update form visibility and enquiry summary */

function sync() {
  const service = F.service.value;

  const wedding =
    service === 'Wedding' ||
    service === 'Wedding and Pre-wedding';

  const prewedding = service === 'Pre-wedding';

  $('#evBox').hidden = !wedding;

  evs.forEach(input => {
    input.disabled = !wedding;
  });

  const lock = service === 'Wedding and Pre-wedding';

  if (lock) {
    pw.checked = true;
    autoPre = true;
  } else if (autoPre) {
    pw.checked = false;
    autoPre = false;
  }

  pw.closest('.opt').classList.toggle('locked', lock);

  panels.forEach(panel => {
    const key = panel.dataset.k;

    const show = prewedding
      ? key === 'prewedding'
      : wedding && evs.some(input =>
          input.dataset.k === key && input.checked
        );

    panel.hidden = !show;

    panel.querySelectorAll('input').forEach(input => {
      input.disabled = !show;
    });
  });

  if (!haldi.hidden) {
    const [bride, groom, couple] =
      haldi.querySelectorAll('input');

    couple.disabled = bride.checked || groom.checked;

    bride.disabled = couple.checked;
    groom.disabled = couple.checked;

    const valid = [bride, groom, couple].some(input => input.checked);

    bride.setCustomValidity(
      valid
        ? ''
        : 'Please choose Bride, Groom, both, or Couple.'
    );
  }

  evs[0].setCustomValidity(
    wedding && !evs.some(input => input.checked)
      ? 'Please choose at least one event.'
      : ''
  );

  const parts = prewedding
    ? [['Pre-wedding', detail.prewedding()]]
    : wedding
      ? evs
          .filter(input => input.checked)
          .map(input => [
            input.value,
            (detail[input.dataset.k] || (() => ''))()
          ])
      : [];

  const eventSummary = parts
    .map(([name, value]) =>
      value ? `${name} (${value})` : name
    )
    .join(', ');

  $('#summary').value =
    `${service}: ${eventSummary || '-'}`;

  send.disabled = !$('#consent').checked;

  $('#err').textContent = '';
}


/* Listen for form changes */

F.addEventListener('input', sync);
F.addEventListener('change', sync);


/* =========================================================
   FORM SUBMISSION
   ========================================================= */

F.addEventListener('submit', async e => {
  e.preventDefault();

  sync();

  if (!F.checkValidity()) {
    F.reportValidity();
    return;
  }

  send.disabled = true;
  send.textContent = 'Sending…';

  $('#err').textContent = '';

  try {
    const response = await fetch('/api/enquiry', {
      method: 'POST',
      body: new FormData(F)
    });

    const data = await response.json().catch(() => ({
      success: false
    }));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || 'Enquiry submission failed'
      );
    }

    const name = F.elements
      .namedItem('name')
      .value
      .trim()
      .split(' ')[0];

    $('#dname').textContent = name ? ', ' + name : '';

    F.hidden = true;

    $('#done').hidden = false;

    $('#done').scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

  } catch (error) {
    console.error('Enquiry submission error:', error);

    $('#err').textContent =
      'Sorry, that did not go through. Please try again in a moment or contact us on WhatsApp.';

    send.textContent = 'Send enquiry';
    send.disabled = false;
  }
});


/* Initial form setup */

sync();
