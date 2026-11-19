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

// Beta sign-up form
const betaForm = document.getElementById('beta-form');
if (betaForm) {
  const status = document.getElementById('form-status');
  const button = betaForm.querySelector('button[type="submit"]');
  const fields = {
    name: v => v.trim().length >= 2 || 'Please enter your name.',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Please enter a valid email address.',
    discord: v => !v.trim() || /^[A-Za-z0-9_.#]{2,37}$/.test(v.trim()) || 'Discord usernames use letters, numbers, dots and underscores.',
  };

  const setError = (id, msg) => {
    const input = document.getElementById(id);
    const err = document.getElementById(id + '-error');
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
  };

  const validate = () => {
    let firstBad = null;
    for (const [id, check] of Object.entries(fields)) {
      const res = check(document.getElementById(id).value);
      setError(id, res === true ? '' : res);
      if (res !== true && !firstBad) firstBad = document.getElementById(id);
    }
    const consent = document.getElementById('consent');
    setError('consent', consent.checked ? '' : 'Please tick the box so we can contact you.');
    if (!consent.checked && !firstBad) firstBad = consent;
    if (firstBad) firstBad.focus();
    return !firstBad;
  };

  Object.keys(fields).forEach(id => document.getElementById(id).addEventListener('blur', e => {
    if (!e.target.value) return;
    const res = fields[id](e.target.value);
    setError(id, res === true ? '' : res);
  }));

  betaForm.addEventListener('submit', async e => {
    e.preventDefault();
    status.className = 'form-status'; status.textContent = '';
    if (!validate()) return;

    const endpoint = betaForm.dataset.endpoint;
    if (!endpoint) {
      status.className = 'form-status err';
      status.textContent = "Beta registration isn't open yet. Please check back soon.";
      return;
    }

    const data = new FormData(betaForm);
    if (data.get('_gotcha')) return; // spam bot

    button.disabled = true;
    const label = button.innerHTML;
    button.textContent = 'Sending…';
    try {
      // Google Apps Script web app (writes a row to the studio's Google Sheet).
      // Google doesn't let other sites read its reply, so a sent request counts as success;
      // a network failure still throws and shows the error message.
      await fetch(endpoint, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(data) });
      betaForm.innerHTML = '<div class="success" role="status"><div class="big" aria-hidden="true">✦</div><h2>You\'re on the list.</h2><p>Thanks for registering. If you\'re selected for the beta team, we\'ll email you with everything you need to get started.</p></div>';
    } catch (err) {
      status.className = 'form-status err';
      status.textContent = 'Something went wrong sending your registration. Please try again in a moment, or email finalitystudioltd@gmail.com.';
      button.disabled = false;
      button.innerHTML = label;
    }
  });
}
