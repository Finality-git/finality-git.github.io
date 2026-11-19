const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mobile nav
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

// Header turns solid after scrolling
const header = document.querySelector('.site-header');
if (header && !header.classList.contains('is-solid')) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Reveal on scroll
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12 })
  : null;
document.querySelectorAll('.reveal').forEach(el => io ? io.observe(el) : el.classList.add('in'));

// Hero slideshow
const hero = document.querySelector('.hero');
if (hero) {
  const slides = [...hero.querySelectorAll('.slide')];
  const dots = [...hero.querySelectorAll('.hero-dots button')];
  const SLIDE_MS = 7000;
  hero.style.setProperty('--slide-time', SLIDE_MS + 'ms');
  let current = 0, timer = null;

  const show = i => {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, n) => {
      s.classList.toggle('is-active', n === current);
      s.setAttribute('aria-hidden', n === current ? 'false' : 'true');
      s.querySelectorAll('a').forEach(a => a.tabIndex = n === current ? 0 : -1);
    });
    dots.forEach((d, n) => {
      d.classList.remove('is-active');
      void d.offsetWidth; // restart progress bar animation
      d.classList.toggle('is-active', n === current);
      d.setAttribute('aria-current', n === current ? 'true' : 'false');
    });
  };
  const start = () => { if (reduceMotion) return; stop(); timer = setInterval(() => show(current + 1), SLIDE_MS); hero.classList.remove('paused'); };
  const stop = () => { clearInterval(timer); timer = null; hero.classList.add('paused'); };

  dots.forEach((d, n) => d.addEventListener('click', () => { show(n); start(); }));
  hero.addEventListener('mouseenter', stop);
  hero.addEventListener('mouseleave', start);
  hero.addEventListener('focusin', stop);
  hero.addEventListener('focusout', start);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

  show(0);
  start();
}

// Realm panels: tap to open on touch / keyboard
const realms = [...document.querySelectorAll('.realm')];
realms.forEach(r => {
  const open = () => realms.forEach(o => o.classList.toggle('is-open', o === r));
  r.addEventListener('click', open);
  r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
});

// Footer year
document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

// Nav: "Log in" becomes "Dashboard" once someone is logged in to a beta account.
try {
  if (localStorage.getItem('finality_beta_token')) {
    document.querySelectorAll('[data-account-link]').forEach(a => {
      a.textContent = 'Dashboard';
      a.href = a.getAttribute('href').replace('login.html', 'portal.html');
    });
  }
} catch {}
