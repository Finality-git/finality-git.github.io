// Finality Studios beta: sign-up, login, tester dashboard and admin.
// Talks to the studio API (shapify-api on Render, routes under /api/beta).
(() => {
  'use strict';

  // ---------- API ----------
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = (() => {
    try { const o = localStorage.getItem('finality_beta_api'); if (o) return o.replace(/\/$/, ''); } catch {}
    return LOCAL ? 'http://localhost:4000/api/beta' : 'https://shapify-api.onrender.com/api/beta';
  })();
  const TOKEN_KEY = 'finality_beta_token';
  const store = {
    get() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
    set(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch {} },
    clear() { try { localStorage.removeItem(TOKEN_KEY); } catch {} },
  };

  // The free server sleeps when idle and takes up to a minute to wake.
  let wakeNote = null;
  function showWaking(on) {
    if (on && !wakeNote) {
      wakeNote = document.createElement('div');
      wakeNote.className = 'wake-note';
      wakeNote.setAttribute('role', 'status');
      wakeNote.textContent = 'Waking up the beta server… this can take up to a minute the first time.';
      document.body.appendChild(wakeNote);
    } else if (!on && wakeNote) { wakeNote.remove(); wakeNote = null; }
  }

  let pending = 0;
  async function api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = store.get();
    if (auth && token) headers.Authorization = 'Bearer ' + token;
    pending++;
    const timer = setTimeout(() => showWaking(true), 4000);
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new Error("Couldn't reach the beta server. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
      if (--pending === 0) showWaking(false);
    }
    let data = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401 && auth) {
      store.clear();
      if (!/login\.html$/.test(location.pathname)) { location.href = 'login.html?expired=1'; return new Promise(() => {}); }
    }
    if (!res.ok) { const e = new Error(data.error || 'Something went wrong. Please try again.'); e.status = res.status; throw e; }
    return data;
  }

  // ---------- Small DOM helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const stars = n => '<span class="stars" aria-label="' + n + ' out of 5 stars">' + '★'.repeat(n) + '<span>' + '★'.repeat(5 - n) + '</span></span>';
  function setStatus(el, kind, msg) { el.className = 'form-status' + (kind ? ' ' + kind : ''); el.textContent = msg || ''; }
  function busy(button, on, label) {
    if (on) { button.dataset.label = button.innerHTML; button.disabled = true; button.textContent = label || 'Please wait…'; }
    else { button.disabled = false; if (button.dataset.label) button.innerHTML = button.dataset.label; }
  }
  function fieldError(id, msg) {
    const input = document.getElementById(id), err = document.getElementById(id + '-error');
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
    return !msg;
  }
  // Show / hide password buttons
  document.querySelectorAll('[data-toggle-password]').forEach(btn => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.togglePassword);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
    btn.setAttribute('aria-pressed', String(show));
  }));

  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

  // ---------- Register (beta.html) ----------
  const registerForm = $('#register-form');
  if (registerForm) {
    if (store.get()) $('#signed-in-note')?.removeAttribute('hidden');
    const status = $('#form-status');
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      setStatus(status);
      const v = id => document.getElementById(id).value;
      const checks = [
        fieldError('name', v('name').trim().length >= 2 ? '' : 'Please enter your name.'),
        fieldError('email', emailOk(v('email')) ? '' : 'Please enter a valid email address.'),
        fieldError('password', v('password').length >= 8 ? '' : 'Use at least 8 characters.'),
        fieldError('discord', !v('discord').trim() || /^[A-Za-z0-9_.#]{2,37}$/.test(v('discord').trim()) ? '' : 'Discord usernames use letters, numbers, dots and underscores.'),
        fieldError('consent', $('#consent').checked ? '' : 'Please tick the box to register.'),
      ];
      if (checks.includes(false)) { registerForm.querySelector('[aria-invalid="true"]')?.focus(); return; }
      const button = registerForm.querySelector('button[type="submit"]');
      busy(button, true, 'Creating your account…');
      try {
        const data = await api('/register', {
          method: 'POST', auth: false,
          body: {
            name: v('name'), email: v('email'), password: v('password'), discord: v('discord'),
            interests: [...registerForm.querySelectorAll('input[name="interests"]:checked')].map(i => i.value),
            consent: $('#consent').checked, website: v('website'),
          },
        });
        if (data.token) { store.set(data.token); location.href = 'portal.html'; }
        else registerForm.innerHTML = '<div class="success"><h2>Thanks!</h2></div>';
      } catch (err) {
        setStatus(status, 'err', err.message);
        busy(button, false);
      }
    });
  }

  // ---------- Login (login.html) ----------
  const loginForm = $('#login-form');
  if (loginForm) {
    const status = $('#form-status');
    if (/expired=1/.test(location.search)) setStatus(status, 'err', 'Please log in again.');
    else if (store.get()) { location.replace('portal.html'); return; }
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      setStatus(status);
      const email = $('#email').value, password = $('#password').value;
      const ok = [fieldError('email', emailOk(email) ? '' : 'Please enter your email.'), fieldError('password', password ? '' : 'Please enter your password.')];
      if (ok.includes(false)) return;
      const button = loginForm.querySelector('button[type="submit"]');
      busy(button, true, 'Logging in…');
      try {
        const data = await api('/login', { method: 'POST', auth: false, body: { email, password } });
        store.set(data.token);
        location.href = data.account.role === 'admin' ? 'admin.html' : 'portal.html';
      } catch (err) {
        setStatus(status, 'err', err.message);
        busy(button, false);
      }
    });
  }

  // ---------- Forgot password (forgot.html) ----------
  const forgotForm = $('#forgot-form');
  if (forgotForm) {
    const resetForm = $('#reset-form');
    let resetEmail = '';
    const showReset = (email, justSent) => {
      resetEmail = email;
      forgotForm.hidden = true;
      resetForm.hidden = false;
      $('#reset-intro').hidden = !email;
      $('#reset-email-field').hidden = !!email;
      if (email) {
        $('#reset-intro').innerHTML = (justSent ? 'We sent a code to <strong></strong> if it has a beta account. It expires in 15 minutes.' : 'Enter the code we emailed to <strong></strong>.');
        $('#reset-intro strong').textContent = email;
      }
      (email ? $('#code') : $('#reset-email-input')).focus();
    };
    async function sendCode(email, statusEl, button) {
      busy(button, true, 'Sending…');
      try {
        await api('/forgot-password', { method: 'POST', auth: false, body: { email } });
        return true;
      } catch (err) { setStatus(statusEl, 'err', err.message); return false; }
      finally { busy(button, false); }
    }
    forgotForm.addEventListener('submit', async e => {
      e.preventDefault();
      const status = $('#forgot-status');
      setStatus(status);
      const email = $('#email').value.trim();
      if (!fieldError('email', emailOk(email) ? '' : 'Please enter a valid email address.')) return;
      if (await sendCode(email, status, forgotForm.querySelector('button[type="submit"]'))) showReset(email, true);
    });
    $('#have-code').addEventListener('click', () => showReset(emailOk($('#email').value) ? $('#email').value.trim() : ''));
    $('#resend').addEventListener('click', async e => {
      const status = $('#reset-status');
      const email = resetEmail || $('#reset-email-input').value.trim();
      if (!emailOk(email)) { setStatus(status, 'err', 'Enter your email first.'); return; }
      setStatus(status);
      if (await sendCode(email, status, e.target)) setStatus(status, 'ok', 'If a beta account exists for that email, a new code is on its way. Codes can be sent once a minute.');
    });
    resetForm.addEventListener('submit', async e => {
      e.preventDefault();
      const status = $('#reset-status');
      setStatus(status);
      const email = resetEmail || $('#reset-email-input').value.trim();
      const code = $('#code').value.replace(/\D/g, '');
      const password = $('#new-password').value;
      const ok = [
        resetEmail || fieldError('reset-email-input', emailOk(email) ? '' : 'Please enter your email.'),
        fieldError('code', code.length === 6 ? '' : 'Enter the 6-digit code from the email.'),
        fieldError('new-password', password.length >= 8 ? '' : 'Use at least 8 characters.'),
      ];
      if (ok.includes(false)) return;
      const button = resetForm.querySelector('button[type="submit"]');
      busy(button, true, 'Saving…');
      try {
        const data = await api('/reset-password', { method: 'POST', auth: false, body: { email, code, password } });
        store.set(data.token);
        setStatus(status, 'ok', 'Password changed. Taking you to your dashboard…');
        setTimeout(() => { location.href = data.account.role === 'admin' ? 'admin.html' : 'portal.html'; }, 900);
      } catch (err) { setStatus(status, 'err', err.message); busy(button, false); }
    });
  }

  // Log out buttons
  document.querySelectorAll('[data-logout]').forEach(b => b.addEventListener('click', () => { store.clear(); location.href = 'login.html'; }));

  // ---------- Tabs (portal + admin) ----------
  function tabs(root, onShow) {
    const buttons = [...root.querySelectorAll('[role="tab"]')];
    const show = (btn, focus) => {
      buttons.forEach(b => {
        const on = b === btn;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        document.getElementById(b.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) btn.focus();
      try { history.replaceState(null, '', '#' + btn.dataset.tab); } catch {}
      onShow(btn.dataset.tab);
    };
    buttons.forEach((b, i) => {
      b.addEventListener('click', () => show(b));
      b.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); show(buttons[(i + d + buttons.length) % buttons.length], true); }
      });
    });
    const start = buttons.find(b => '#' + b.dataset.tab === location.hash) || buttons[0];
    show(start);
    return name => show(buttons.find(b => b.dataset.tab === name), true);
  }

  // ---------- Tester dashboard (portal.html) ----------
  const portal = $('#portal');
  if (portal) {
    if (!store.get()) { location.replace('login.html'); return; }
    initPortal().catch(err => { $('#portal-loading').textContent = err.message; });
  }

  async function initPortal() {
    const { account } = await api('/me');
    $('#portal-loading').hidden = true;
    document.querySelectorAll('[data-account-name]').forEach(el => el.textContent = account.name);
    if (account.role === 'admin') $('#admin-link').hidden = false;
    $('#portal-foot').hidden = false;
    $('[data-delete-account]').addEventListener('click', async e => {
      if (!confirm('Delete your beta account? This removes your account and every review, bug report and suggestion you sent. It cannot be undone.')) return;
      busy(e.target, true, 'Deleting…');
      try { await api('/me', { method: 'DELETE' }); store.clear(); location.href = 'index.html'; }
      catch (err) { alert(err.message); busy(e.target, false); }
    });

    if (account.status !== 'approved') {
      const box = $('#review-state');
      box.hidden = false;
      if (account.status === 'rejected') {
        box.classList.add('is-rejected');
        $('#review-title').textContent = "Your beta request wasn't accepted";
        $('#review-text').textContent = "Thank you for signing up. We couldn't add you to the testing team this time, but we'll open more places in future betas.";
        if (account.rejectReason) { $('#review-reason').hidden = false; $('#review-reason').textContent = 'Note from the team: ' + account.rejectReason; }
      } else {
        $('#review-text').textContent = "Thanks for registering, " + account.name + ". Our team reviews every request. When yours is approved, we'll email " + account.email + " and the full dashboard opens here.";
      }
      $('#review-date').textContent = 'Requested ' + fmtDate(account.createdAt);
      return;
    }

    $('#dashboard').hidden = false;
    let go = () => {};
    let projectCache = null;
    const myProjects = async (force) => (projectCache && !force) ? projectCache : (projectCache = (await api('/my/projects')).projects);

    // Fill the project pickers in the feedback forms
    async function fillPickers(force) {
      const list = await myProjects(force);
      document.querySelectorAll('select[data-projects]').forEach(sel => {
        const keep = sel.value;
        const general = sel.dataset.projects === 'general' ? '<option value="general">The studio in general</option>' : '';
        sel.innerHTML = general + list.map(p => '<option value="' + esc(p.slug) + '">' + esc(p.name) + '</option>').join('');
        if (keep) sel.value = keep;
        const form = sel.closest('form');
        const none = !list.length && !general;
        form.querySelector('.needs-project').hidden = !none;
        form.querySelectorAll('input, textarea, select, button').forEach(el => el.disabled = none);
      });
    }

    function projectCard(p, { mine }) {
      const kind = p.kind === 'game' ? 'Game' : 'App';
      const state = p.status === 'coming-soon' ? '<span class="badge">Coming soon</span>' : p.status === 'closed' ? '<span class="badge">Closed</span>' : '<span class="badge badge-ok">Open for testing</span>';
      let action = '';
      if (p.joined) {
        action = (p.testLink ? '<a class="btn btn-gold btn-sm" href="' + esc(p.testLink) + '" target="_blank" rel="noopener">Get the test build <span class="arrow">→</span></a>'
          : '<p class="muted small">We\'ll add the test build link here and email you when it\'s ready.</p>')
          + (mine ? '' : '<span class="badge badge-ok">Joined</span>')
          + '<button class="link-btn" data-leave="' + esc(p.slug) + '">Leave project</button>';
      } else if (p.status === 'open') {
        action = '<button class="btn btn-gold btn-sm" data-join="' + esc(p.slug) + '">Join this test <span class="arrow">→</span></button>';
      }
      return '<article class="project-card kind-' + esc(p.kind) + '">'
        + (p.image ? '<img src="' + esc(p.image) + '" alt="" width="72" height="72" loading="lazy">' : '<div class="project-ph" aria-hidden="true">' + esc(p.name.charAt(0)) + '</div>')
        + '<div class="project-body"><div class="project-meta">' + kind + ' · ' + esc(p.platform) + ' ' + state + '</div>'
        + '<h3>' + esc(p.name) + '</h3><p>' + esc(p.summary) + '</p>'
        + (mine && p.joinedAt ? '<p class="muted small">Joined ' + fmtDate(p.joinedAt) + '</p>' : '')
        + '<div class="project-actions">' + action + '</div></div></article>';
    }

    portal.addEventListener('click', async e => {
      const join = e.target.closest('[data-join]'), leave = e.target.closest('[data-leave]');
      if (!join && !leave) return;
      const btn = join || leave;
      if (leave && !confirm('Leave this project? You can join again later.')) return;
      busy(btn, true, join ? 'Joining…' : 'Leaving…');
      try {
        if (join) await api('/projects/' + encodeURIComponent(join.dataset.join) + '/join', { method: 'POST' });
        else await api('/projects/' + encodeURIComponent(leave.dataset.leave) + '/join', { method: 'DELETE' });
        projectCache = null;
        const current = portal.querySelector('[role="tab"][aria-selected="true"]').dataset.tab;
        await loaders[current]();
      } catch (err) { alert(err.message); busy(btn, false); }
    });

    function list(el, items, render, empty) {
      el.innerHTML = items.length ? items.map(render).join('') : '<p class="empty">' + empty + '</p>';
    }
    const projectName = slug => (projectCache || []).find(p => p.slug === slug)?.name || slug || 'The studio in general';

    const loaders = {
      async discover() {
        const el = $('#discover-list');
        el.innerHTML = '<p class="muted">Loading projects…</p>';
        const { projects } = await api('/projects');
        list(el, projects, p => projectCard(p, { mine: false }), 'No projects are open for testing right now. Check back soon.');
      },
      async projects() {
        const el = $('#projects-list');
        el.innerHTML = '<p class="muted">Loading…</p>';
        list(el, await myProjects(true), p => projectCard(p, { mine: true }), 'You haven\'t joined any projects yet. <button class="link-btn" data-goto="discover">Find one in Discover</button>.');
      },
      async reviews() {
        await fillPickers();
        const { reviews } = await api('/reviews');
        list($('#reviews-list'), reviews, r => '<article class="entry"><div class="entry-head">' + stars(r.rating) + '<span class="muted small">' + esc(projectName(r.projectSlug)) + ' · ' + fmtDate(r.createdAt) + '</span></div><h4>' + esc(r.title) + '</h4><p>' + esc(r.body) + '</p></article>', 'Your reviews will show here.');
      },
      async bugs() {
        await fillPickers();
        const { bugs } = await api('/bugs');
        list($('#bugs-list'), bugs, b => '<article class="entry"><div class="entry-head"><span class="badge sev-' + esc(b.severity) + '">' + esc(b.severity) + '</span><span class="badge status-' + esc(b.status) + '">' + esc(b.status.replace('-', ' ')) + '</span><span class="muted small">' + esc(projectName(b.projectSlug)) + ' · ' + fmtDate(b.createdAt) + '</span></div><h4>' + esc(b.title) + '</h4><p>' + esc(b.steps) + '</p></article>', 'Bugs you report will show here, with their status.');
      },
      async suggestions() {
        await fillPickers();
        const { suggestions } = await api('/suggestions');
        list($('#suggestions-list'), suggestions, s => '<article class="entry"><div class="entry-head"><span class="muted small">' + esc(projectName(s.projectSlug)) + ' · ' + fmtDate(s.createdAt) + '</span></div><p>' + esc(s.body) + '</p></article>', 'Your suggestions will show here.');
      },
    };
    go = tabs($('#dashboard'), name => loaders[name]?.().catch(err => alert(err.message)));
    portal.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) go(g.dataset.goto); });

    // Rating picker
    const ratingInput = $('#review-rating');
    document.querySelectorAll('.rate button').forEach(b => b.addEventListener('click', () => {
      ratingInput.value = b.dataset.value;
      document.querySelectorAll('.rate button').forEach(x => {
        x.classList.toggle('on', Number(x.dataset.value) <= Number(b.dataset.value));
        x.setAttribute('aria-pressed', String(x === b));
      });
    }));

    // Feedback forms
    function feedbackForm(id, path, build, done, success) {
      const form = document.getElementById(id);
      const status = form.querySelector('.form-status');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        setStatus(status);
        let body;
        try { body = build(form); } catch (err) { setStatus(status, 'err', err.message); return; }
        const button = form.querySelector('button[type="submit"]');
        busy(button, true, 'Sending…');
        try {
          await api(path, { method: 'POST', body });
          form.reset();
          done?.();
          setStatus(status, 'ok', success);
          await loaders[form.dataset.reload]();
        } catch (err) { setStatus(status, 'err', err.message); }
        busy(button, false);
      });
    }
    const val = (form, name) => form.elements[name].value.trim();
    const need = (v, msg) => { if (!v) throw new Error(msg); return v; };

    feedbackForm('review-form', '/reviews', f => ({
      project: val(f, 'project'),
      rating: Number(need(ratingInput.value, 'Please pick a star rating.')),
      title: need(val(f, 'title'), 'Please give your review a title.'),
      body: need(val(f, 'body'), 'Please write your review.'),
    }), () => { ratingInput.value = ''; document.querySelectorAll('.rate button').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); }, 'Thanks! Your review was sent.');

    feedbackForm('bug-form', '/bugs', f => ({
      project: val(f, 'project'),
      title: need(val(f, 'title'), 'Please add a short title.'),
      steps: need(val(f, 'steps'), 'Please describe what happened.'),
      expected: val(f, 'expected'),
      device: val(f, 'device'),
      severity: val(f, 'severity'),
    }), null, 'Thanks! Your bug report was sent to the team.');

    feedbackForm('suggestion-form', '/suggestions', f => ({
      project: val(f, 'project'),
      body: need(val(f, 'body'), 'Please write your suggestion.'),
    }), null, 'Thanks! Your suggestion is in the box.');
  }

  // ---------- Admin (admin.html) ----------
  const adminRoot = $('#admin');
  if (adminRoot) {
    if (!store.get()) { location.replace('login.html'); return; }
    initAdmin().catch(err => { $('#admin-loading').textContent = err.status === 403 ? 'This page is for Finality Studios admins only.' : err.message; });
  }

  async function initAdmin() {
    const { account } = await api('/me');
    if (account.role !== 'admin') { const e = new Error(); e.status = 403; throw e; }
    $('#admin-loading').hidden = true;
    $('#admin-panel').hidden = false;
    document.querySelectorAll('[data-account-name]').forEach(el => el.textContent = account.name);

    async function summary() {
      const s = await api('/admin/summary');
      $('#sum-pending').textContent = s.pending;
      $('#sum-approved').textContent = s.approved;
      $('#sum-bugs').textContent = s.openBugs;
      $('#sum-feedback').textContent = s.reviews + s.suggestions;
      $('#pending-count').textContent = s.pending ? s.pending : '';
      $('#email-off').hidden = s.emailEnabled;
    }

    let requestStatus = 'pending';
    const projectNames = new Map();
    const loadProjectNames = async () => (await api('/admin/projects')).projects.forEach(p => projectNames.set(p.slug, p.name));
    const loaders = {
      async requests() {
        const el = $('#requests-list');
        el.innerHTML = '<p class="muted">Loading…</p>';
        const [{ accounts }] = await Promise.all([api('/admin/accounts?status=' + requestStatus), projectNames.size ? null : loadProjectNames()]);
        const interest = s => esc(projectNames.get(s) || s);
        const empty = { pending: 'No requests waiting for review.', approved: 'No approved testers yet.', rejected: 'No rejected requests.' }[requestStatus];
        el.innerHTML = accounts.length ? accounts.map(a => {
          const actions = [];
          if (a.status !== 'approved') actions.push('<button class="btn btn-gold btn-sm" data-approve="' + a.id + '">Approve</button>');
          if (a.status !== 'rejected' && a.role !== 'admin') actions.push('<button class="btn btn-ghost btn-sm" data-reject="' + a.id + '">Reject</button>');
          if (a.status !== 'pending' && a.role !== 'admin') actions.push('<button class="link-btn" data-repending="' + a.id + '">Move back to review</button>');
          return '<article class="entry request"><div class="request-main"><h4>' + esc(a.name) + (a.role === 'admin' ? ' <span class="badge">Admin</span>' : '') + '</h4>'
            + '<p class="small"><a href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a>' + (a.discord ? ' · Discord: ' + esc(a.discord) : '') + '</p>'
            + '<p class="muted small">Wants to test: ' + (a.interests.length ? a.interests.map(interest).join(', ') : 'anything') + ' · Requested ' + fmtDate(a.createdAt) + (a.reviewedAt ? ' · Reviewed ' + fmtDate(a.reviewedAt) : '') + '</p>'
            + (a.rejectReason ? '<p class="muted small">Reason given: ' + esc(a.rejectReason) + '</p>' : '')
            + '</div><div class="request-actions">' + actions.join('') + '</div></article>';
        }).join('') : '<p class="empty">' + empty + '</p>';
      },
      async bugs() {
        const filter = $('#bug-filter').value;
        const { bugs } = await api('/admin/bugs' + (filter ? '?status=' + filter : ''));
        $('#admin-bugs').innerHTML = bugs.length ? bugs.map(b => '<article class="entry"><div class="entry-head"><span class="badge sev-' + esc(b.severity) + '">' + esc(b.severity) + '</span><span class="muted small">' + esc(b.projectSlug) + ' · ' + fmtDate(b.createdAt) + ' · ' + esc(b.author.name) + ' (' + esc(b.author.email) + ')</span>'
          + '<label class="inline-select">Status <select data-bug="' + b.id + '">' + ['open', 'in-progress', 'fixed', 'wont-fix'].map(s => '<option value="' + s + '"' + (s === b.status ? ' selected' : '') + '>' + s.replace('-', ' ') + '</option>').join('') + '</select></label></div>'
          + '<h4>' + esc(b.title) + '</h4><p><strong>What happened:</strong> ' + esc(b.steps) + '</p>'
          + (b.expected ? '<p><strong>Expected:</strong> ' + esc(b.expected) + '</p>' : '') + (b.device ? '<p class="muted small">Device: ' + esc(b.device) + '</p>' : '') + '</article>').join('') : '<p class="empty">No bug reports.</p>';
      },
      async reviews() {
        const { reviews } = await api('/admin/reviews');
        $('#admin-reviews').innerHTML = reviews.length ? reviews.map(r => '<article class="entry"><div class="entry-head">' + stars(r.rating) + '<span class="muted small">' + esc(r.projectSlug) + ' · ' + fmtDate(r.createdAt) + ' · ' + esc(r.author.name) + '</span></div><h4>' + esc(r.title) + '</h4><p>' + esc(r.body) + '</p></article>').join('') : '<p class="empty">No reviews yet.</p>';
      },
      async suggestions() {
        const { suggestions } = await api('/admin/suggestions');
        $('#admin-suggestions').innerHTML = suggestions.length ? suggestions.map(s => '<article class="entry"><div class="entry-head"><span class="muted small">' + esc(s.projectSlug || 'General') + ' · ' + fmtDate(s.createdAt) + ' · ' + esc(s.author.name) + ' (' + esc(s.author.email) + ')</span></div><p>' + esc(s.body) + '</p></article>').join('') : '<p class="empty">The suggestion box is empty.</p>';
      },
      async projects() {
        const { projects } = await api('/admin/projects');
        $('#admin-projects').innerHTML = projects.map(p => '<form class="entry project-edit" data-slug="' + esc(p.slug) + '">'
          + '<div class="entry-head"><h4>' + esc(p.name) + '</h4><span class="muted small">' + p.testers + ' tester' + (p.testers === 1 ? '' : 's') + '</span></div>'
          + '<div class="grid-2"><label class="field"><span>Status</span><select name="status">' + [['open', 'Open for testing'], ['coming-soon', 'Coming soon'], ['closed', 'Closed (hidden from Discover)']].map(([v, l]) => '<option value="' + v + '"' + (v === p.status ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>'
          + '<label class="field"><span>Platform</span><input type="text" name="platform" value="' + esc(p.platform) + '" maxlength="60"></label></div>'
          + '<label class="field"><span>Description</span><textarea name="summary" rows="2" maxlength="400">' + esc(p.summary) + '</textarea></label>'
          + '<label class="field"><span>Test build link <span class="opt">(shown only to testers who joined, e.g. a Google Play testing link)</span></span><input type="url" name="testLink" value="' + esc(p.testLink) + '" placeholder="https://play.google.com/apps/testing/…" maxlength="500"></label>'
          + '<div class="row"><button class="btn btn-gold btn-sm" type="submit">Save</button><span class="form-status" role="status"></span></div></form>').join('');
      },
    };

    tabs($('#admin-panel'), name => loaders[name]?.().catch(err => alert(err.message)));
    summary();

    document.querySelectorAll('[data-request-filter]').forEach(b => b.addEventListener('click', () => {
      requestStatus = b.dataset.requestFilter;
      document.querySelectorAll('[data-request-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      loaders.requests();
    }));
    $('#bug-filter').addEventListener('change', () => loaders.bugs());

    adminRoot.addEventListener('click', async e => {
      const approve = e.target.closest('[data-approve]'), reject = e.target.closest('[data-reject]'), back = e.target.closest('[data-repending]');
      const btn = approve || reject || back;
      if (!btn) return;
      let body = {};
      if (reject) {
        const reason = prompt('Reject this request? Optional: a short note for the email (leave empty for none).', '');
        if (reason === null) return;
        body = { reason };
      }
      const id = btn.dataset.approve || btn.dataset.reject || btn.dataset.repending;
      const action = approve ? 'approve' : reject ? 'reject' : 'pending';
      busy(btn, true, '…');
      try {
        const r = await api('/admin/accounts/' + id + '/' + action, { method: 'POST', body });
        const note = $('#requests-note');
        note.className = 'form-status ok';
        note.textContent = action === 'pending' ? r.account.name + ' is back in the review queue.'
          : r.account.name + (action === 'approve' ? ' was approved' : ' was rejected') + (r.emailed ? ' and has been emailed.' : '. Email isn\'t set up on the server, so let them know yourself.');
        await Promise.all([loaders.requests(), summary()]);
      } catch (err) { alert(err.message); busy(btn, false); }
    });

    adminRoot.addEventListener('change', async e => {
      const sel = e.target.closest('select[data-bug]');
      if (!sel) return;
      sel.disabled = true;
      try { await api('/admin/bugs/' + sel.dataset.bug, { method: 'PATCH', body: { status: sel.value } }); summary(); }
      catch (err) { alert(err.message); }
      sel.disabled = false;
    });

    adminRoot.addEventListener('submit', async e => {
      const form = e.target.closest('.project-edit');
      if (!form) return;
      e.preventDefault();
      const status = form.querySelector('.form-status');
      const button = form.querySelector('button');
      busy(button, true, 'Saving…');
      try {
        await api('/admin/projects/' + encodeURIComponent(form.dataset.slug), {
          method: 'PATCH',
          body: { status: form.elements.status.value, platform: form.elements.platform.value, summary: form.elements.summary.value, testLink: form.elements.testLink.value },
        });
        setStatus(status, 'ok', 'Saved.');
      } catch (err) { setStatus(status, 'err', err.message); }
      busy(button, false);
    });
  }
})();
