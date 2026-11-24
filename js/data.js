/* ============================================================
   Cap75 — couche de données Supabase
   - Authentification (connexion, invitation, mot de passe oublié)
   - Chargement des tables de l'utilisateur (protégées par RLS)
   - Cache local pour l'usage hors ligne
   - File d'attente des modifications, rejouée au retour du réseau
   ============================================================ */
/* global URLSearchParams */

(function (global) {
  'use strict';

  const TABLES = ['accounts', 'projects', 'recurring', 'operations'];
  const SERVER_FIELDS = ['created_at', 'updated_at'];

  let client = null;
  let userId = null;
  let flushing = false;
  const listeners = { change: [], sync: [] };

  const state = {
    profile: null,
    accounts: [],
    projects: [],
    recurring: [],
    operations: []
  };

  // Informations lues dans l'URL d'un lien e-mail (invitation, récupération)
  const urlAuth = readUrlAuth();

  function readUrlAuth() {
    try {
      const loc = global.location || {};
      const hash = new URLSearchParams(String(loc.hash || '').replace(/^#/, ''));
      const query = new URLSearchParams(String(loc.search || ''));
      return {
        type: hash.get('type') || query.get('type') || null,
        error: hash.get('error_description') || query.get('error_description') || null
      };
    } catch {
      return { type: null, error: null };
    }
  }

  // ------------------------------------------------------------
  // Initialisation
  // ------------------------------------------------------------
  function isConfigured() {
    const c = global.CAP75_CONFIG || {};
    return Boolean(c.supabaseUrl && c.supabaseAnonKey && !/VOTRE|YOUR/i.test(c.supabaseUrl));
  }

  function init() {
    if (client) return client;
    if (!isConfigured()) return null;
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('Bibliothèque Supabase introuvable.');
    }
    const c = global.CAP75_CONFIG;
    client = global.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
        storageKey: 'cap75-auth'
      }
    });
    global.addEventListener('online', () => flush());
    return client;
  }

  function redirectUrl() {
    const l = global.location;
    return l.origin + l.pathname;
  }

  // ------------------------------------------------------------
  // Authentification
  // ------------------------------------------------------------
  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw translateAuthError(error);
    return data.session;
  }

  function onAuthChange(cb) {
    return client.auth.onAuthStateChange((event, session) => cb(event, session));
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw translateAuthError(error);
    return data.session;
  }

  // Inscription libre : renvoie la session si la confirmation e-mail est désactivée,
  // sinon null (l'utilisateur doit cliquer le lien reçu par e-mail).
  async function signUp(email, password, displayName) {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl(),
        data: { display_name: displayName || '' }
      }
    });
    if (error) throw translateAuthError(error);
    // Supabase renvoie un utilisateur sans identité si l'e-mail existe déjà
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez le mot de passe.');
    }
    return data.session;
  }

  async function resendConfirmation(email) {
    const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectUrl() } });
    if (error) throw translateAuthError(error);
  }

  async function signOut() {
    const uid = userId;
    try {
      await client.auth.signOut();
    } finally {
      if (uid) clearLocal(uid);
      resetState();
    }
  }

  async function sendPasswordReset(email) {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
    if (error) throw translateAuthError(error);
  }

  async function updatePassword(password) {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw translateAuthError(error);
  }

  function translateAuthError(error) {
    const msg = (error && error.message) || '';
    const map = [
      [/invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
      [/email not confirmed/i, "Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien reçu par e-mail."],
      [/rate limit|too many/i, 'Trop de tentatives. Patientez quelques minutes puis réessayez.'],
      [/password should be at least|weak password/i, 'Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.'],
      [/same.*password|different from the old/i, "Le nouveau mot de passe doit être différent de l'ancien."],
      [/signups not allowed|signup is disabled/i, 'Les inscriptions sont fermées pour le moment.'],
      [/already registered|already been registered|user already exists/i, 'Un compte existe déjà avec cet e-mail. Connectez-vous.'],
      [/invalid.*email|unable to validate email/i, 'Adresse e-mail invalide.'],
      [/email.*(link|otp).*(expired|invalid)|token has expired/i, 'Ce lien a expiré. Demandez-en un nouveau.'],
      [/fetch|network/i, 'Pas de connexion au serveur. Vérifiez votre accès Internet.']
    ];
    const found = map.find(([re]) => re.test(msg));
    const e = new Error(found ? found[1] : msg || 'Erreur de connexion.');
    e.original = error;
    return e;
  }

  // ------------------------------------------------------------
  // Cache local et file d'attente
  // ------------------------------------------------------------
  const cacheKey = (uid) => `cap75_cache_${uid}`;
  const queueKey = (uid) => `cap75_queue_${uid}`;

  function readJSON(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('[Cap75] Cache local indisponible :', err && err.message);
    }
  }

  function saveCache() {
    if (userId) writeJSON(cacheKey(userId), state);
  }

  function getQueue() {
    return userId ? readJSON(queueKey(userId), []) : [];
  }

  function setQueue(q) {
    if (userId) writeJSON(queueKey(userId), q);
    emit('sync', { pending: q.length });
  }

  function clearLocal(uid) {
    try {
      global.localStorage.removeItem(cacheKey(uid));
      global.localStorage.removeItem(queueKey(uid));
    } catch {
      /* rien */
    }
  }

  function resetState() {
    userId = null;
    state.profile = null;
    TABLES.forEach((t) => {
      state[t] = [];
    });
  }

  // ------------------------------------------------------------
  // Chargement
  // ------------------------------------------------------------
  function normalizeRow(row) {
    const r = Object.assign({}, row);
    ['amount', 'opening_balance', 'target', 'initial_saved'].forEach((k) => {
      if (k in r && r[k] !== null) r[k] = Number(r[k]);
    });
    return r;
  }

  function defaultProfile(uid) {
    return {
      id: uid,
      display_name: '',
      base_currency: 'USD',
      rates: { USD: 1, CDF: 2850, EUR: 0.92 },
      rules: { depensesMax: 75, projetsMax: 15, epargneMin: 10 },
      auto_lock_minutes: 30
    };
  }

  async function load(uid) {
    userId = uid;
    const cached = readJSON(cacheKey(uid), null);
    if (cached) Object.assign(state, cached);

    try {
      const [profileRes, ...tableRes] = await Promise.all([
        client.from('profiles').select('*').eq('id', uid).maybeSingle(),
        ...TABLES.map((t) =>
          client
            .from(t)
            .select('*')
            .order(t === 'operations' ? 'date' : 'created_at', { ascending: t !== 'operations' })
        )
      ]);
      const failed = [profileRes, ...tableRes].find((r) => r.error);
      if (failed) throw failed.error;

      // Les modifications locales en attente gardent la priorité sur le serveur
      const pending = getQueue();
      state.profile = profileRes.data || defaultProfile(uid);
      TABLES.forEach((t, i) => {
        state[t] = (tableRes[i].data || []).map(normalizeRow);
      });
      pending.forEach((item) => applyLocal(item));
      saveCache();
      emit('sync', { pending: pending.length });
      if (pending.length) flush();
      return { source: 'server' };
    } catch (err) {
      if (!cached) {
        if (isNetworkError(err)) {
          state.profile = state.profile || defaultProfile(uid);
          return { source: 'empty-offline' };
        }
        throw err;
      }
      emit('sync', { pending: getQueue().length, offline: true });
      return { source: 'cache' };
    }
  }

  // ------------------------------------------------------------
  // Écritures
  // ------------------------------------------------------------
  function applyLocal(item) {
    if (item.table === 'profiles') {
      state.profile = Object.assign({}, state.profile, item.row);
      return;
    }
    const list = state[item.table];
    if (!list) return;
    if (item.op === 'delete') {
      state[item.table] = list.filter((r) => r.id !== item.id);
      return;
    }
    const idx = list.findIndex((r) => r.id === item.row.id);
    const row = normalizeRow(item.row);
    if (idx === -1) list.push(row);
    else list[idx] = Object.assign({}, list[idx], row);
  }

  function cleanRow(row) {
    const r = Object.assign({}, row);
    SERVER_FIELDS.forEach((f) => delete r[f]);
    return r;
  }

  function save(table, row) {
    const clean = cleanRow(row);
    if (table === 'profiles') clean.id = userId;
    else clean.user_id = userId;
    const item = { op: 'upsert', table, row: clean, at: Date.now() };
    applyLocal(item);
    enqueue(item);
    return clean;
  }

  function remove(table, id) {
    const item = { op: 'delete', table, id, at: Date.now() };
    applyLocal(item);
    enqueue(item);
  }

  function enqueue(item) {
    const q = getQueue();
    q.push(item);
    setQueue(q);
    saveCache();
    emit('change', item);
    flush();
  }

  function isNetworkError(err) {
    if (!err) return false;
    if (global.navigator && global.navigator.onLine === false) return true;
    const msg = String(err.message || err);
    return /failed to fetch|networkerror|network request failed|load failed/i.test(msg);
  }

  async function flush() {
    if (flushing || !client || !userId) return;
    flushing = true;
    const rejected = [];
    try {
      let q = getQueue();
      while (q.length) {
        const item = q[0];
        let res;
        if (item.op === 'delete') {
          res = await client.from(item.table).delete().eq('id', item.id);
        } else {
          res = await client.from(item.table).upsert(item.row, { onConflict: 'id' });
        }
        if (res.error) {
          if (isNetworkError(res.error)) break; // nouvel essai au retour du réseau
          // Refus définitif (contrainte, droits) : on retire l'action et on le signale
          rejected.push({ item, message: res.error.message });
        }
        q = getQueue().slice(1);
        setQueue(q);
      }
    } catch (err) {
      if (!isNetworkError(err)) console.error('[Cap75] Synchronisation :', err);
    } finally {
      flushing = false;
      emit('sync', { pending: getQueue().length, rejected });
      if (rejected.length && userId) {
        await load(userId).catch(() => {});
        emit('change', { op: 'reload' });
      }
    }
  }

  // ------------------------------------------------------------
  // Évènements
  // ------------------------------------------------------------
  function on(event, cb) {
    (listeners[event] || (listeners[event] = [])).push(cb);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error(err);
      }
    });
  }

  global.Cap75Data = {
    state,
    urlAuth,
    isConfigured,
    init,
    getSession,
    onAuthChange,
    signIn,
    signUp,
    resendConfirmation,
    signOut,
    sendPasswordReset,
    updatePassword,
    load,
    save,
    remove,
    flush,
    pendingCount: () => getQueue().length,
    on
  };
})(typeof window !== 'undefined' ? window : globalThis);
