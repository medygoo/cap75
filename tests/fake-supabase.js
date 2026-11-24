/* ============================================================
   Faux client Supabase pour les tests et la démo locale.
   Imite supabase-js v2 (auth + tables) avec stockage dans
   localStorage et la règle RLS « chacun ne voit que ses lignes ».
   NE JAMAIS charger en production.
   ============================================================ */
(function (global) {
  'use strict';

  const DB_KEY = '__fake_sb';
  const SESSION_KEY = '__fake_sb_session';
  const TABLES = ['profiles', 'accounts', 'projects', 'recurring', 'operations'];

  function load() {
    try {
      const db = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
      if (db) return db;
    } catch {
      /* base neuve */
    }
    const fresh = { users: [] };
    TABLES.forEach((t) => {
      fresh[t] = [];
    });
    return fresh;
  }
  function persist(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
  function uid() {
    return global.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(16).slice(2);
  }
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const delay = () => new Promise((r) => setTimeout(r, 5));

  function makeSession(user) {
    return {
      access_token: 'fake-' + user.id,
      token_type: 'bearer',
      user: { id: user.id, email: user.email, user_metadata: user.user_metadata || {}, identities: [{ id: user.id }] }
    };
  }

  function createClient() {
    const listeners = [];
    const currentSession = () => {
      try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      } catch {
        return null;
      }
    };
    const setSession = (s, event) => {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
      listeners.forEach((cb) => setTimeout(() => cb(event, s), 0));
    };

    function newUserRows(db, user) {
      const now = new Date().toISOString();
      db.profiles.push({
        id: user.id,
        display_name: (user.user_metadata && user.user_metadata.display_name) || user.email.split('@')[0],
        base_currency: 'USD',
        rates: { USD: 1, CDF: 2850, EUR: 0.92 },
        rules: { depensesMax: 75, projetsMax: 15, epargneMin: 10 },
        auto_lock_minutes: 30,
        created_at: now,
        updated_at: now
      });
      db.accounts.push({ id: uid(), user_id: user.id, name: 'Caisse', kind: 'cash', currency: 'USD', opening_balance: 0, archived: false, created_at: now, updated_at: now });
    }

    const auth = {
      async getSession() {
        await delay();
        return { data: { session: currentSession() }, error: null };
      },
      onAuthStateChange(cb) {
        listeners.push(cb);
        setTimeout(() => cb('INITIAL_SESSION', currentSession()), 0);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signInWithPassword({ email, password }) {
        await delay();
        const db = load();
        const u = db.users.find((x) => x.email === String(email).toLowerCase() && x.password === password);
        if (!u) return { data: { session: null, user: null }, error: { message: 'Invalid login credentials', status: 400 } };
        const s = makeSession(u);
        setSession(s, 'SIGNED_IN');
        return { data: { session: s, user: s.user }, error: null };
      },
      async signUp({ email, password, options }) {
        await delay();
        const db = load();
        const mail = String(email).toLowerCase();
        const existing = db.users.find((x) => x.email === mail);
        if (existing) return { data: { user: { id: existing.id, identities: [] }, session: null }, error: null };
        if (!password || password.length < 6) return { data: {}, error: { message: 'Password should be at least 6 characters' } };
        const user = { id: uid(), email: mail, password, user_metadata: (options && options.data) || {} };
        db.users.push(user);
        newUserRows(db, user);
        persist(db);
        const confirm = localStorage.getItem('__fake_sb_confirm') === '1';
        if (confirm) return { data: { user: { id: user.id, identities: [{}] }, session: null }, error: null };
        const s = makeSession(user);
        setSession(s, 'SIGNED_IN');
        return { data: { user: s.user, session: s }, error: null };
      },
      async signOut() {
        await delay();
        setSession(null, 'SIGNED_OUT');
        return { error: null };
      },
      async resetPasswordForEmail() {
        await delay();
        return { data: {}, error: null };
      },
      async resend() {
        await delay();
        return { data: {}, error: null };
      },
      async updateUser({ password }) {
        await delay();
        const s = currentSession();
        if (!s) return { data: {}, error: { message: 'Auth session missing!' } };
        const db = load();
        const u = db.users.find((x) => x.id === s.user.id);
        if (u.password === password) return { data: {}, error: { message: 'New password should be different from the old password.' } };
        u.password = password;
        persist(db);
        listeners.forEach((cb) => setTimeout(() => cb('USER_UPDATED', s), 0));
        return { data: { user: s.user }, error: null };
      }
    };

    function from(table) {
      const state = { op: 'select', filters: [], order: null, single: false, row: null };
      const ownerCol = table === 'profiles' ? 'id' : 'user_id';
      const run = async () => {
        await delay();
        if (global.__fakeOffline) return { data: null, error: { message: 'TypeError: Failed to fetch' } };
        const s = currentSession();
        if (!s) return { data: null, error: { message: 'JWT missing', code: '401' } };
        const me = s.user.id;
        const db = load();
        let rows = db[table];
        if (!rows) return { data: null, error: { message: `relation "${table}" does not exist`, code: '42P01' } };
        const match = (r) => r[ownerCol] === me && state.filters.every(([c, v]) => r[c] === v);
        if (state.op === 'select') {
          let out = rows.filter(match).map(clone);
          if (state.order) {
            const [col, asc] = state.order;
            out.sort((a, b) => (a[col] === b[col] ? 0 : (a[col] < b[col] ? -1 : 1) * (asc ? 1 : -1)));
          }
          if (state.single) return { data: out[0] || null, error: null };
          return { data: out, error: null };
        }
        if (state.op === 'delete') {
          db[table] = rows.filter((r) => !match(r));
          persist(db);
          return { data: null, error: null };
        }
        if (state.op === 'upsert') {
          const row = clone(state.row);
          if (row[ownerCol] !== undefined && row[ownerCol] !== me) {
            return { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };
          }
          row[ownerCol] = me;
          if ('amount' in row && !(Number(row.amount) > 0)) {
            return { data: null, error: { message: 'violates check constraint', code: '23514' } };
          }
          const now = new Date().toISOString();
          const idx = rows.findIndex((r) => r.id === row.id);
          if (idx >= 0) {
            if (rows[idx][ownerCol] !== me) return { data: null, error: { message: 'row-level security', code: '42501' } };
            rows[idx] = Object.assign({}, rows[idx], row, { updated_at: now });
          } else {
            rows.push(Object.assign({ created_at: now, updated_at: now }, row));
          }
          persist(db);
          return { data: null, error: null };
        }
        return { data: null, error: { message: 'opération inconnue' } };
      };
      const builder = {
        select() {
          state.op = 'select';
          return builder;
        },
        eq(col, val) {
          state.filters.push([col, val]);
          return builder;
        },
        order(col, opts) {
          state.order = [col, !opts || opts.ascending !== false];
          return builder;
        },
        maybeSingle() {
          state.single = true;
          return builder;
        },
        upsert(row) {
          state.op = 'upsert';
          state.row = row;
          return builder;
        },
        delete() {
          state.op = 'delete';
          return builder;
        },
        then(resolve, reject) {
          return run().then(resolve, reject);
        }
      };
      return builder;
    }

    return { auth, from };
  }

  global.supabase = { createClient };
})(typeof window !== 'undefined' ? window : globalThis);
