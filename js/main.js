
const $ = s => document.querySelector(s);

/* =========================================================
   IMAGEKIT CONFIGURATION
   ========================================================= */

const IMAGEKIT_BASE = 'https://ik.imagekit.io/goamqjl1w7';

const imageUrl = path =>
  `${IMAGEKIT_BASE}/${String(path).replace(/^\/+/, '')}`;

// Deliver appropriately sized, modern-format images for carousel previews.
// The original URL is retained for the full-screen lightbox.
const previewUrl = (url, width = 1100) =>
  `${url}${url.includes('?') ? '&' : '?'}tr=w-${width},q-78,f-auto`; 


/* =========================================================
   GALLERY CATEGORIES
   ========================================================= */

const CATS = [
  {
    id: 'weddings',
    title: 'Weddings',
    subs: [
      'Ajay & Leela',
      'Santhosh & Yanvita',
      'Ajay & Madhuri',
      'Vikram & Sri Lekha',
      'Harsha & Harika',
      'Sravan & Renuka',
      'Nagendra & Pavani',
      'Nagasai & Geetha',
      'Lakshman & Dhanalakshmi',
      'Raja & Mahitha',
      'Charan & Priyanka',
    ]
  },
    {
    id: 'pre-weddings',
    title: 'Pre-weddings',
    subs: [
      'Manoj & Likhitha',
      'Jaikanth & Manasa',
      'Sravan & Mounika',
      'Santhosh & Yanvita',
      'Vikram & Sri Lekha',
      'Kushal & Indu Priya',
      'Siva & Likitha',
      'Mahender & Swathi',
      'Nagendra & Pavani',
      'Madhan & Hari Priya',
      'Ajay & Madhuri',
    ]
  },
  {
    id: 'engagement',
    title: 'Engagement',
    subs: [
      'Mahender & Swathi',
      'Sai & Geetha',
      'Santhosh & Yanvita',
      'Ajay & Leela',
      'Lakshman & Dhanalakshmi',
      'Yeshwanth & Bhavana',
    ]
  },
  {
    id: 'haldi',
    title: 'Haldi',
    subs: [
      'Nagendra & Pavani',
      'Santhosh & Yanvita',
      'Manasa',
      'Sri Lekha',
      'Sai & Geetha',
      'Lakshmi',
    ]
  },
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
  // Most albums are short. Probe extensions for each index concurrently,
  // while keeping index order so a missing number still ends the album.
  // This avoids the old serial JPG -> JPEG -> PNG -> WEBP network waterfall.
  const MAX_IMAGES = 36;
  for (let n = 1; n <= MAX_IMAGES; n++) {
    const nn = String(n).padStart(2, '0');
    const candidates = await Promise.all(EXT.map(async ext => {
      const url = imageUrl(`${folder}/${nn}.${ext}`);
      return await probe(url) ? url : null;
    }));
    const found = candidates.find(Boolean);
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

  // Load the transformed preview first, but fall back to the original
  // ImageKit asset if the transformation URL is unavailable or rejected.
  // This prevents a valid original image from becoming a blank carousel slide.
  const imageLoads = new Map();

  const load = i => {
    const slide = slides[i];
    if (!slide) return Promise.resolve(false);

    if (imageLoads.has(i)) return imageLoads.get(i);

    const promise = new Promise(resolve => {
      const candidates = [previewUrl(urls[i], 1100), urls[i]];
      let candidateIndex = 0;

      const tryNext = () => {
        if (candidateIndex >= candidates.length) {
          resolve(false);
          return;
        }

        const candidate = candidates[candidateIndex++];
        const img = new Image();
        img.decoding = 'async';

        img.onload = async () => {
          try {
            if (img.decode) await img.decode();
          } catch (_) {
            // The load event is sufficient on browsers without decode support.
          }

          slide.style.backgroundImage = `url("${candidate}")`;
          resolve(true);
        };

        img.onerror = tryNext;
        img.src = candidate;
      };

      tryNext();
    });

    imageLoads.set(i, promise);
    return promise;
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

  car.addEventListener('pointercancel', () => {
    startX = null;
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

    // Wait for the actual slide preview (with original-image fallback)
    // before revealing the first slide. Previously only the original URL
    // was tested, while the transformed preview could fail and leave the
    // carousel showing an empty dark panel.
    load(0).then(loaded => {
      if (destroyed) return;

      if (!loaded) {
        root.classList.add('carousel-image-error');
        return;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (destroyed) return;

          go(0, true);
          load(1 % N);
          setTimeout(play, options.delay || 0);
        });
      });
    });
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
    'Beyond what is seen, lies everything worth remembering.The quiet emotions, the fleeting moments and the beautiful imperfections that make every story extraordinary. Captured with intention, preserved with meaning.';
}

/* cached size + paused when the headline is off-screen / tab hidden
   (same animation, but no forced layout every frame) */
let hlW = 0, hlH = 0, hlVisible = true;
const measureHl = () => {
  const r = hl.getBoundingClientRect();
  hlW = r.width; hlH = r.height;
};
measureHl();
addEventListener('resize', measureHl);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureHl);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(es => { hlVisible = es[0].isIntersecting; }).observe(hl);
}

(function loop(t) {
  if (!moved && hlVisible && !document.hidden) {
    hl.style.setProperty('--x', (hlW * 0.5 + Math.sin(t / 1100) * hlW * 0.4) + 'px');
    hl.style.setProperty('--y', (hlH * 0.5 + Math.cos(t / 800) * hlH * 0.15) + 'px');
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

  // Discover and load each album only shortly before it enters the viewport.
  // Previously every album in a category started probing dozens of URLs at once.
  const albumObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          albumObserver.unobserve(entry.target);
          loadAlbum(entry.target);
        });
      }, { rootMargin: '500px 0px' })
    : null;

  async function loadAlbum(element) {
    if (element.dataset.loading === '1') return;
    element.dataset.loading = '1';
    const k = Number(element.id.replace('sc', ''));
    const folder = `src/gallery/${category.id}/carousel-${k + 1}`;
    const urls = await findImages(folder);
    if (!document.body.contains(element)) return;
    if (!urls.length) {
      element.innerHTML = '<p class="empty">No images available.</p>';
      return;
    }
    stops.push(carousel(element, urls, {
      interval: 4200,
      delay: Math.min(k, 3) * 350,
      open: openLB
    }));
  }

  category.subs.forEach((title, k) => {
    const element = $('#sc' + k);
    if (albumObserver) albumObserver.observe(element);
    else loadAlbum(element);
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
        id: 'https://youtu.be/VdXFoYAH_kY',
        title: 'Nagendra & Pavani',
        tag: 'Hyderabad'
      },
      {
        id: 'https://youtu.be/7eQJ8v5bbp0',
        title: 'Lakshman & Dhanalakshmi',
        tag: 'Vishakapatnam'
      },
       {
        id: 'https://youtu.be/8L4Z5xoqiK4',
        title: 'Vikram & Sri Lekha',
        tag: 'Hyderabad'
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


/* Blurred header bar after scrolling */
(()=>{const n=document.querySelector('nav'),f=()=>n.classList.toggle('scrolled',scrollY>30);addEventListener('scroll',f,{passive:true});f()})();

