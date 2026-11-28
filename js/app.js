/* ============================================================
   CAP FIN — interface
   Écrans : connexion, tableau de bord, opérations, comptes,
   récurrences, projets, rapports, paramètres.
   Données : Cap75Data (Supabase + cache hors ligne)
   Calculs : Cap75Finance (fonctions pures)
   ============================================================ */
/* global location, history, URLSearchParams, FormData, getComputedStyle, AbortController */

(function () {
  'use strict';

  const F = window.Cap75Finance;
  const D = window.Cap75Data;
  const S = D.state;

  // ------------------------------------------------------------
  // Petits utilitaires
  // ------------------------------------------------------------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) =>
    String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  const base = () => (S.profile && S.profile.base_currency) || 'USD';
  const fmt = (v) => F.formatMoney(v, base());
  const fmtCur = (v, cur) => F.formatMoney(v, cur || 'USD');
  const today = () => F.todayISO();
  const fmtDate = (iso) => {
    const d = F.parseISODate(iso);
    return d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  };
  const pct = (v) => `${(Number(v) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

  const KINDS = { cash: 'Espèces', bank: 'Banque', mobile: 'Mobile money', savings: 'Épargne', other: 'Autre' };
  const FREQUENCIES = { weekly: 'Chaque semaine', monthly: 'Chaque mois', yearly: 'Chaque année' };
  const PROJECT_CATEGORIES = ['Investissement', 'Immobilier', 'Équipement', 'Réserve', 'Formation', 'Autre'];
  const CATEGORY_SUGGESTIONS = {
    Revenu: ['Salaire', 'Vente', 'Prime', 'Commission', 'Loyer perçu', 'Cadeau'],
    Dépense: ['Alimentation', 'Loyer', 'Transport', 'Santé', 'Scolarité', 'Électricité', 'Eau', 'Internet', 'Communication', 'Habillement', 'Loisirs', 'Famille'],
    Projet: PROJECT_CATEGORIES,
    Épargne: ['Épargne mensuelle', "Fonds d'urgence", 'Tontine', 'Likelemba'],
    Transfert: ['Transfert']
  };

  const ICON = {
    dashboard: '<path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6v-9h-6v9zm0-16v5h6V4h-6z"/>',
    operations: '<path d="M7 7h13M7 7l3-3M7 7l3 3M17 17H4m13 0-3-3m3 3-3 3"/>',
    accounts: '<path d="M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2"/>',
    recurring: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/>',
    projects: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    copy: '<path d="M9 9h11v11H9zM5 15H4V4h11v1"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="M7 4l13 8-13 8V4z"/>',
    archive: '<path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4"/>',
    transfer: '<path d="M4 9h14l-4-4M20 15H6l4 4"/>',
    logout: '<path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 20V8M7 13l5-5 5 5M4 4h16"/>',
    print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z"/>',
    coins: '<path d="M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    more: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.5 17.5 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
  };

  // Ajoute un bouton « afficher / masquer » à chaque champ mot de passe
  function enhancePasswords(scope) {
    $$('input[type=password]', scope || document).forEach((input) => {
      if (input.parentElement.classList.contains('pwd-wrap')) return;
      // Nom propre pour les lecteurs d'écran (sinon le bouton s'ajoute au libellé)
      const labelText = input.closest('.field') && input.closest('.field').querySelector(':scope > span');
      if (labelText && !input.getAttribute('aria-label')) input.setAttribute('aria-label', labelText.textContent.trim());
      const wrap = document.createElement('span');
      wrap.className = 'pwd-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pwd-toggle';
      btn.dataset.action = 'toggle-pwd';
      btn.setAttribute('aria-label', 'Voir la saisie');
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = icon('eye');
      wrap.appendChild(btn);
    });
  }

  function togglePassword(btn) {
    const input = btn.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Cacher la saisie' : 'Voir la saisie');
    btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
    input.focus();
    const end = input.value.length;
    try {
      input.setSelectionRange(end, end);
    } catch {
      /* certains types n'acceptent pas la sélection */
    }
  }
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;

  const LOGO = '<img class="brand-logo" src="./icons/logo-mark.png" alt="" width="32" height="32">';
  const BRAND = LOGO + '<span class="brand-name">CAP <b>FIN</b></span>';

  const VIEWS = [
    { id: 'dashboard', label: 'Tableau de bord', short: 'Accueil', icon: 'dashboard', month: true, mobile: true },
    { id: 'operations', label: 'Opérations', short: 'Opérations', icon: 'operations', month: true, mobile: true },
    { id: 'accounts', label: 'Comptes', short: 'Comptes', icon: 'accounts', mobile: true },
    { id: 'recurring', label: 'Récurrences', short: 'Récurrences', icon: 'recurring' },
    { id: 'projects', label: 'Projets', short: 'Projets', icon: 'projects' },
    { id: 'reports', label: 'Rapports', short: 'Rapports', icon: 'reports', month: true, mobile: true },
    { id: 'settings', label: 'Paramètres', short: 'Réglages', icon: 'settings' }
  ];

  const ui = {
    view: 'dashboard',
    month: F.monthKey(F.todayISO()),
    filters: { q: '', type: 'ALL', account: 'ALL', allMonths: false },
    projectFilter: 'ALL',
    session: null,
    authMode: 'signin',
    authNotice: null,
    pendingEmail: '',
    sync: { pending: 0, offline: !navigator.onLine },
    lastActivity: Date.now(),
    entering: false
  };

  const root = () => document.getElementById('root');

  // ------------------------------------------------------------
  // Notifications et fenêtres
  // ------------------------------------------------------------
  function toast(message, type, duration) {
    let box = $('.toasts');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = `toast ${type || ''}`;
    t.textContent = message;
    box.appendChild(t);
    setTimeout(() => t.remove(), duration || 3800);
  }

  function openModal(html, onMount) {
    closeModal();
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.id = 'modal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML = html;
    wrap.addEventListener('mousedown', (e) => {
      if (e.target === wrap) closeModal();
    });
    document.body.appendChild(wrap);
    if (onMount) onMount(wrap);
    const first = wrap.querySelector('input:not([type=hidden]):not([type=radio]):not([disabled]), select, .modal-actions .btn');
    if (first) first.focus();
    return wrap;
  }

  function closeModal() {
    const m = document.getElementById('modal');
    if (m) m.remove();
  }

  function confirmBox({ title, message, confirm, danger }) {
    return new Promise((resolve) => {
      const m = openModal(`
        <div class="modal-card small">
          <div class="modal-head"><h2>${esc(title)}</h2></div>
          <p class="muted">${esc(message)}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-answer="no">Annuler</button>
            <button class="btn ${danger ? 'btn-danger' : ''}" data-answer="yes">${esc(confirm || 'Confirmer')}</button>
          </div>
        </div>`);
      m.addEventListener('click', (e) => {
        const b = e.target.closest('[data-answer]');
        if (!b) return;
        closeModal();
        resolve(b.dataset.answer === 'yes');
      });
    });
  }

  function formError(form, message) {
    let n = $('.form-error', form);
    if (!n) {
      n = document.createElement('div');
      n.className = 'notice error form-error';
      n.setAttribute('role', 'alert');
      form.prepend(n);
    }
    n.textContent = message;
  }

  // ------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    // Refuse d'être affichée dans le cadre d'un autre site (protection anti-clickjacking)
    if (window.top !== window.self) {
      document.body.innerHTML = '';
      window.top.location = window.self.location.href;
      return;
    }
    registerServiceWorker();
    bindGlobalEvents();

    if (!D.isConfigured()) {
      renderConfigMissing();
      return;
    }
    try {
      D.init();
    } catch (err) {
      renderFatal(err.message);
      return;
    }

    D.on('sync', (s) => {
      ui.sync.offline = !navigator.onLine;
      updateSyncBadge();
      if (s && s.rejected && s.rejected.length) {
        toast('Une modification a été refusée par le serveur et annulée. Vérifiez les valeurs saisies.', 'error', 7000);
      }
    });
    D.on('change', (item) => {
      if (item && item.op === 'reload' && ui.session) renderView();
    });

    D.onAuthChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        ui.session = session;
        ui.authMode = 'new-password';
        renderAuth();
        return;
      }
      if (event === 'SIGNED_OUT') {
        ui.session = null;
        if (ui.authMode === 'new-password') ui.authMode = 'signin';
        renderAuth();
        return;
      }
      if (event === 'TOKEN_REFRESHED' && session) ui.session = session;
    });

    // Lien d'invitation : …/cap75/?inscription ouvre directement « Créer un compte »
    const params = new URLSearchParams(location.search);
    if (params.has('inscription') || params.get('mode') === 'signup') ui.authMode = 'signup';

    if (D.urlAuth.error) {
      ui.authNotice = { type: 'error', text: `Lien invalide ou expiré : ${D.urlAuth.error}` };
    }

    try {
      // Ne jamais rester bloqué sur « Chargement » : 8 s maximum pour récupérer la session
      const session = await Promise.race([
        D.getSession(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]).catch((err) => {
        if (err && err.message === 'timeout') {
          ui.authNotice = { type: 'warn', text: 'La connexion au serveur prend trop de temps. Vérifiez Internet puis réessayez, ou ouvrez le lien dans Chrome.' };
          return null;
        }
        throw err;
      });
      if (ui.authMode === 'new-password' && ui.session) {
        // L'évènement PASSWORD_RECOVERY a déjà affiché l'écran « Nouveau mot de passe »
      } else if (session && D.urlAuth.type === 'recovery') {
        ui.session = session;
        ui.authMode = 'new-password';
        renderAuth();
      } else if (session) {
        if (D.urlAuth.type === 'signup') toast('Adresse e-mail confirmée. Bienvenue sur CAP FIN !', 'success', 5000);
        await enterApp(session);
      } else {
        renderAuth();
      }
    } catch (err) {
      ui.authNotice = { type: 'error', text: err.message };
      renderAuth();
    }
    cleanUrl();
  }

  function cleanUrl() {
    if (location.hash && /access_token|error|type=/.test(location.hash)) {
      history.replaceState(null, '', location.pathname);
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              toast('Une nouvelle version de CAP FIN est prête. Rechargez la page pour l’utiliser.', 'success', 8000);
            }
          });
        });
      })
      .catch((err) => console.warn('[CAP FIN] Service worker :', err.message));
  }

  function bindGlobalEvents() {
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
      window.addEventListener(ev, () => {
        ui.lastActivity = Date.now();
      }, { passive: true })
    );
    setInterval(checkAutoLock, 30000);
    window.addEventListener('online', () => {
      ui.sync.offline = false;
      updateSyncBadge();
      if (ui.session) toast('Connexion rétablie. Synchronisation en cours.', 'success');
    });
    window.addEventListener('offline', () => {
      ui.sync.offline = true;
      updateSyncBadge();
      if (ui.session) toast('Hors ligne : vos saisies sont gardées et seront envoyées au retour du réseau.', 'warning', 6000);
    });
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (ui.session && ui.view === 'reports') drawHistoryChart();
      }, 150);
    });
  }

  function checkAutoLock() {
    if (!ui.session || !S.profile) return;
    const minutes = Number(S.profile.auto_lock_minutes) || 0;
    if (minutes <= 0) return;
    if (Date.now() - ui.lastActivity > minutes * 60000) {
      toast(`Déconnecté après ${minutes} minutes d'inactivité.`, 'warning', 6000);
      doSignOut();
    }
  }

  // ------------------------------------------------------------
  // Entrée dans l'appli
  // ------------------------------------------------------------
  async function enterApp(session) {
    if (ui.entering) return;
    ui.entering = true;
    ui.session = session;
    ui.lastActivity = Date.now();
    root().innerHTML = '<div class="splash">Chargement de vos comptes…</div>';
    try {
      const res = await D.load(session.user.id);
      if (res.source === 'cache') toast('Hors ligne : affichage de vos dernières données enregistrées.', 'warning', 6000);
      ensureBasics();
      const generated = runRecurring();
      if (generated > 0) toast(`${generated} opération(s) récurrente(s) ajoutée(s) automatiquement.`, 'success', 5000);
      renderApp();
      handleShortcut();
      refreshRates(false);
    } catch (err) {
      renderFatal(`Impossible de charger vos données : ${err.message}`);
    } finally {
      ui.entering = false;
    }
  }

  function ensureBasics() {
    if (!S.profile || !S.profile.created_at) {
      const meta = (ui.session.user && ui.session.user.user_metadata) || {};
      D.save('profiles', Object.assign({}, S.profile, {
        display_name: (S.profile && S.profile.display_name) || meta.display_name || emailName()
      }));
    }
    if (!S.accounts.length) {
      D.save('accounts', { id: F.uuid(), name: 'Caisse', kind: 'cash', currency: base(), opening_balance: 0, archived: false });
    }
  }

  function emailName() {
    const e = (ui.session && ui.session.user && ui.session.user.email) || '';
    return e.split('@')[0] || 'Utilisateur';
  }

  function runRecurring() {
    let count = 0;
    const t = today();
    S.recurring.slice().forEach((rec) => {
      const dates = F.dueDates(rec, t);
      if (!dates.length) return;
      dates.forEach((date) => {
        const exists = S.operations.some((o) => o.recurring_id === rec.id && o.date === date);
        if (!exists) {
          D.save('operations', F.operationFromRecurring(rec, date));
          count++;
        }
      });
      D.save('recurring', Object.assign({}, rec, { last_generated: dates[dates.length - 1] }));
    });
    return count;
  }

  function handleShortcut() {
    const p = new URLSearchParams(location.search);
    const view = p.get('view');
    if (view && VIEWS.some((v) => v.id === view)) go(view);
    if (p.get('action') === 'new-operation') openOperationModal();
    if (p.has('view') || p.has('action')) history.replaceState(null, '', location.pathname);
  }

  async function doSignOut() {
    try {
      await D.signOut();
    } catch {
      /* la session locale est effacée quoi qu'il arrive */
    }
    ui.session = null;
    ui.authMode = 'signin';
    closeModal();
    renderAuth();
  }

  // ------------------------------------------------------------
  // Écrans de connexion et d'erreur
  // ------------------------------------------------------------
  function renderConfigMissing() {
    root().innerHTML = `
      <div class="splash"><div class="auth-card" style="max-width:520px;padding:24px">
        <span class="brand-mark">${BRAND}</span>
        <h2>Connexion au serveur à configurer</h2>
        <p class="muted">Renseignez l'adresse du projet Supabase et sa clé publique dans <code>js/config.js</code>, puis rechargez la page.</p>
      </div></div>`;
  }

  function renderFatal(message) {
    root().innerHTML = `
      <div class="splash"><div class="auth-card" style="padding:24px">
        <span class="brand-mark">${BRAND}</span>
        <div class="notice error">${esc(message)}</div>
        <button class="btn" data-action="reload">Réessayer</button>
      </div></div>`;
  }

  function capPreview() {
    return `
      <div class="auth-cap">
        <div class="cap-track">
          <div class="cap-band" style="height:14px"><i class="seg dep" style="width:68%"></i><i class="seg proj" style="width:14%"></i><i class="seg epar" style="width:12%"></i></div>
          <div class="cap-ticks"><i style="left:75%"></i><i style="left:90%"></i></div>
        </div>
        <div class="cap-scale"><span style="left:0">0 %</span><span style="left:75%">75 %</span><span style="left:90%">90 %</span><span style="left:100%">100 %</span></div>
      </div>`;
  }

  function renderAuth() {
    const mode = ui.authMode;
    const notice = ui.authNotice ? `<div class="notice ${ui.authNotice.type}" role="alert">${esc(ui.authNotice.text)}</div>` : '';
    const pwdHint = '<small>8 caractères minimum, avec au moins une lettre et un chiffre.</small>';
    const cards = {
      signin: `
        <h2>Connexion</h2>
        <p class="lead">Retrouvez votre budget sur tous vos appareils.</p>
        ${notice}
        <form class="stack" data-form="signin" novalidate>
          <label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="email" required></label>
          <label class="field"><span>Mot de passe</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
          <button class="btn btn-block" type="submit">Se connecter</button>
        </form>
        <button class="link-btn" data-action="auth-mode" data-mode="forgot">Mot de passe oublié ?</button>
        <p class="auth-foot">Pas encore de compte ? <button class="link-btn" data-action="auth-mode" data-mode="signup">Créer un compte</button></p>`,
      signup: `
        <h2>Créer un compte</h2>
        <p class="lead">Gratuit. Un e-mail et un mot de passe suffisent.</p>
        ${notice}
        <form class="stack" data-form="signup" novalidate>
          <label class="field"><span>Votre nom</span><input class="input" name="name" autocomplete="name" maxlength="60" required></label>
          <label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="email" required></label>
          <label class="field"><span>Mot de passe</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="8" required>${pwdHint}</label>
          <label class="field"><span>Confirmer le mot de passe</span><input class="input" type="password" name="confirm" autocomplete="new-password" required></label>
          <button class="btn btn-block" type="submit">Créer mon compte</button>
        </form>
        <p class="auth-foot">Déjà inscrit ? <button class="link-btn" data-action="auth-mode" data-mode="signin">Se connecter</button></p>`,
      'check-email': `
        <h2>Vérifiez votre e-mail</h2>
        ${notice}
        <p class="lead">Un lien de confirmation a été envoyé à <strong>${esc(ui.pendingEmail)}</strong>. Ouvrez-le pour activer votre compte : vous serez connecté automatiquement.</p>
        <button class="btn btn-ghost btn-block" data-action="resend-confirmation">Renvoyer l'e-mail</button>
        <button class="btn btn-block" data-action="auth-mode" data-mode="signin">Aller à la connexion</button>`,
      forgot: `
        <h2>Mot de passe oublié</h2>
        <p class="lead">Saisissez votre e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
        ${notice}
        <form class="stack" data-form="forgot" novalidate>
          <label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="email" required></label>
          <button class="btn btn-block" type="submit">Envoyer le lien</button>
        </form>
        <button class="link-btn" data-action="auth-mode" data-mode="signin">Retour à la connexion</button>`,
      'new-password': `
        <h2>Nouveau mot de passe</h2>
        <p class="lead">Choisissez le mot de passe que vous utiliserez pour vous connecter.</p>
        ${notice}
        <form class="stack" data-form="new-password" novalidate>
          <label class="field"><span>Nouveau mot de passe</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="8" required>${pwdHint}</label>
          <label class="field"><span>Confirmer</span><input class="input" type="password" name="confirm" autocomplete="new-password" required></label>
          <button class="btn btn-block" type="submit">Enregistrer le mot de passe</button>
        </form>`
    };
    root().innerHTML = `
      <div class="auth">
        <section class="auth-brand">
          <span class="brand-mark brand-lg">${BRAND}<small class="brand-by">By DOXTEHAD</small></span>
          <div>
            <h1>Cap vers une finance responsable.</h1>
            <p>75 % pour vivre, 15 % pour vos projets, 10 % mis de côté. CAP FIN vous montre chaque mois où vous en êtes, compte par compte, en dollars comme en francs congolais.</p>
          </div>
          ${capPreview()}
        </section>
        <section class="auth-panel"><div class="auth-card">${cards[mode] || cards.signin}</div></section>
      </div>`;
    enhancePasswords(root());
    const firstInput = $('.auth-card input');
    if (firstInput) firstInput.focus();
    document.title = 'CAP FIN · Cap vers une finance responsable';
  }

  function passwordProblem(pwd, confirm) {
    if (!pwd || pwd.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (!/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
    if (confirm !== undefined && pwd !== confirm) return 'Les deux mots de passe ne sont pas identiques.';
    return null;
  }

  // ------------------------------------------------------------
  // Structure principale
  // ------------------------------------------------------------
  function renderApp() {
    const name = (S.profile && S.profile.display_name) || emailName();
    const email = (ui.session && ui.session.user && ui.session.user.email) || '';
    root().innerHTML = `
      <div class="app">
        <aside class="sidebar">
          <span class="brand-mark">${BRAND}</span>
          <nav class="nav" aria-label="Navigation principale">
            ${VIEWS.map((v) => `<button class="nav-item" data-action="go" data-view="${v.id}">${icon(v.icon)}<span>${v.label}</span></button>`).join('')}
          </nav>
          <div class="sidebar-foot">
            <div class="user-chip"><span class="avatar">${esc(name.charAt(0).toUpperCase())}</span><div><strong>${esc(name)}</strong><small>${esc(email)}</small></div></div>
            <button class="btn btn-ghost btn-sm" data-action="signout">${icon('logout')} Se déconnecter</button>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <h1 id="view-title"></h1>
            <span class="sync" id="sync-badge"></span>
            <div class="month-nav" id="month-nav">
              <button data-action="month" data-delta="-1" aria-label="Mois précédent">‹</button>
              <span class="month-label" id="month-label"></span>
              <button data-action="month" data-delta="1" aria-label="Mois suivant">›</button>
            </div>
            <button class="btn btn-accent" data-action="new-operation">${icon('plus')}<span class="hide-sm">Nouvelle opération</span></button>
          </header>
          <main class="content" id="view"></main>
        </div>
      </div>
      <nav class="tabbar" aria-label="Navigation">
        ${VIEWS.filter((v) => v.mobile).map((v) => `<button data-action="go" data-view="${v.id}">${icon(v.icon)}<span>${v.short}</span></button>`).join('')}
        <button data-action="more" id="tab-more">${icon('more')}<span>Plus</span></button>
      </nav>`;
    renderView();
    updateSyncBadge();
  }

  function openMoreMenu() {
    const name = (S.profile && S.profile.display_name) || emailName();
    openModal(`
      <div class="modal-card small">
        <div class="modal-head"><h2>${esc(name)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
        <nav class="more-menu" aria-label="Toutes les sections">
          ${VIEWS.map((v) => `<button class="nav-item" data-action="go" data-view="${v.id}" ${v.id === ui.view ? 'aria-current="page"' : ''}>${icon(v.icon)}<span>${v.label}</span></button>`).join('')}
          <button class="nav-item" data-action="signout">${icon('logout')}<span>Se déconnecter</span></button>
        </nav>
      </div>`);
  }

  function go(view) {
    ui.view = view;
    renderView();
    window.scrollTo(0, 0);
  }

  function renderView() {
    const el = document.getElementById('view');
    if (!el) return;
    const v = VIEWS.find((x) => x.id === ui.view) || VIEWS[0];
    $('#view-title').textContent = v.label;
    $('#month-nav').hidden = !v.month;
    $('#month-label').textContent = F.monthLabel(ui.month);
    $$('[data-action="go"]').forEach((b) => {
      if (b.dataset.view === v.id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    const more = document.getElementById('tab-more');
    if (more) {
      if (v.mobile) more.removeAttribute('aria-current');
      else more.setAttribute('aria-current', 'page');
    }
    const renderers = {
      dashboard: viewDashboard,
      operations: viewOperations,
      accounts: viewAccounts,
      recurring: viewRecurring,
      projects: viewProjects,
      reports: viewReports,
      settings: viewSettings
    };
    el.innerHTML = renderers[v.id]();
    if (v.id === 'reports') drawHistoryChart();
    if (v.id === 'settings') enhancePasswords(el);
    document.title = `${v.label} · CAP FIN`;
  }

  function updateSyncBadge() {
    const b = document.getElementById('sync-badge');
    if (!b) return;
    const pending = D.pendingCount();
    b.className = 'sync hide-sm' + (ui.sync.offline ? ' offline' : pending ? ' pending' : '');
    b.textContent = ui.sync.offline ? `Hors ligne${pending ? ` · ${pending} en attente` : ''}` : pending ? `${pending} à envoyer` : 'Synchronisé';
  }

  function refresh() {
    renderView();
    updateSyncBadge();
  }

  // ------------------------------------------------------------
  // Accès aux données
  // ------------------------------------------------------------
  const activeAccounts = () => S.accounts.filter((a) => !a.archived);
  const accountName = (id) => {
    const a = S.accounts.find((x) => x.id === id);
    return a ? a.name : '—';
  };
  const projectTitle = (id) => {
    const p = S.projects.find((x) => x.id === id);
    return p ? p.title : '—';
  };
  const sortedOps = (list) =>
    list.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

  // ------------------------------------------------------------
  // Tableau de bord
  // ------------------------------------------------------------
  function capBlock(t, rc) {
    const rev = t.revenus;
    const w = (v) => (rev > 0 ? Math.min(100, (v / rev) * 100) : 0);
    const dep = w(t.depenses);
    const proj = Math.min(100 - dep, w(t.projets));
    const epar = Math.min(100 - dep - proj, w(t.epargne));
    const r = rc.rules;
    const tick1 = r.depensesMax;
    const tick2 = Math.min(100, r.depensesMax + r.projetsMax);
    let verdict = '<span class="cap-verdict">Ajoutez vos revenus du mois pour suivre le cap</span>';
    if (rev > 0) {
      const issues = [rc.alerts.depenses && 'Dépenses trop hautes', rc.alerts.projets && 'Projets au-dessus de la cible', rc.alerts.epargne && 'Épargne insuffisante'].filter(Boolean);
      verdict = rc.respected
        ? '<span class="cap-verdict ok">Cap tenu ce mois-ci</span>'
        : `<span class="cap-verdict bad">${issues.join(', ')}</span>`;
    }
    const legend = (color, name, value, pctVal, hint, alert) => `
      <div class="item">
        <span class="name"><i class="dot" style="background:${color}"></i>${name}</span>
        <span class="fig num">${fmt(value)} <span style="color:#9fb2c8;font-weight:400">(${pct(pctVal)})</span></span>
        <span class="hint ${alert ? 'alert' : ''}">${hint}</span>
      </div>`;
    return `
      <section class="cap" aria-label="Règle ${r.depensesMax}/${r.projetsMax}/${r.epargneMin}">
        <div class="cap-top">
          <div class="cap-figure">
            <div class="label">Reste à répartir en ${esc(F.monthLabel(ui.month).toLowerCase())}</div>
            <div class="value num ${t.solde < 0 ? 'neg' : ''}">${fmt(t.solde)}</div>
          </div>
          <div class="cap-mini">
            <div><span>Revenus</span><strong class="num">${fmt(t.revenus)}</strong></div>
            <div><span>Engagé</span><strong class="num">${fmt(t.engage)}</strong></div>
          </div>
          ${verdict}
        </div>
        <div>
          <div class="cap-track">
            <div class="cap-band"><i class="seg dep" style="width:${dep}%"></i><i class="seg proj" style="width:${proj}%"></i><i class="seg epar" style="width:${epar}%"></i></div>
            <div class="cap-ticks"><i style="left:${tick1}%"></i><i style="left:${tick2}%"></i></div>
          </div>
          <div class="cap-scale"><span style="left:0">0 %</span><span style="left:${tick1}%">${tick1} %</span><span style="left:${tick2}%">${tick2} %</span><span style="left:100%">100 %</span></div>
        </div>
        <div class="cap-legend">
          ${legend('var(--dep)', 'Dépenses', t.depenses, rc.depPct, `Plafond ${r.depensesMax} % : ${fmt(rc.maxDep)}`, rc.alerts.depenses)}
          ${legend('var(--proj)', 'Projets', t.projets, rc.projPct, `Cible ${r.projetsMax} % : ${fmt(rc.maxProj)}`, rc.alerts.projets)}
          ${legend('var(--epar)', 'Épargne', t.epargne, rc.eparPct, `Minimum ${r.epargneMin} % : ${fmt(rc.minEpar)}`, rc.alerts.epargne)}
        </div>
      </section>`;
  }

  function deltaTag(v, goodWhenUp) {
    if (v === null || !Number.isFinite(v)) return '<span class="delta">Pas de comparaison</span>';
    const up = v >= 0;
    const good = goodWhenUp ? up : !up;
    const prev = F.monthLabel(F.shiftMonth(ui.month, -1), 'fr-FR', true);
    return `<span class="delta ${Math.abs(v) < 0.5 ? '' : good ? 'good' : 'bad'}">${up ? '+' : '−'}${Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} % vs ${esc(prev)}</span>`;
  }

  // ------------------------------------------------------------
  // Taux du jour automatique (service public, base USD)
  // ------------------------------------------------------------
  const RATES_URL = 'https://open.er-api.com/v6/latest/USD';

  async function refreshRates(force) {
    if (!S.profile || (!force && !F.needsRateRefresh(S.profile.rates, today()))) return false;
    if (!navigator.onLine) {
      if (force) toast('Hors ligne : impossible de récupérer le taux du jour.', 'warning');
      return false;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(RATES_URL, { signal: ctrl.signal, cache: 'no-store', referrerPolicy: 'no-referrer' });
      clearTimeout(timer);
      const parsed = F.parseRateResponse(await res.json());
      if (!parsed) throw new Error('réponse inattendue');
      D.save('profiles', Object.assign({}, S.profile, {
        rates: Object.assign({}, S.profile.rates, { USD: 1, CDF: parsed.CDF, EUR: parsed.EUR, _date: today(), _source: 'auto', _auto: true })
      }));
      if (force) toast(`Taux mis à jour : 1 $ = ${parsed.CDF.toLocaleString('fr-FR')} FC.`, 'success');
      refresh();
      return true;
    } catch {
      if (force) toast('Le taux du jour est indisponible pour le moment. Gardez ou saisissez votre taux.', 'warning', 6000);
      return false;
    }
  }

  // ------------------------------------------------------------
  // Panneau d'alertes en couleurs
  // ------------------------------------------------------------
  const ALERT_ICONS = { danger: '!', warning: '!', info: 'i', success: '✓' };

  function alertsBlock() {
    const alerts = F.buildAlerts({
      operations: S.operations,
      profile: S.profile,
      accounts: S.accounts,
      projects: S.projects,
      recurring: S.recurring,
      month: ui.month,
      today: today()
    });
    if (!alerts.length) return '';
    const shown = ui.showAllAlerts ? alerts : alerts.slice(0, 4);
    const counts = ['danger', 'warning'].map((l) => alerts.filter((a) => a.level === l).length);
    return `
      <section class="panel alerts-panel" aria-label="Alertes">
        <div class="panel-head"><h2>Alertes</h2>
          ${counts[0] ? `<span class="alert-count danger">${counts[0]} à corriger</span>` : ''}
          ${counts[1] ? `<span class="alert-count warning">${counts[1]} à surveiller</span>` : ''}
        </div>
        <div class="alerts">
          ${shown.map((a) => `
            <div class="alert ${a.level}" role="${a.level === 'danger' ? 'alert' : 'status'}" data-alert="${esc(a.id)}">
              <span class="alert-icon" aria-hidden="true">${ALERT_ICONS[a.level]}</span>
              <div><strong>${esc(a.title)}</strong><p>${esc(a.text)}</p></div>
            </div>`).join('')}
        </div>
        ${alerts.length > shown.length || ui.showAllAlerts ? `<button class="link-btn" data-action="toggle-alerts" style="margin-top:10px">${ui.showAllAlerts ? 'Voir moins' : `Voir les ${alerts.length} alertes`}</button>` : ''}
      </section>`;
  }

  function viewDashboard() {
    const t = F.totals(S.operations, S.profile, ui.month);
    const prev = F.totals(S.operations, S.profile, F.shiftMonth(ui.month, -1));
    const rc = F.ruleCheck(t, S.profile.rules);
    const cmp = F.compare(t, prev);
    const monthOps = sortedOps(S.operations.filter((o) => F.inMonth(o, ui.month)));
    const cats = F.categoryBreakdown(S.operations, S.profile, ui.month, 'Dépense').slice(0, 6);
    const bal = F.balances(S.accounts, S.operations, S.profile.rates);
    const net = F.netWorth(S.accounts, bal, S.profile);
    const upcoming = S.recurring
      .filter((r) => r.active !== false)
      .map((r) => ({ r, next: F.upcomingDate(r, today()) }))
      .filter((x) => x.next)
      .sort((a, b) => (a.next < b.next ? -1 : 1))
      .slice(0, 5);
    const activeProjects = S.projects
      .map((p) => ({ p, pr: F.projectProgress(p, S.operations, S.profile) }))
      .filter((x) => x.pr.status === 'En cours')
      .slice(0, 3);

    return `
      ${capBlock(t, rc)}
      ${alertsBlock()}
      <section class="stats-row">
        <div class="stat rev"><span class="label">Revenus</span><span class="value num">${fmt(t.revenus)}</span>${deltaTag(cmp.revenus, true)}</div>
        <div class="stat dep"><span class="label">Dépenses</span><span class="value num">${fmt(t.depenses)}</span>${deltaTag(cmp.depenses, false)}</div>
        <div class="stat proj"><span class="label">Projets</span><span class="value num">${fmt(t.projets)}</span>${deltaTag(cmp.projets, true)}</div>
        <div class="stat epar"><span class="label">Épargne</span><span class="value num">${fmt(t.epargne)}</span>${deltaTag(cmp.epargne, true)}</div>
      </section>
      <div class="split">
        <div class="stack" style="gap:20px">
          ${monthOps.length ? '' : `<section class="panel">${emptyState('Aucune opération ce mois-ci', 'Commencez par enregistrer votre premier revenu.', 'new-operation', 'Ajouter une opération')}</section>`}
          <section class="panel">
            <div class="panel-head"><h2>Où part l'argent</h2><p>Dépenses du mois par catégorie.</p></div>
            ${cats.length ? barsList(cats, 'var(--dep)') : '<p class="muted">Aucune dépense enregistrée ce mois-ci.</p>'}
          </section>
        </div>
        <div class="stack" style="gap:20px">
          <section class="panel">
            <div class="panel-head"><h2>Mes comptes</h2><button class="btn btn-ghost btn-sm" data-action="go" data-view="accounts">Gérer</button></div>
            <div class="mini-accounts">
              ${activeAccounts().map((a) => `<div class="line"><span>${esc(a.name)}</span><span class="num ${bal[a.id] < 0 ? 'neg' : ''}">${fmtCur(bal[a.id], a.currency)}</span></div>`).join('')}
              <div class="line"><span>Total (${esc(base())})</span><span class="num ${net < 0 ? 'neg' : ''}">${fmt(net)}</span></div>
            </div>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>À venir</h2><button class="btn btn-ghost btn-sm" data-action="go" data-view="recurring">Récurrences</button></div>
            ${upcoming.length ? upcoming.map(({ r, next }) => `
              <div class="list-item"><div class="grow"><div class="title">${esc(r.category || r.type)}</div><div class="meta">${fmtDate(next)}, ${esc((FREQUENCIES[r.frequency] || '').toLowerCase())}</div></div>
              <span class="tag tag-${esc(r.type)}">${esc(r.type)}</span><strong class="num">${fmtCur(r.amount, r.currency)}</strong></div>`).join('') : '<p class="muted">Aucune opération récurrente. Ajoutez votre salaire ou votre loyer pour les voir arriver ici.</p>'}
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Projets en cours</h2><button class="btn btn-ghost btn-sm" data-action="go" data-view="projects">Tous</button></div>
            ${activeProjects.length ? activeProjects.map(({ p, pr }) => `
              <div class="list-item" style="display:grid;gap:6px">
                <div style="display:flex;justify-content:space-between;gap:8px"><span class="title">${esc(p.title)}</span><span class="num muted">${pct(pr.pct)}</span></div>
                <div class="progress"><i style="width:${pr.pct}%"></i></div>
              </div>`).join('') : '<p class="muted">Aucun projet actif.</p>'}
          </section>
        </div>
      </div>`;
  }

  function barsList(items, color) {
    return `<div class="bars">${items.map((c) => `
      <div class="bar-line"><div class="top"><span>${esc(c.category)}</span><span class="num"><strong>${fmt(c.amount)}</strong> <span class="muted">(${pct(c.share)})</span></span></div>
      <div class="bar"><i style="width:${c.share}%;background:${color}"></i></div></div>`).join('')}</div>`;
  }

  function emptyState(title, text, action, label) {
    return `<div class="empty"><strong>${esc(title)}</strong><span>${esc(text)}</span>${action ? `<button class="btn" data-action="${action}">${icon('plus')} ${esc(label)}</button>` : ''}</div>`;
  }

  function opAmountCell(o) {
    if (o.type === 'Revenu') return `<span class="amount-in num">+${fmtCur(o.amount, o.currency)}</span>`;
    if (o.type === 'Transfert') return `<span class="amount-move num">${fmtCur(o.amount, o.currency)}</span>`;
    return `<span class="amount-out num">−${fmtCur(o.amount, o.currency)}</span>`;
  }

  function opAccountCell(o) {
    if (o.to_account_id) return `${esc(accountName(o.account_id))} → ${esc(accountName(o.to_account_id))}`;
    return esc(accountName(o.account_id));
  }

  function opsTable(list, withActions) {
    return `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Date</th><th>Type</th><th>Catégorie</th><th class="hide-sm">Compte</th><th class="right">Montant</th>${withActions ? '<th class="actions"><span style="position:absolute;left:-9999px">Actions</span></th>' : ''}</tr></thead>
        <tbody>
          ${list.map((o) => `
            <tr>
              <td class="num">${fmtDate(o.date)}</td>
              <td><span class="tag tag-${esc(o.type)}">${esc(o.type)}</span></td>
              <td><div>${esc(o.category || (o.project_id ? projectTitle(o.project_id) : '—'))}</div>${o.description ? `<div class="desc">${esc(o.description)}</div>` : ''}${o.recurring_id ? '<div class="desc">Récurrente</div>' : ''}</td>
              <td class="hide-sm">${opAccountCell(o)}</td>
              <td class="right">${opAmountCell(o)}</td>
              ${withActions ? `<td class="actions">
                <button class="icon-btn" title="Modifier" aria-label="Modifier" data-action="edit-operation" data-id="${o.id}">${icon('edit')}</button>
                <button class="icon-btn" title="Dupliquer" aria-label="Dupliquer" data-action="duplicate-operation" data-id="${o.id}">${icon('copy')}</button>
                <button class="icon-btn danger" title="Supprimer" aria-label="Supprimer" data-action="delete-operation" data-id="${o.id}">${icon('trash')}</button>
              </td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table></div>`;
  }

  // ------------------------------------------------------------
  // Opérations
  // ------------------------------------------------------------
  function filteredOps() {
    const f = ui.filters;
    const q = f.q.trim().toLowerCase();
    return sortedOps(
      S.operations.filter((o) => {
        if (!f.allMonths && !F.inMonth(o, ui.month)) return false;
        if (f.type !== 'ALL' && o.type !== f.type) return false;
        if (f.account !== 'ALL' && o.account_id !== f.account && o.to_account_id !== f.account) return false;
        if (q) {
          const hay = `${o.category} ${o.description} ${accountName(o.account_id)} ${o.amount}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
    );
  }

  function viewOperations() {
    const f = ui.filters;
    const list = filteredOps();
    const t = F.totals(list, S.profile, null);
    const filtered = f.q || f.type !== 'ALL' || f.account !== 'ALL';
    return `
      <section class="panel">
        <div class="toolbar">
          <input class="input grow" type="search" placeholder="Rechercher une catégorie, une description…" data-filter="q" value="${esc(f.q)}" aria-label="Rechercher">
          <select class="select" data-filter="type" aria-label="Type">
            <option value="ALL">Tous les types</option>
            ${F.TYPES.map((t2) => `<option value="${t2}" ${f.type === t2 ? 'selected' : ''}>${t2}</option>`).join('')}
          </select>
          <select class="select" data-filter="account" aria-label="Compte">
            <option value="ALL">Tous les comptes</option>
            ${S.accounts.map((a) => `<option value="${a.id}" ${f.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
          </select>
          <label class="check"><input type="checkbox" data-filter="allMonths" ${f.allMonths ? 'checked' : ''}> Tous les mois</label>
          <button class="btn btn-ghost" data-action="export-csv" data-scope="filtered">${icon('download')} CSV</button>
        </div>
        <p class="muted" style="font-size:13px;margin-bottom:10px">${list.length} opération(s). Entrées ${fmt(t.revenus)}, sorties ${fmt(t.engage)}.</p>
        ${list.length ? opsTable(list, true) : emptyState('Aucune opération trouvée', filtered ? 'Essayez d’élargir les filtres.' : 'Ajoutez votre première opération pour ce mois.', 'new-operation', 'Nouvelle opération')}
      </section>`;
  }

  function categoryOptions(type) {
    const used = S.operations.filter((o) => o.type === type).map((o) => o.category).filter(Boolean);
    return Array.from(new Set([...(CATEGORY_SUGGESTIONS[type] || []), ...used])).slice(0, 40);
  }

  function accountOptions(selected) {
    return S.accounts
      .filter((a) => !a.archived || a.id === selected)
      .map((a) => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${esc(a.name)} (${a.currency})</option>`)
      .join('');
  }

  function typeSelector(prefix, current) {
    return F.TYPES.map(
      (t) => `<input type="radio" name="type" id="${prefix}-${t}" value="${t}" ${current === t ? 'checked' : ''}><label for="${prefix}-${t}">${t}</label>`
    ).join('');
  }

  function openOperationModal(id, opts) {
    const existing = id ? S.operations.find((o) => o.id === id) : null;
    const first = activeAccounts()[0] || {};
    const o = existing
      ? Object.assign({}, existing)
      : Object.assign(
          {
            type: 'Dépense',
            currency: entryCurrency() !== 'auto' ? entryCurrency() : first.currency || base(),
            date: F.inMonth({ date: today() }, ui.month) ? today() : `${ui.month}-01`,
            account_id: first.id,
            amount: ''
          },
          opts || {}
        );
    const isEdit = Boolean(existing);
    openModal(
      `<div class="modal-card">
        <div class="modal-head"><h2>${isEdit ? "Modifier l'opération" : 'Nouvelle opération'}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
        <form class="stack" data-form="operation" data-id="${isEdit ? o.id : ''}" novalidate>
          <div class="segmented" role="radiogroup" aria-label="Type">${typeSelector('t', o.type)}</div>
          <div class="row" style="grid-template-columns:2fr 1fr">
            <label class="field"><span>Montant</span><input class="input input-amount" type="number" name="amount" inputmode="decimal" step="0.01" min="0.01" value="${esc(o.amount)}" required></label>
            <label class="field"><span>Devise</span><select class="select" name="currency">${Object.keys(F.CURRENCIES).map((c) => `<option value="${c}" ${o.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          </div>
          <div class="row">
            <label class="field"><span data-label="account">Compte</span><select class="select" name="account_id">${accountOptions(o.account_id)}</select></label>
            <label class="field" data-show="to"><span data-label="to">Vers le compte</span><select class="select" name="to_account_id"><option value="">Aucun</option>${accountOptions(o.to_account_id)}</select></label>
          </div>
          <label class="field" data-show="project"><span>Projet à alimenter</span><select class="select" name="project_id"><option value="">Choisir…</option>${S.projects.map((p) => `<option value="${p.id}" ${o.project_id === p.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>
          <div class="row">
            <label class="field"><span>Catégorie</span><input class="input" name="category" list="cat-list" maxlength="120" value="${esc(o.category || '')}"><datalist id="cat-list"></datalist></label>
            <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${esc(o.date)}" required></label>
          </div>
          <label class="field"><span>Description</span><input class="input" name="description" maxlength="500" value="${esc(o.description || '')}" placeholder="Facultatif"></label>
          ${isEdit ? '' : `
          <div class="row" style="align-items:center">
            <label class="check"><input type="checkbox" name="repeat"> Répéter automatiquement</label>
            <select class="select" name="frequency" disabled aria-label="Fréquence">${Object.entries(FREQUENCIES).map(([k, v]) => `<option value="${k}" ${k === 'monthly' ? 'selected' : ''}>${v}</option>`).join('')}</select>
          </div>`}
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>
            <button type="submit" class="btn">${isEdit ? 'Enregistrer' : "Ajouter l'opération"}</button>
          </div>
        </form>
      </div>`,
      (m) => syncOperationForm($('form', m))
    );
  }

  function syncOperationForm(form) {
    const checked = form.querySelector('input[name=type]:checked');
    const type = checked ? checked.value : 'Dépense';
    $('[data-show=to]', form).hidden = !(type === 'Transfert' || type === 'Épargne');
    $('[data-label=to]', form).textContent = type === 'Transfert' ? 'Vers le compte' : 'Vers un compte épargne (facultatif)';
    $('[data-label=account]', form).textContent = type === 'Revenu' ? 'Reçu sur le compte' : type === 'Transfert' ? 'Depuis le compte' : 'Payé depuis le compte';
    $('[data-show=project]', form).hidden = type !== 'Projet';
    $('#cat-list', form).innerHTML = categoryOptions(type).map((c) => `<option value="${esc(c)}">`).join('');
    if (form.elements.repeat) form.elements.frequency.disabled = !form.elements.repeat.checked;
    if (!form.querySelector('[data-convert]') && form.elements.amount) {
      form.elements.amount.closest('.row').insertAdjacentHTML('afterend', '<p class="convert-hint" data-convert aria-live="polite"></p>');
    }
    updateConvertHint(form);
  }

  // Devise proposée par défaut dans les formulaires (réglage de cet appareil)
  const ENTRY_KEY = 'cap75_entry_currency';
  function entryCurrency() {
    try {
      return localStorage.getItem(ENTRY_KEY) || 'auto';
    } catch {
      return 'auto';
    }
  }

  // Conversion affichée en direct sous le montant : « 100 000 FC ≈ 35,09 $ »
  function updateConvertHint(form) {
    const hint = form.querySelector('[data-convert]');
    if (!hint || !form.elements.currency) return;
    const cur = form.elements.currency.value;
    const amount = parseFloat(String(form.elements.amount.value || '').replace(',', '.'));
    const target = cur !== base() ? base() : cur === 'CDF' ? 'USD' : 'CDF';
    const rates = S.profile.rates;
    const unit = F.convert(1, 'USD', 'CDF', rates);
    const info = F.ratesInfo(rates, today());
    const rateTxt = `Taux : 1 $ = ${Math.round(unit).toLocaleString('fr-FR')} FC${info.date ? ` (${info.source === 'auto' ? 'auto' : 'manuel'}, ${info.date.split('-').reverse().slice(0, 2).join('/')})` : ''}`;
    hint.innerHTML = amount > 0
      ? `<strong class="num">≈ ${esc(fmtCur(F.convert(amount, cur, target, rates), target))}</strong> <span>${esc(rateTxt)}</span>`
      : `<span>${esc(rateTxt)}</span>`;
  }

  function readMovement(fd) {
    const type = fd.get('type');
    return {
      type,
      amount: F.round2(parseFloat(String(fd.get('amount') || '').replace(',', '.'))),
      currency: fd.get('currency'),
      account_id: fd.get('account_id') || null,
      to_account_id: type === 'Transfert' || type === 'Épargne' ? fd.get('to_account_id') || null : null,
      project_id: type === 'Projet' ? fd.get('project_id') || null : null,
      category: String(fd.get('category') || '').trim(),
      description: String(fd.get('description') || '').trim()
    };
  }

  function saveOperation(form) {
    const fd = new FormData(form);
    const id = form.dataset.id || F.uuid();
    const existing = S.operations.find((o) => o.id === id);
    const op = Object.assign({ recurring_id: null }, existing || {}, readMovement(fd), { id, date: fd.get('date') });
    if (op.type === 'Projet' && !op.category && op.project_id) op.category = projectTitle(op.project_id);
    if (op.type === 'Transfert' && !op.category) op.category = 'Transfert';
    const errors = F.validateOperation(op);
    if (errors.length) return formError(form, errors[0]);
    if (fd.get('repeat')) {
      const rec = Object.assign({}, readMovement(fd), {
        id: F.uuid(),
        category: op.category,
        frequency: fd.get('frequency') || 'monthly',
        start_date: op.date,
        end_date: null,
        last_generated: op.date,
        active: true
      });
      D.save('recurring', rec);
      op.recurring_id = rec.id;
    }
    D.save('operations', op);
    closeModal();
    toast(existing ? 'Opération modifiée.' : `Opération ajoutée : ${op.type.toLowerCase()} de ${fmtCur(op.amount, op.currency)}.`, 'success');
    if (!existing && !F.inMonth(op, ui.month)) ui.month = F.monthKey(op.date);
    refresh();
  }

  async function deleteOperation(id) {
    const o = S.operations.find((x) => x.id === id);
    if (!o) return;
    const ok = await confirmBox({
      title: "Supprimer l'opération ?",
      message: `${o.type} de ${fmtCur(o.amount, o.currency)} du ${fmtDate(o.date)}. La suppression est définitive.`,
      confirm: 'Supprimer',
      danger: true
    });
    if (!ok) return;
    D.remove('operations', id);
    toast('Opération supprimée.', 'success');
    refresh();
  }

  // ------------------------------------------------------------
  // Comptes
  // ------------------------------------------------------------
  function viewAccounts() {
    const bal = F.balances(S.accounts, S.operations, S.profile.rates);
    const net = F.netWorth(S.accounts, bal, S.profile);
    const byKind = {};
    activeAccounts().forEach((a) => {
      byKind[a.kind] = (byKind[a.kind] || 0) + F.convert(bal[a.id], a.currency, base(), S.profile.rates);
    });
    const opCount = (id) => S.operations.filter((o) => o.account_id === id || o.to_account_id === id).length;
    const card = (a) => `
      <div class="account ${a.archived ? 'archived' : ''}">
        <div class="account-head"><strong title="${esc(a.name)}">${esc(a.name)}</strong><span class="kind">${esc(KINDS[a.kind] || 'Autre')}</span></div>
        <div class="balance num ${bal[a.id] < 0 ? 'neg' : ''}">${fmtCur(bal[a.id], a.currency)}</div>
        <div class="sub">${a.currency !== base() ? `≈ ${fmt(F.convert(bal[a.id], a.currency, base(), S.profile.rates))}, ` : ''}${opCount(a.id)} opération(s)${a.archived ? ', archivé' : ''}</div>
        <div class="account-actions">
          <button class="icon-btn" title="Modifier" aria-label="Modifier ${esc(a.name)}" data-action="edit-account" data-id="${a.id}">${icon('edit')}</button>
          ${a.archived ? '' : `<button class="icon-btn" title="Transférer depuis ce compte" aria-label="Transférer depuis ${esc(a.name)}" data-action="transfer-from" data-id="${a.id}">${icon('transfer')}</button>`}
          <button class="icon-btn" title="${a.archived ? 'Réactiver' : 'Archiver'}" aria-label="${a.archived ? 'Réactiver' : 'Archiver'} ${esc(a.name)}" data-action="archive-account" data-id="${a.id}">${icon('archive')}</button>
          <button class="icon-btn danger" title="Supprimer" aria-label="Supprimer ${esc(a.name)}" data-action="delete-account" data-id="${a.id}">${icon('trash')}</button>
        </div>
      </div>`;
    const archived = S.accounts.filter((a) => a.archived);
    const kinds = Object.keys(KINDS).filter((k) => k in byKind).slice(0, 3);
    return `
      <section class="stats-row">
        <div class="stat accent"><span class="label">Avoir total</span><span class="value num">${fmt(net)}</span><span class="delta">${activeAccounts().length} compte(s) actif(s)</span></div>
        ${kinds.map((k, i) => `<div class="stat ${['proj', 'violet', 'epar'][i]}"><span class="label">${KINDS[k]}</span><span class="value num">${fmt(byKind[k])}</span></div>`).join('')}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Mes comptes</h2>
          <button class="btn btn-ghost" data-action="transfer-from">${icon('transfer')} Transférer</button>
          <button class="btn" data-action="new-account">${icon('plus')} Ajouter un compte</button>
          <p>Caisse, banque, M-Pesa, Airtel Money, Orange Money… Chaque compte garde sa devise ; le total est converti en ${esc(base())}.</p>
        </div>
        ${activeAccounts().length ? `<div class="accounts">${activeAccounts().map(card).join('')}</div>` : emptyState('Aucun compte actif', 'Ajoutez un compte pour enregistrer vos opérations.', 'new-account', 'Ajouter un compte')}
      </section>
      ${archived.length ? `<section class="panel"><div class="panel-head"><h2>Comptes archivés</h2></div><div class="accounts">${archived.map(card).join('')}</div></section>` : ''}`;
  }

  function openAccountModal(id) {
    const a = id ? S.accounts.find((x) => x.id === id) : { kind: 'mobile', currency: base(), opening_balance: 0, name: '' };
    openModal(`
      <div class="modal-card small">
        <div class="modal-head"><h2>${id ? 'Modifier le compte' : 'Nouveau compte'}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
        <form class="stack" data-form="account" data-id="${id || ''}" novalidate>
          <label class="field"><span>Nom du compte</span><input class="input" name="name" maxlength="80" value="${esc(a.name)}" placeholder="Ex. M-Pesa, Rawbank, Caisse maison" required></label>
          <div class="row">
            <label class="field"><span>Type</span><select class="select" name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${a.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="field"><span>Devise</span><select class="select" name="currency">${Object.keys(F.CURRENCIES).map((c) => `<option value="${c}" ${a.currency === c ? 'selected' : ''}>${c} · ${F.CURRENCIES[c].label}</option>`).join('')}</select></label>
          </div>
          <label class="field"><span>Solde de départ</span><input class="input" type="number" step="0.01" name="opening_balance" value="${esc(a.opening_balance)}"><small>Ce qu'il y avait sur ce compte avant votre première opération dans CAP FIN.</small></label>
          <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button class="btn" type="submit">${id ? 'Enregistrer' : 'Ajouter le compte'}</button></div>
        </form>
      </div>`);
  }

  function saveAccount(form) {
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (!name) return formError(form, 'Donnez un nom au compte.');
    const id = form.dataset.id || F.uuid();
    const existing = S.accounts.find((a) => a.id === id);
    D.save('accounts', Object.assign({}, existing || { archived: false }, {
      id,
      name,
      kind: fd.get('kind'),
      currency: fd.get('currency'),
      opening_balance: F.round2(parseFloat(fd.get('opening_balance')) || 0)
    }));
    closeModal();
    toast(existing ? 'Compte modifié.' : `Compte « ${name} » ajouté.`, 'success');
    refresh();
  }

  function toggleArchiveAccount(id) {
    const a = S.accounts.find((x) => x.id === id);
    if (!a) return;
    if (!a.archived && activeAccounts().length <= 1) {
      toast('Gardez au moins un compte actif.', 'warning');
      return;
    }
    D.save('accounts', Object.assign({}, a, { archived: !a.archived }));
    toast(a.archived ? 'Compte réactivé.' : 'Compte archivé. Son historique est conservé.', 'success');
    refresh();
  }

  async function deleteAccount(id) {
    const a = S.accounts.find((x) => x.id === id);
    if (!a) return;
    const used = S.operations.some((o) => o.account_id === id || o.to_account_id === id) || S.recurring.some((r) => r.account_id === id || r.to_account_id === id);
    if (used) {
      const ok = await confirmBox({
        title: 'Ce compte a des opérations',
        message: 'Pour garder votre historique juste, archivez-le plutôt que de le supprimer. Il disparaîtra des listes, mais ses opérations resteront.',
        confirm: 'Archiver le compte'
      });
      if (ok && !a.archived) toggleArchiveAccount(id);
      return;
    }
    if (!a.archived && activeAccounts().length <= 1) {
      toast('Gardez au moins un compte actif.', 'warning');
      return;
    }
    const ok = await confirmBox({ title: `Supprimer « ${a.name} » ?`, message: 'Le compte sera supprimé définitivement.', confirm: 'Supprimer', danger: true });
    if (!ok) return;
    D.remove('accounts', id);
    toast('Compte supprimé.', 'success');
    refresh();
  }

  // ------------------------------------------------------------
  // Récurrences
  // ------------------------------------------------------------
  function monthlyEquivalent(r) {
    const v = F.convert(r.amount, r.currency, base(), S.profile.rates);
    if (r.frequency === 'weekly') return (v * 52) / 12;
    if (r.frequency === 'yearly') return v / 12;
    return v;
  }

  function viewRecurring() {
    const list = S.recurring.slice().sort((a, b) => Number(b.active !== false) - Number(a.active !== false));
    const active = list.filter((r) => r.active !== false);
    const monthlyIn = active.filter((r) => r.type === 'Revenu').reduce((s, r) => s + monthlyEquivalent(r), 0);
    const monthlyOut = active.filter((r) => r.type !== 'Revenu' && r.type !== 'Transfert').reduce((s, r) => s + monthlyEquivalent(r), 0);
    return `
      <section class="stats-row">
        <div class="stat rev"><span class="label">Entrées fixes par mois</span><span class="value num">${fmt(monthlyIn)}</span></div>
        <div class="stat dep"><span class="label">Sorties fixes par mois</span><span class="value num">${fmt(monthlyOut)}</span></div>
        <div class="stat accent"><span class="label">Marge après charges fixes</span><span class="value num">${fmt(monthlyIn - monthlyOut)}</span></div>
        <div class="stat violet"><span class="label">Récurrences actives</span><span class="value num">${active.length}</span></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Opérations récurrentes</h2><button class="btn" data-action="new-recurring">${icon('plus')} Ajouter</button>
          <p>Salaire, loyer, abonnements, tontine… CAP FIN les enregistre automatiquement à leur date, à chaque ouverture.</p></div>
        ${list.length ? list.map((r) => {
          const next = F.upcomingDate(r, today());
          const paused = r.active === false;
          return `
          <div class="list-item ${paused ? 'paused' : ''}">
            <span class="tag tag-${esc(r.type)}">${esc(r.type)}</span>
            <div class="grow"><div class="title">${esc(r.category || r.description || r.type)}</div>
              <div class="meta">${esc(FREQUENCIES[r.frequency])}, ${esc(accountName(r.account_id))}${r.to_account_id ? ` → ${esc(accountName(r.to_account_id))}` : ''}. ${paused ? 'En pause.' : next ? `Prochaine : ${fmtDate(next)}.` : 'Terminée.'}</div></div>
            <strong class="num">${fmtCur(r.amount, r.currency)}</strong>
            <button class="icon-btn" title="${paused ? 'Reprendre' : 'Mettre en pause'}" aria-label="${paused ? 'Reprendre' : 'Mettre en pause'}" data-action="toggle-recurring" data-id="${r.id}">${icon(paused ? 'play' : 'pause')}</button>
            <button class="icon-btn" title="Modifier" aria-label="Modifier" data-action="edit-recurring" data-id="${r.id}">${icon('edit')}</button>
            <button class="icon-btn danger" title="Supprimer" aria-label="Supprimer" data-action="delete-recurring" data-id="${r.id}">${icon('trash')}</button>
          </div>`;
        }).join('') : emptyState('Aucune opération récurrente', 'Ajoutez votre salaire et vos charges fixes : ils seront saisis pour vous chaque mois.', 'new-recurring', 'Ajouter une récurrence')}
      </section>`;
  }

  function openRecurringModal(id) {
    const first = activeAccounts()[0] || {};
    const r = id
      ? S.recurring.find((x) => x.id === id)
      : { type: 'Dépense', frequency: 'monthly', start_date: today(), currency: entryCurrency() !== 'auto' ? entryCurrency() : first.currency || base(), account_id: first.id, amount: '' };
    openModal(`
      <div class="modal-card">
        <div class="modal-head"><h2>${id ? 'Modifier la récurrence' : 'Nouvelle récurrence'}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
        <form class="stack" data-form="recurring" data-id="${id || ''}" novalidate>
          <div class="segmented" role="radiogroup" aria-label="Type">${typeSelector('rt', r.type)}</div>
          <div class="row" style="grid-template-columns:2fr 1fr">
            <label class="field"><span>Montant</span><input class="input input-amount" type="number" name="amount" step="0.01" min="0.01" value="${esc(r.amount)}" required></label>
            <label class="field"><span>Devise</span><select class="select" name="currency">${Object.keys(F.CURRENCIES).map((c) => `<option ${r.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          </div>
          <div class="row">
            <label class="field"><span data-label="account">Compte</span><select class="select" name="account_id">${accountOptions(r.account_id)}</select></label>
            <label class="field" data-show="to"><span data-label="to">Vers le compte</span><select class="select" name="to_account_id"><option value="">Aucun</option>${accountOptions(r.to_account_id)}</select></label>
          </div>
          <label class="field" data-show="project"><span>Projet</span><select class="select" name="project_id"><option value="">Choisir…</option>${S.projects.map((p) => `<option value="${p.id}" ${r.project_id === p.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>
          <div class="row">
            <label class="field"><span>Catégorie</span><input class="input" name="category" list="cat-list" value="${esc(r.category || '')}" maxlength="120"><datalist id="cat-list"></datalist></label>
            <label class="field"><span>Fréquence</span><select class="select" name="frequency">${Object.entries(FREQUENCIES).map(([k, v]) => `<option value="${k}" ${r.frequency === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          </div>
          <div class="row">
            <label class="field"><span>Première date</span><input class="input" type="date" name="start_date" value="${esc(r.start_date)}" required></label>
            <label class="field"><span>Dernière date</span><input class="input" type="date" name="end_date" value="${esc(r.end_date || '')}"><small>Facultatif</small></label>
          </div>
          <label class="field"><span>Description</span><input class="input" name="description" maxlength="500" value="${esc(r.description || '')}" placeholder="Facultatif"></label>
          <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button class="btn" type="submit">${id ? 'Enregistrer' : 'Ajouter la récurrence'}</button></div>
        </form>
      </div>`, (m) => syncOperationForm($('form', m)));
  }

  function saveRecurring(form) {
    const fd = new FormData(form);
    const id = form.dataset.id || F.uuid();
    const existing = S.recurring.find((r) => r.id === id);
    const rec = Object.assign({}, existing || { active: true, last_generated: null }, readMovement(fd), {
      id,
      frequency: fd.get('frequency'),
      start_date: fd.get('start_date'),
      end_date: fd.get('end_date') || null
    });
    const errors = F.validateOperation(Object.assign({}, rec, { date: rec.start_date }));
    if (errors.length) return formError(form, errors[0]);
    if (rec.end_date && rec.end_date < rec.start_date) return formError(form, 'La dernière date doit être après la première.');
    if (existing && existing.start_date !== rec.start_date) rec.last_generated = null;
    D.save('recurring', rec);
    const added = runRecurring();
    closeModal();
    toast(`Récurrence enregistrée${added ? `, ${added} opération(s) ajoutée(s)` : ''}.`, 'success');
    refresh();
  }

  function toggleRecurring(id) {
    const r = S.recurring.find((x) => x.id === id);
    if (!r) return;
    const resume = r.active === false;
    // À la reprise, les échéances passées pendant la pause ne sont pas rattrapées
    D.save('recurring', Object.assign({}, r, { active: resume, last_generated: resume ? today() : r.last_generated }));
    toast(resume ? 'Récurrence reprise.' : 'Récurrence en pause.', 'success');
    refresh();
  }

  async function deleteRecurring(id) {
    if (!S.recurring.some((x) => x.id === id)) return;
    const ok = await confirmBox({
      title: 'Supprimer cette récurrence ?',
      message: 'Les opérations déjà enregistrées sont conservées. Seules les prochaines ne seront plus créées.',
      confirm: 'Supprimer',
      danger: true
    });
    if (!ok) return;
    D.remove('recurring', id);
    toast('Récurrence supprimée.', 'success');
    refresh();
  }

  // ------------------------------------------------------------
  // Projets
  // ------------------------------------------------------------
  function viewProjects() {
    const f = ui.projectFilter;
    const all = S.projects.map((p) => ({ p, pr: F.projectProgress(p, S.operations, S.profile) }));
    const list = all.filter((x) => f === 'ALL' || x.pr.status === f);
    const totalTarget = all.reduce((s, x) => s + x.pr.target, 0);
    const totalSaved = all.reduce((s, x) => s + Math.min(x.pr.saved, x.pr.target), 0);
    const monthly = all.filter((x) => x.pr.status === 'En cours').reduce((s, x) => s + x.pr.monthly, 0);
    const priorityTag = { Haute: 'tag-Dépense', Moyenne: 'tag-Épargne', Basse: 'tag-Transfert' };
    const effort = (p, pr) => {
      if (pr.reached) return '<div class="effort done">Objectif atteint. Bravo !</div>';
      if (pr.status === 'En pause') return '<div class="effort">Projet en pause.</div>';
      if (pr.deadlineState === 'overdue') return `<div class="effort late">Échéance dépassée : il manque ${fmt(pr.remaining)}.</div>`;
      if (pr.deadlineState === 'none') return '<div class="effort">Ajoutez une échéance pour connaître l’effort mensuel.</div>';
      return `<div class="effort">À mettre de côté : <strong class="num">${fmt(pr.monthly)}</strong> par mois pendant ${Math.max(1, Math.ceil(pr.months))} mois.</div>`;
    };
    return `
      <section class="stats-row">
        <div class="stat violet"><span class="label">Objectif total</span><span class="value num">${fmt(totalTarget)}</span></div>
        <div class="stat proj"><span class="label">Déjà réuni</span><span class="value num">${fmt(totalSaved)}</span></div>
        <div class="stat rev"><span class="label">Avancement global</span><span class="value num">${pct(totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0)}</span></div>
        <div class="stat epar"><span class="label">Effort mensuel requis</span><span class="value num">${fmt(monthly)}</span></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Mes projets</h2>
          <select class="select" style="width:auto" data-filter="project" aria-label="Statut">
            ${[['ALL', 'Tous'], ['En cours', 'En cours'], ['En pause', 'En pause'], ['Atteint', 'Atteints']].map(([v, l]) => `<option value="${v}" ${f === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <button class="btn" data-action="new-project">${icon('plus')} Nouveau projet</button>
          <p>Fixez un objectif chiffré et une échéance : CAP FIN calcule combien mettre de côté chaque mois.</p></div>
        ${list.length ? `<div class="projects">${list.map(({ p, pr }) => `
          <article class="project">
            <div class="project-head">
              <div class="grow"><small>${esc(p.category)}</small><h3>${esc(p.title)}</h3></div>
              <button class="icon-btn" title="Modifier" aria-label="Modifier ${esc(p.title)}" data-action="edit-project" data-id="${p.id}">${icon('edit')}</button>
              <button class="icon-btn danger" title="Supprimer" aria-label="Supprimer ${esc(p.title)}" data-action="delete-project" data-id="${p.id}">${icon('trash')}</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag ${priorityTag[p.priority] || 'tag-Transfert'}">Priorité ${esc((p.priority || 'Moyenne').toLowerCase())}</span><span class="tag ${pr.status === 'Atteint' ? 'tag-Revenu' : pr.status === 'En pause' ? 'tag-Transfert' : 'tag-Projet'}">${esc(pr.status)}</span></div>
            <div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span class="muted">Progression</span><strong class="num">${pct(pr.pct)}</strong></div>
              <div class="progress ${pr.reached ? 'done' : ''}"><i style="width:${pr.pct}%"></i></div></div>
            <div class="project-figs">
              <div><span>Réuni</span><strong class="num">${fmt(pr.saved)}</strong></div>
              <div><span>Objectif</span><strong class="num">${fmt(pr.target)}</strong></div>
              <div><span>Reste</span><strong class="num">${fmt(pr.remaining)}</strong></div>
              <div><span>Échéance</span><strong>${p.deadline ? fmtDate(p.deadline) : '—'}</strong></div>
            </div>
            ${effort(p, pr)}
            ${pr.reached ? '' : `<button class="btn btn-ghost btn-block" data-action="contribute" data-id="${p.id}">${icon('coins')} Alimenter ce projet</button>`}
          </article>`).join('')}</div>` : emptyState('Aucun projet', 'Une maison, une moto, un fonds d’urgence… Créez votre premier objectif.', 'new-project', 'Nouveau projet')}
      </section>`;
  }

  function openProjectModal(id) {
    const p = id ? S.projects.find((x) => x.id === id) : { title: '', category: 'Investissement', priority: 'Moyenne', target: '', initial_saved: 0, deadline: '', status: 'En cours' };
    openModal(`
      <div class="modal-card small">
        <div class="modal-head"><h2>${id ? 'Modifier le projet' : 'Nouveau projet'}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
        <form class="stack" data-form="project" data-id="${id || ''}" novalidate>
          <label class="field"><span>Nom du projet</span><input class="input" name="title" maxlength="120" value="${esc(p.title)}" placeholder="Ex. Terrain à Kinshasa" required></label>
          <div class="row">
            <label class="field"><span>Catégorie</span><select class="select" name="category">${PROJECT_CATEGORIES.map((c) => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <label class="field"><span>Priorité</span><select class="select" name="priority">${['Haute', 'Moyenne', 'Basse'].map((c) => `<option ${p.priority === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          </div>
          <div class="row">
            <label class="field"><span>Objectif (${esc(base())})</span><input class="input" type="number" step="0.01" min="0.01" name="target" value="${esc(p.target)}" required></label>
            <label class="field"><span>Déjà réuni avant CAP FIN</span><input class="input" type="number" step="0.01" min="0" name="initial_saved" value="${esc(p.initial_saved)}"></label>
          </div>
          <div class="row">
            <label class="field"><span>Échéance</span><input class="input" type="date" name="deadline" value="${esc(p.deadline || '')}"></label>
            <label class="field"><span>Statut</span><select class="select" name="status">${['En cours', 'En pause', 'Atteint'].map((c) => `<option ${p.status === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          </div>
          <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button class="btn" type="submit">${id ? 'Enregistrer' : 'Créer le projet'}</button></div>
        </form>
      </div>`);
  }

  function saveProject(form) {
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    const target = F.round2(parseFloat(fd.get('target')));
    if (!title) return formError(form, 'Donnez un nom au projet.');
    if (!(target > 0)) return formError(form, "L'objectif doit être supérieur à 0.");
    const id = form.dataset.id || F.uuid();
    const existing = S.projects.find((p) => p.id === id);
    D.save('projects', Object.assign({}, existing || {}, {
      id,
      title,
      category: fd.get('category'),
      priority: fd.get('priority'),
      target,
      initial_saved: Math.max(0, F.round2(parseFloat(fd.get('initial_saved')) || 0)),
      deadline: fd.get('deadline') || null,
      status: fd.get('status')
    }));
    closeModal();
    toast(existing ? 'Projet modifié.' : `Projet « ${title} » créé.`, 'success');
    refresh();
  }

  async function deleteProject(id) {
    const p = S.projects.find((x) => x.id === id);
    if (!p) return;
    const linked = S.operations.filter((o) => o.project_id === id);
    const ok = await confirmBox({
      title: `Supprimer « ${p.title} » ?`,
      message: linked.length ? `Les ${linked.length} apport(s) enregistré(s) restent dans vos opérations, sans lien vers ce projet.` : 'Le projet sera supprimé définitivement.',
      confirm: 'Supprimer',
      danger: true
    });
    if (!ok) return;
    linked.forEach((o) => D.save('operations', Object.assign({}, o, { project_id: null })));
    D.remove('projects', id);
    toast('Projet supprimé.', 'success');
    refresh();
  }

  function openContribution(id) {
    const p = S.projects.find((x) => x.id === id);
    if (!p) return;
    const pr = F.projectProgress(p, S.operations, S.profile);
    openOperationModal(null, {
      type: 'Projet',
      project_id: id,
      category: p.category,
      description: `Apport au projet ${p.title}`,
      currency: base(),
      amount: pr.monthly > 0 ? Math.min(pr.monthly, pr.remaining).toFixed(2) : ''
    });
  }

  // ------------------------------------------------------------
  // Rapports
  // ------------------------------------------------------------
  function viewReports() {
    const hist = F.history(S.operations, S.profile, ui.month, 12);
    const t = F.totals(S.operations, S.profile, ui.month);
    const cats = F.categoryBreakdown(S.operations, S.profile, ui.month, 'Dépense');
    const incomes = F.categoryBreakdown(S.operations, S.profile, ui.month, 'Revenu');
    const withIncome = hist.filter((h) => h.revenus > 0);
    const respected = withIncome.filter((h) => h.respected).length;
    const avgSaving = withIncome.length ? withIncome.reduce((s, h) => s + h.eparPct, 0) / withIncome.length : 0;
    return `
      <section class="stats-row">
        <div class="stat rev"><span class="label">Revenus du mois</span><span class="value num">${fmt(t.revenus)}</span></div>
        <div class="stat dep"><span class="label">Sorties du mois</span><span class="value num">${fmt(t.engage)}</span></div>
        <div class="stat accent"><span class="label">Mois où le cap est tenu</span><span class="value num">${respected} / ${withIncome.length}</span><span class="delta">Sur les 12 derniers mois</span></div>
        <div class="stat epar"><span class="label">Épargne moyenne</span><span class="value num">${pct(avgSaving)}</span><span class="delta">Des revenus, sur 12 mois</span></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Évolution sur 12 mois</h2>
          <button class="btn btn-ghost btn-sm" data-action="print-report">${icon('print')} Rapport PDF</button>
          <button class="btn btn-ghost btn-sm" data-action="export-csv" data-scope="month">${icon('download')} CSV du mois</button>
          <button class="btn btn-ghost btn-sm" data-action="export-csv" data-scope="all">${icon('download')} CSV complet</button>
        </div>
        <div class="chart-wrap"><canvas id="history-chart" role="img" aria-label="Revenus et sorties des 12 derniers mois"></canvas></div>
        <div class="legend-inline"><span><i style="background:var(--rev)"></i>Revenus</span><span><i style="background:var(--dep)"></i>Dépenses</span><span><i style="background:var(--proj)"></i>Projets</span><span><i style="background:var(--epar)"></i>Épargne</span></div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h2>Dépenses par catégorie</h2><p>${esc(F.monthLabel(ui.month))}</p></div>
          ${cats.length ? barsList(cats, 'var(--dep)') : '<p class="muted">Aucune dépense ce mois-ci.</p>'}
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Sources de revenus</h2><p>${esc(F.monthLabel(ui.month))}</p></div>
          ${incomes.length ? barsList(incomes, 'var(--rev)') : '<p class="muted">Aucun revenu ce mois-ci.</p>'}
        </section>
      </div>
      <section class="panel">
        <div class="panel-head"><h2>Mois par mois</h2><p>Part de chaque poste dans les revenus. En rouge : au-delà de votre règle.</p></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Mois</th><th class="right">Revenus</th><th class="right">Dépenses</th><th class="right">Projets</th><th class="right">Épargne</th><th class="right">Solde</th></tr></thead>
          <tbody>${hist.slice().reverse().map((h) => `
            <tr>
              <td>${esc(F.monthLabel(h.month))}</td>
              <td class="right num">${fmt(h.revenus)}</td>
              <td class="right num">${fmt(h.depenses)}<div class="desc ${h.alerts.depenses ? 'bad-cell' : ''}">${h.revenus > 0 ? pct(h.depPct) : '—'}</div></td>
              <td class="right num">${fmt(h.projets)}<div class="desc ${h.alerts.projets ? 'bad-cell' : ''}">${h.revenus > 0 ? pct(h.projPct) : '—'}</div></td>
              <td class="right num">${fmt(h.epargne)}<div class="desc ${h.alerts.epargne ? 'bad-cell' : ''}">${h.revenus > 0 ? pct(h.eparPct) : '—'}</div></td>
              <td class="right num ${h.solde < 0 ? 'neg' : ''}"><strong>${fmt(h.solde)}</strong></td>
            </tr>`).join('')}</tbody>
        </table></div>
      </section>`;
  }

  function drawHistoryChart() {
    const canvas = document.getElementById('history-chart');
    if (!canvas) return;
    const hist = F.history(S.operations, S.profile, ui.month, 12);
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 600;
    const height = 260;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const css = getComputedStyle(document.documentElement);
    const col = (n) => css.getPropertyValue(n).trim();
    const font = col('--font');
    const pad = { l: 56, r: 8, t: 10, b: 28 };
    const plotW = width - pad.l - pad.r;
    const plotH = height - pad.t - pad.b;
    const top = niceMax(Math.max(1, ...hist.map((h) => Math.max(h.revenus, h.engage))));
    ctx.font = `12px ${font}`;
    ctx.fillStyle = col('--muted');
    ctx.strokeStyle = col('--line');
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const v = (top / 4) * i;
      const y = pad.t + plotH - (v / top) * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.l, Math.round(y) + 0.5);
      ctx.lineTo(width - pad.r, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillText(shortNum(v), pad.l - 8, y);
    }
    const slot = plotW / hist.length;
    const bw = Math.max(4, Math.min(18, slot / 3));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    hist.forEach((h, i) => {
      const x = pad.l + slot * i + slot / 2;
      const y0 = pad.t + plotH;
      const hRev = (h.revenus / top) * plotH;
      ctx.fillStyle = col('--rev');
      if (hRev > 0) ctx.fillRect(x - bw - 1, y0 - hRev, bw, hRev);
      let y = y0;
      [['depenses', '--dep'], ['projets', '--proj'], ['epargne', '--epar']].forEach(([k, c]) => {
        const hh = (h[k] / top) * plotH;
        if (hh <= 0) return;
        ctx.fillStyle = col(c);
        ctx.fillRect(x + 1, y - hh, bw, hh);
        y -= hh;
      });
      const current = h.month === ui.month;
      ctx.fillStyle = current ? col('--text') : col('--muted');
      ctx.font = `${current ? '600 ' : ''}11px ${font}`;
      const label = F.monthLabel(h.month, 'fr-FR', true).replace(/\s?\d{4}$/, '').replace('.', '');
      ctx.fillText(label, x, y0 + 8);
    });
  }

  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * p;
  }

  function shortNum(v) {
    if (v >= 1e6) return `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
    if (v >= 1e3) return `${(v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
    return Math.round(v).toLocaleString('fr-FR');
  }

  function printReport() {
    const t = F.totals(S.operations, S.profile, ui.month);
    const rc = F.ruleCheck(t, S.profile.rules);
    const cats = F.categoryBreakdown(S.operations, S.profile, ui.month, 'Dépense');
    const ops = sortedOps(S.operations.filter((o) => F.inMonth(o, ui.month)));
    const bal = F.balances(S.accounts, S.operations, S.profile.rates, `${ui.month}-31`);
    let el = $('.print-report');
    if (!el) {
      el = document.createElement('div');
      el.className = 'print-report';
      document.body.appendChild(el);
    }
    const name = (S.profile && S.profile.display_name) || emailName();
    const verdict = t.revenus > 0 ? (rc.respected ? 'respectée' : 'non respectée') : 'sans revenus enregistrés';
    el.innerHTML = `
      <h1>CAP FIN, rapport de ${esc(F.monthLabel(ui.month).toLowerCase())}</h1>
      <p class="sub">${esc(name)}. Édité le ${esc(new Date().toLocaleDateString('fr-FR'))}. Montants en ${esc(base())}.</p>
      <div class="kpis">
        <div>Revenus<strong>${fmt(t.revenus)}</strong></div>
        <div>Dépenses<strong>${fmt(t.depenses)} (${pct(rc.depPct)})</strong></div>
        <div>Projets<strong>${fmt(t.projets)} (${pct(rc.projPct)})</strong></div>
        <div>Épargne<strong>${fmt(t.epargne)} (${pct(rc.eparPct)})</strong></div>
      </div>
      <p style="margin-top:8px">Reste à répartir : <strong>${fmt(t.solde)}</strong>. Règle ${rc.rules.depensesMax}/${rc.rules.projetsMax}/${rc.rules.epargneMin} : <strong>${verdict}</strong>.</p>
      <h2>Soldes des comptes en fin de mois</h2>
      <table><thead><tr><th>Compte</th><th>Type</th><th class="right">Solde</th></tr></thead>
      <tbody>${activeAccounts().map((a) => `<tr><td>${esc(a.name)}</td><td>${esc(KINDS[a.kind])}</td><td class="right">${fmtCur(bal[a.id], a.currency)}</td></tr>`).join('')}</tbody></table>
      <h2>Dépenses par catégorie</h2>
      <table><thead><tr><th>Catégorie</th><th class="right">Montant</th><th class="right">Part</th></tr></thead>
      <tbody>${cats.map((c) => `<tr><td>${esc(c.category)}</td><td class="right">${fmt(c.amount)}</td><td class="right">${pct(c.share)}</td></tr>`).join('') || '<tr><td colspan="3">Aucune dépense</td></tr>'}</tbody></table>
      <h2>Opérations (${ops.length})</h2>
      <table><thead><tr><th>Date</th><th>Type</th><th>Catégorie</th><th>Compte</th><th class="right">Montant</th></tr></thead>
      <tbody>${ops.map((o) => `<tr><td>${fmtDate(o.date)}</td><td>${esc(o.type)}</td><td>${esc(o.category)}${o.description ? `, ${esc(o.description)}` : ''}</td><td>${opAccountCell(o)}</td><td class="right">${o.type === 'Revenu' ? '+' : o.type === 'Transfert' ? '' : '−'}${fmtCur(o.amount, o.currency)}</td></tr>`).join('')}</tbody></table>`;
    window.print();
  }

  // ------------------------------------------------------------
  // Paramètres
  // ------------------------------------------------------------
  function viewSettings() {
    const p = S.profile;
    const r = Object.assign({}, F.DEFAULT_RULES, F.DEFAULT_ALERT_RULES, p.rules);
    const rates = Object.assign({}, F.DEFAULT_RATES, p.rates);
    const ri = F.ratesInfo(p.rates, today());
    const entry = entryCurrency();
    const email = (ui.session && ui.session.user && ui.session.user.email) || '';
    const installed = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    return `
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h2>Mon profil</h2></div>
          <form class="stack" data-form="profile" novalidate>
            <label class="field"><span>Nom affiché</span><input class="input" name="display_name" maxlength="60" value="${esc(p.display_name || '')}"></label>
            <label class="field"><span>E-mail de connexion</span><input class="input" value="${esc(email)}" disabled></label>
            <label class="field"><span>Déconnexion automatique</span>
              <select class="select" name="auto_lock_minutes">${[[0, 'Jamais'], [5, 'Après 5 minutes'], [15, 'Après 15 minutes'], [30, 'Après 30 minutes'], [60, 'Après 1 heure']].map(([v, l]) => `<option value="${v}" ${Number(p.auto_lock_minutes) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <small>Recommandé sur un appareil partagé.</small></label>
            <div><button class="btn" type="submit">Enregistrer le profil</button></div>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Devises et taux</h2><p>Saisissez en francs, en dollars ou en euros : tout est converti automatiquement dans la devise principale.</p></div>
          <form class="stack" data-form="currency" novalidate>
            <div class="row">
              <label class="field"><span>Devise principale</span><select class="select" name="base_currency">${Object.keys(F.CURRENCIES).map((c) => `<option value="${c}" ${p.base_currency === c ? 'selected' : ''}>${c} · ${F.CURRENCIES[c].label}</option>`).join('')}</select><small>Celle des totaux et des rapports.</small></label>
              <label class="field"><span>Devise de saisie</span><select class="select" name="entry_currency"><option value="auto" ${entry === 'auto' ? 'selected' : ''}>Celle du compte choisi</option>${Object.keys(F.CURRENCIES).map((c) => `<option value="${c}" ${entry === c ? 'selected' : ''}>Toujours ${c}</option>`).join('')}</select><small>Proposée dans « Nouvelle opération ».</small></label>
            </div>
            <div class="row">
              <label class="field"><span>1 USD = … CDF</span><input class="input" type="number" step="0.01" min="0.01" name="CDF" value="${esc(rates.CDF)}"></label>
              <label class="field"><span>1 USD = … EUR</span><input class="input" type="number" step="0.0001" min="0.0001" name="EUR" value="${esc(rates.EUR)}"></label>
            </div>
            <p class="rate-status">${ri.date ? `Taux ${ri.source === 'auto' ? 'automatique' : 'saisi à la main'} du ${esc(ri.date.split('-').reverse().join('/'))}.` : 'Taux par défaut, jamais mis à jour.'}</p>
            <label class="check"><input type="checkbox" name="auto_rates" ${ri.auto ? 'checked' : ''}> Mettre à jour le taux automatiquement chaque jour (taux officiel)</label>
            <small class="muted" style="font-size:12px;margin-top:-8px">Le taux officiel peut différer du taux du marché. Si vous saisissez votre propre taux, il est gardé et la mise à jour automatique s'arrête.</small>
            <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">Enregistrer</button><button class="btn btn-ghost" type="button" data-action="refresh-rates">Actualiser le taux du jour</button></div>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Ma règle budgétaire</h2><p>Par défaut 75 / 15 / 10. Adaptez-la à votre situation.</p></div>
          <form class="stack" data-form="rules" novalidate>
            <div class="row-3">
              <label class="field"><span>Dépenses max (%)</span><input class="input" type="number" min="0" max="100" step="1" name="depensesMax" value="${esc(r.depensesMax)}"></label>
              <label class="field"><span>Projets cible (%)</span><input class="input" type="number" min="0" max="100" step="1" name="projetsMax" value="${esc(r.projetsMax)}"></label>
              <label class="field"><span>Épargne min (%)</span><input class="input" type="number" min="0" max="100" step="1" name="epargneMin" value="${esc(r.epargneMin)}"></label>
            </div>
            <p class="rules-sum" id="rules-sum">Total : ${r.depensesMax + r.projetsMax + r.epargneMin} %</p>
            <div class="row">
              <label class="field"><span>Alerte loyer au-delà de (%)</span><input class="input" type="number" min="0" max="100" step="1" name="loyerMax" value="${esc(r.loyerMax)}"><small>Part des revenus. Repère courant : 30 %.</small></label>
              <label class="field"><span>Dépenses à surveiller dès (%)</span><input class="input" type="number" min="0" max="100" step="1" name="alerteDep" value="${esc(r.alerteDep)}"><small>Alerte orange avant le plafond.</small></label>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">Enregistrer la règle</button><button class="btn btn-ghost" type="button" data-action="reset-rules">Revenir à 75 / 15 / 10</button></div>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Sécurité</h2></div>
          <form class="stack" data-form="password" novalidate>
            <label class="field"><span>Nouveau mot de passe</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="8"></label>
            <label class="field"><span>Confirmer</span><input class="input" type="password" name="confirm" autocomplete="new-password"></label>
            <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">Changer le mot de passe</button><button class="btn btn-ghost" type="button" data-action="signout">${icon('logout')} Se déconnecter</button></div>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Sauvegarde et import</h2><p>Gardez une copie de vos données, ou importez un ancien carnet (fichier JSON du carnet DOXTEHAD v1 ou v2, ou une sauvegarde CAP FIN).</p></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-ghost" data-action="export-json">${icon('download')} Télécharger une sauvegarde</button>
            <label class="btn btn-ghost" style="cursor:pointer">${icon('upload')} Importer un fichier JSON<input type="file" accept=".json,application/json" data-action="import-json" hidden></label>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Application</h2><p>Installez CAP FIN sur votre téléphone ou votre ordinateur pour l'ouvrir comme une appli, même sans connexion.</p></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <button class="btn btn-accent" data-action="install" id="install-btn" ${window.__cap75Install ? '' : 'hidden'}>Installer CAP FIN</button>
            <span class="muted" style="font-size:13px">${installed ? 'CAP FIN est installée sur cet appareil.' : 'Sur téléphone : menu du navigateur, puis « Ajouter à l’écran d’accueil ».'}</span>
          </div>
        </section>
      </div>`;
  }

  function saveSettings(kind, form) {
    const fd = new FormData(form);
    const p = Object.assign({}, S.profile);
    if (kind === 'profile') {
      p.display_name = String(fd.get('display_name') || '').trim().slice(0, 60);
      p.auto_lock_minutes = Number(fd.get('auto_lock_minutes')) || 0;
      D.save('profiles', p);
      toast('Profil enregistré.', 'success');
      renderApp();
      return;
    }
    if (kind === 'currency') {
      const cdf = parseFloat(fd.get('CDF'));
      const eur = parseFloat(fd.get('EUR'));
      if (!(cdf > 0) || !(eur > 0)) return formError(form, 'Les taux doivent être supérieurs à 0.');
      const old = Object.assign({}, F.DEFAULT_RATES, p.rates);
      const changed = Math.abs(old.CDF - cdf) > 0.001 || Math.abs(old.EUR - eur) > 0.00001;
      // Un taux saisi à la main est celui que l'on veut garder : on coupe la mise à jour
      // automatique pour qu'il ne soit pas écrasé le lendemain (le marché diffère souvent du taux officiel).
      const auto = changed ? false : Boolean(fd.get('auto_rates'));
      p.base_currency = fd.get('base_currency');
      p.rates = Object.assign({}, p.rates, { USD: 1, CDF: cdf, EUR: eur, _auto: auto });
      if (changed || !p.rates._date) Object.assign(p.rates, { _source: 'manuel', _date: today() });
      if (changed && fd.get('auto_rates')) toast('Votre taux est gardé : la mise à jour automatique est désactivée.', 'info', 6000);
      try {
        localStorage.setItem(ENTRY_KEY, fd.get('entry_currency') || 'auto');
      } catch {
        /* réglage local non enregistré */
      }
      D.save('profiles', p);
      toast('Devises enregistrées.', 'success');
      refresh();
      if (auto) refreshRates(false);
      return;
    }
    if (kind === 'rules') {
      const rules = {
        depensesMax: Number(fd.get('depensesMax')),
        projetsMax: Number(fd.get('projetsMax')),
        epargneMin: Number(fd.get('epargneMin'))
      };
      const vals = Object.values(rules);
      if (vals.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) return formError(form, 'Chaque pourcentage doit être compris entre 0 et 100.');
      if (vals.reduce((a, b) => a + b, 0) > 100) return formError(form, 'Le total ne peut pas dépasser 100 %.');
      const loyerMax = Number(fd.get('loyerMax'));
      const alerteDep = Number(fd.get('alerteDep'));
      if (![loyerMax, alerteDep].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) return formError(form, 'Les seuils d’alerte doivent être compris entre 0 et 100.');
      p.rules = Object.assign(rules, { loyerMax, alerteDep });
      D.save('profiles', p);
      toast(`Règle ${rules.depensesMax}/${rules.projetsMax}/${rules.epargneMin} enregistrée.`, 'success');
      refresh();
    }
  }

  async function changePassword(form) {
    const fd = new FormData(form);
    const problem = passwordProblem(fd.get('password'), fd.get('confirm'));
    if (problem) return formError(form, problem);
    try {
      await D.updatePassword(fd.get('password'));
      form.reset();
      const err = $('.form-error', form);
      if (err) err.remove();
      toast('Mot de passe changé.', 'success');
    } catch (err) {
      formError(form, err.message);
    }
  }

  // ------------------------------------------------------------
  // Exports et import
  // ------------------------------------------------------------
  function download(content, name, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCSV(scope) {
    let ops = S.operations;
    let label = 'complet';
    if (scope === 'month') {
      ops = ops.filter((o) => F.inMonth(o, ui.month));
      label = ui.month;
    } else if (scope === 'filtered') {
      ops = filteredOps();
      label = ui.filters.allMonths ? 'selection' : ui.month;
    }
    if (!ops.length) {
      toast('Aucune opération à exporter.', 'warning');
      return;
    }
    download(F.toCSV(ops, { accounts: S.accounts, projects: S.projects, profile: S.profile }), `capfin-operations-${label}.csv`, 'text/csv;charset=utf-8');
    toast(`${ops.length} opération(s) exportée(s).`, 'success');
  }

  function exportJSON() {
    const data = {
      app: 'CAP FIN',
      version: 3,
      exported_at: new Date().toISOString(),
      profile: { base_currency: S.profile.base_currency, rates: S.profile.rates, rules: S.profile.rules },
      accounts: S.accounts,
      projects: S.projects,
      recurring: S.recurring,
      operations: S.operations
    };
    download(JSON.stringify(data, null, 2), `capfin-sauvegarde-${today()}.json`, 'application/json');
    toast('Sauvegarde téléchargée.', 'success');
  }

  function importJSON(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast('Fichier trop volumineux (10 Mo maximum).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch {
        toast("Ce fichier n'est pas un JSON lisible.", 'error');
        return;
      }
      const plan = data && (data.app === 'CAP FIN' || data.app === 'Cap75') ? planCap75Import(data) : planLegacyImport(data);
      if (plan.error) {
        toast(plan.error, 'error', 7000);
        return;
      }
      const ok = await confirmBox({
        title: 'Importer ces données ?',
        message: `${plan.summary} Elles s'ajouteront à vos données actuelles.${plan.warnings ? ` ${plan.warnings} élément(s) invalide(s) seront ignorés.` : ''}`,
        confirm: 'Importer'
      });
      if (!ok) return;
      plan.apply();
      toast('Import terminé.', 'success');
      refresh();
    };
    reader.readAsText(file);
  }

  function planLegacyImport(data) {
    const res = F.convertLegacyBackup(data, null);
    if (!res.operations.length && !res.projects.length) return { error: res.errors[0] || 'Rien à importer dans ce fichier.' };
    return {
      summary: `${res.operations.length} opération(s) et ${res.projects.length} projet(s) de l'ancien carnet (montants en USD).`,
      warnings: res.errors.length,
      apply() {
        let target = activeAccounts().find((a) => a.currency === 'USD') || activeAccounts()[0];
        if (!target) {
          target = { id: F.uuid(), name: 'Caisse', kind: 'cash', currency: 'USD', opening_balance: 0, archived: false };
          D.save('accounts', target);
        }
        res.projects.forEach((p) => D.save('projects', p));
        res.operations.forEach((o) => D.save('operations', Object.assign(o, { account_id: target.id })));
      }
    };
  }

  function planCap75Import(data) {
    const lists = ['accounts', 'projects', 'recurring', 'operations'];
    if (!lists.every((k) => Array.isArray(data[k]))) return { error: 'Sauvegarde CAP FIN incomplète.' };
    // Nouveaux identifiants pour éviter tout conflit avec les données existantes
    const map = new Map();
    const newId = (old) => {
      if (!old) return null;
      if (!map.has(old)) map.set(old, F.uuid());
      return map.get(old);
    };
    const strip = (row) => {
      const r = Object.assign({}, row);
      delete r.user_id;
      delete r.created_at;
      delete r.updated_at;
      return r;
    };
    const accounts = data.accounts.map((a) => Object.assign(strip(a), { id: newId(a.id) }));
    const projects = data.projects.map((p) => Object.assign(strip(p), { id: newId(p.id) }));
    const recurring = data.recurring.map((r) => Object.assign(strip(r), {
      id: newId(r.id), account_id: newId(r.account_id), to_account_id: newId(r.to_account_id), project_id: newId(r.project_id)
    }));
    const valid = data.operations.filter((o) => F.TYPES.includes(o.type) && Number(o.amount) > 0 && F.parseISODate(o.date));
    const operations = valid.map((o) => Object.assign(strip(o), {
      id: F.uuid(), account_id: newId(o.account_id), to_account_id: newId(o.to_account_id), project_id: newId(o.project_id), recurring_id: newId(o.recurring_id)
    }));
    return {
      summary: `${accounts.length} compte(s), ${operations.length} opération(s), ${projects.length} projet(s) et ${recurring.length} récurrence(s).`,
      warnings: data.operations.length - valid.length,
      apply() {
        accounts.forEach((a) => D.save('accounts', a));
        projects.forEach((p) => D.save('projects', p));
        recurring.forEach((r) => D.save('recurring', r));
        operations.forEach((o) => D.save('operations', o));
      }
    };
  }

  // ------------------------------------------------------------
  // Évènements
  // ------------------------------------------------------------
  async function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'INPUT') return;
    const a = el.dataset.action;
    const id = el.dataset.id;
    switch (a) {
      case 'go':
        closeModal();
        return go(el.dataset.view);
      case 'more': return openMoreMenu();
      case 'toggle-pwd': return togglePassword(el);
      case 'toggle-alerts':
        ui.showAllAlerts = !ui.showAllAlerts;
        return renderView();
      case 'refresh-rates': return refreshRates(true);
      case 'month':
        ui.month = F.shiftMonth(ui.month, Number(el.dataset.delta));
        return renderView();
      case 'close-modal': return closeModal();
      case 'reload': return location.reload();
      case 'auth-mode':
        ui.authMode = el.dataset.mode;
        ui.authNotice = null;
        return renderAuth();
      case 'resend-confirmation':
        try {
          await D.resendConfirmation(ui.pendingEmail);
          ui.authNotice = { type: 'ok', text: 'E-mail renvoyé.' };
        } catch (err) {
          ui.authNotice = { type: 'error', text: err.message };
        }
        return renderAuth();
      case 'signout': return doSignOut();
      case 'new-operation': return openOperationModal();
      case 'edit-operation': return openOperationModal(id);
      case 'duplicate-operation': {
        const o = S.operations.find((x) => x.id === id);
        if (!o) return;
        const copy = Object.assign({}, o, { date: today(), recurring_id: null });
        delete copy.id;
        return openOperationModal(null, copy);
      }
      case 'delete-operation': return deleteOperation(id);
      case 'new-account': return openAccountModal();
      case 'edit-account': return openAccountModal(id);
      case 'archive-account': return toggleArchiveAccount(id);
      case 'delete-account': return deleteAccount(id);
      case 'transfer-from': {
        const from = id || (activeAccounts()[0] || {}).id;
        const other = activeAccounts().find((x) => x.id !== from);
        if (!other) {
          toast('Ajoutez un deuxième compte pour faire un transfert.', 'warning');
          return;
        }
        const acc = S.accounts.find((x) => x.id === from);
        return openOperationModal(null, { type: 'Transfert', account_id: from, to_account_id: other.id, currency: acc.currency, category: 'Transfert' });
      }
      case 'new-recurring': return openRecurringModal();
      case 'edit-recurring': return openRecurringModal(id);
      case 'toggle-recurring': return toggleRecurring(id);
      case 'delete-recurring': return deleteRecurring(id);
      case 'new-project': return openProjectModal();
      case 'edit-project': return openProjectModal(id);
      case 'delete-project': return deleteProject(id);
      case 'contribute': return openContribution(id);
      case 'export-csv': return exportCSV(el.dataset.scope);
      case 'export-json': return exportJSON();
      case 'print-report': return printReport();
      case 'reset-rules': {
        const f = $('form[data-form=rules]');
        f.elements.depensesMax.value = 75;
        f.elements.projetsMax.value = 15;
        f.elements.epargneMin.value = 10;
        updateRulesSum(f);
        return;
      }
      case 'install':
        if (window.__cap75Install) {
          window.__cap75Install.prompt();
          window.__cap75Install = null;
          el.hidden = true;
        }
        return;
      default:
    }
  }

  async function onSubmit(e) {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form;
    if (['signin', 'signup', 'forgot', 'new-password'].includes(kind)) {
      const btn = form.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      try {
        await handleAuthForm(kind, form, new FormData(form));
      } finally {
        if (btn && document.body.contains(btn)) btn.disabled = false;
      }
      return;
    }
    switch (kind) {
      case 'operation': return saveOperation(form);
      case 'account': return saveAccount(form);
      case 'recurring': return saveRecurring(form);
      case 'project': return saveProject(form);
      case 'profile':
      case 'currency':
      case 'rules':
        return saveSettings(kind, form);
      case 'password': return changePassword(form);
      default:
    }
  }

  async function handleAuthForm(kind, form, fd) {
    const email = String(fd.get('email') || '').trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    try {
      if (kind === 'signin') {
        if (!validEmail || !fd.get('password')) return formError(form, 'Saisissez votre e-mail et votre mot de passe.');
        const session = await D.signIn(email, fd.get('password'));
        ui.authNotice = null;
        await enterApp(session);
      } else if (kind === 'signup') {
        const name = String(fd.get('name') || '').trim();
        if (!name) return formError(form, 'Indiquez votre nom.');
        if (!validEmail) return formError(form, 'Adresse e-mail invalide.');
        const problem = passwordProblem(fd.get('password'), fd.get('confirm'));
        if (problem) return formError(form, problem);
        const session = await D.signUp(email, fd.get('password'), name);
        ui.authNotice = null;
        if (session) {
          await enterApp(session);
        } else {
          ui.pendingEmail = email;
          ui.authMode = 'check-email';
          renderAuth();
        }
      } else if (kind === 'forgot') {
        if (!validEmail) return formError(form, 'Adresse e-mail invalide.');
        await D.sendPasswordReset(email);
        ui.authMode = 'signin';
        ui.authNotice = { type: 'ok', text: `Si un compte existe pour ${email}, un lien de réinitialisation vient d'être envoyé.` };
        renderAuth();
      } else if (kind === 'new-password') {
        const problem = passwordProblem(fd.get('password'), fd.get('confirm'));
        if (problem) return formError(form, problem);
        await D.updatePassword(fd.get('password'));
        ui.authMode = 'signin';
        ui.authNotice = null;
        toast('Mot de passe enregistré.', 'success');
        const session = await D.getSession();
        if (session) await enterApp(session);
        else renderAuth();
      }
    } catch (err) {
      formError(form, err.message);
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.dataset.action === 'import-json') return importJSON(t);
    if (t.dataset.filter) {
      if (t.dataset.filter === 'q') return;
      if (t.dataset.filter === 'project') ui.projectFilter = t.value;
      else ui.filters[t.dataset.filter] = t.type === 'checkbox' ? t.checked : t.value;
      return renderView();
    }
    const form = t.closest('form[data-form=operation], form[data-form=recurring]');
    if (!form) return;
    if (t.name === 'type' || t.name === 'repeat') syncOperationForm(form);
    if (t.name === 'account_id' && entryCurrency() === 'auto') {
      const acc = S.accounts.find((a) => a.id === t.value);
      if (acc && form.elements.currency) form.elements.currency.value = acc.currency;
    }
    if (t.name === 'currency' || t.name === 'account_id') updateConvertHint(form);
  }

  let searchTimer;
  function onInput(e) {
    const t = e.target;
    if (t.dataset.filter === 'q') {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        ui.filters.q = t.value;
        const pos = t.selectionStart;
        renderView();
        const again = $('[data-filter=q]');
        if (again) {
          again.focus();
          again.setSelectionRange(pos, pos);
        }
      }, 200);
      return;
    }
    const rulesForm = t.closest('form[data-form=rules]');
    if (rulesForm) updateRulesSum(rulesForm);
    if (t.name === 'amount') {
      const opForm = t.closest('form[data-form=operation], form[data-form=recurring]');
      if (opForm) updateConvertHint(opForm);
    }
  }

  function updateRulesSum(form) {
    const sum = ['depensesMax', 'projetsMax', 'epargneMin'].reduce((s, k) => s + (Number(form.elements[k].value) || 0), 0);
    const el = $('#rules-sum');
    if (!el) return;
    el.textContent = `Total : ${sum} %${sum > 100 ? ', dépasse 100 %' : ''}`;
    el.classList.toggle('bad', sum > 100);
  }

  // Installation PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__cap75Install = e;
    const b = document.getElementById('install-btn');
    if (b) b.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    window.__cap75Install = null;
    toast('CAP FIN est installée sur cet appareil.', 'success');
  });

  // Point d'accès pour les tests
  window.Cap75App = { ui, go, refresh };
})();
