/* ============================================================
   CAP FIN — moteur de calcul (fonctions pures, sans DOM ni réseau)
   Montants : chaque opération garde sa devise ; les totaux sont
   convertis dans la devise principale avec les taux de l'utilisateur.
   Taux : unités de devise pour 1 USD (ex. { USD: 1, CDF: 2850, EUR: 0.92 }).
   ============================================================ */
/* global module, globalThis */

(function (global) {
  'use strict';

  const TYPES = ['Revenu', 'Dépense', 'Projet', 'Épargne', 'Transfert'];
  const BUDGET_TYPES = ['Revenu', 'Dépense', 'Projet', 'Épargne'];
  const OUTFLOW_TYPES = ['Dépense', 'Projet', 'Épargne'];

  const CURRENCIES = {
    USD: { code: 'USD', label: 'Dollar US', symbol: '$', decimals: 2 },
    CDF: { code: 'CDF', label: 'Franc congolais', symbol: 'FC', decimals: 0 },
    EUR: { code: 'EUR', label: 'Euro', symbol: '€', decimals: 2 }
  };

  const DEFAULT_RATES = { USD: 1, CDF: 2850, EUR: 0.92 };
  const DEFAULT_RULES = { depensesMax: 75, projetsMax: 15, epargneMin: 10 };

  // ------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------
  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function num(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  function uuid() {
    const c = global.crypto || (typeof crypto !== 'undefined' ? crypto : null);
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    const bytes = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(bytes);
    else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // Date locale AAAA-MM-JJ (évite le décalage UTC de toISOString)
  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function todayISO(now) {
    return toISODate(now || new Date());
  }

  function parseISODate(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  // ------------------------------------------------------------
  // Mois
  // ------------------------------------------------------------
  function monthKey(dateStr) {
    return String(dateStr || '').slice(0, 7);
  }

  function shiftMonth(month, delta) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(month, locale, short) {
    const [y, m] = month.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString(locale || 'fr-FR', {
      month: short ? 'short' : 'long',
      year: 'numeric'
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function inMonth(op, month) {
    return !month || monthKey(op.date) === month;
  }

  // ------------------------------------------------------------
  // Devises
  // ------------------------------------------------------------
  function convert(amount, from, to, rates) {
    const a = num(amount);
    if (!from || !to || from === to) return a;
    const r = Object.assign({}, DEFAULT_RATES, rates || {});
    const rf = num(r[from]);
    const rt = num(r[to]);
    if (rf <= 0 || rt <= 0) return a;
    return (a / rf) * rt;
  }

  function toBase(op, profile) {
    const base = (profile && profile.base_currency) || 'USD';
    return convert(op.amount, op.currency || 'USD', base, profile && profile.rates);
  }

  function formatMoney(amount, currency, locale) {
    const cur = CURRENCIES[currency] || CURRENCIES.USD;
    const n = num(amount);
    const s = Math.abs(n).toLocaleString(locale || 'fr-FR', {
      minimumFractionDigits: cur.decimals,
      maximumFractionDigits: cur.decimals
    });
    const sign = n < 0 ? '−' : '';
    return `${sign}${s} ${cur.symbol}`;
  }

  // ------------------------------------------------------------
  // Totaux et règle 75/15/10
  // ------------------------------------------------------------
  function totals(ops, profile, month) {
    const t = { revenus: 0, depenses: 0, projets: 0, epargne: 0, count: 0 };
    (ops || []).forEach((op) => {
      if (!inMonth(op, month) || op.type === 'Transfert') return;
      const v = toBase(op, profile);
      t.count++;
      if (op.type === 'Revenu') t.revenus += v;
      else if (op.type === 'Dépense') t.depenses += v;
      else if (op.type === 'Projet') t.projets += v;
      else if (op.type === 'Épargne') t.epargne += v;
    });
    ['revenus', 'depenses', 'projets', 'epargne'].forEach((k) => {
      t[k] = round2(t[k]);
    });
    t.engage = round2(t.depenses + t.projets + t.epargne);
    t.solde = round2(t.revenus - t.engage);
    return t;
  }

  function ruleCheck(t, rules) {
    const r = Object.assign({}, DEFAULT_RULES, rules || {});
    const rev = t.revenus;
    const pct = (v) => (rev > 0 ? (v / rev) * 100 : 0);
    const res = {
      rules: r,
      depPct: pct(t.depenses),
      projPct: pct(t.projets),
      eparPct: pct(t.epargne),
      maxDep: round2((rev * r.depensesMax) / 100),
      maxProj: round2((rev * r.projetsMax) / 100),
      minEpar: round2((rev * r.epargneMin) / 100)
    };
    res.alerts = {
      depenses: rev > 0 && t.depenses > res.maxDep,
      projets: rev > 0 && t.projets > res.maxProj,
      epargne: rev > 0 && t.epargne < res.minEpar
    };
    res.respected = rev > 0 && !res.alerts.depenses && !res.alerts.projets && !res.alerts.epargne;
    return res;
  }

  function compare(current, previous) {
    const delta = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    return {
      revenus: delta(current.revenus, previous.revenus),
      depenses: delta(current.depenses, previous.depenses),
      projets: delta(current.projets, previous.projets),
      epargne: delta(current.epargne, previous.epargne)
    };
  }

  function history(ops, profile, endMonth, count) {
    const n = count || 12;
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const m = shiftMonth(endMonth, -i);
      const t = totals(ops, profile, m);
      out.push(Object.assign({ month: m }, t, ruleCheck(t, profile && profile.rules)));
    }
    return out;
  }

  function categoryBreakdown(ops, profile, month, type) {
    const wanted = type || 'Dépense';
    const map = new Map();
    (ops || []).forEach((op) => {
      if (op.type !== wanted || !inMonth(op, month)) return;
      const key = (op.category || '').trim() || 'Sans catégorie';
      map.set(key, (map.get(key) || 0) + toBase(op, profile));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        amount: round2(amount),
        share: total > 0 ? (amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  // ------------------------------------------------------------
  // Soldes des comptes (dans la devise de chaque compte)
  // Revenu : + compte. Dépense/Projet/Épargne : − compte (et + compte
  // destination si renseigné, ex. épargne vers un compte épargne).
  // Transfert : − compte source, + compte destination.
  // ------------------------------------------------------------
  function balances(accounts, ops, rates, untilDate) {
    const map = {};
    const cur = {};
    (accounts || []).forEach((a) => {
      map[a.id] = num(a.opening_balance);
      cur[a.id] = a.currency || 'USD';
    });
    const move = (accountId, amount, currency, sign) => {
      if (!accountId || !(accountId in map)) return;
      map[accountId] += sign * convert(amount, currency || 'USD', cur[accountId], rates);
    };
    (ops || []).forEach((op) => {
      if (untilDate && op.date > untilDate) return;
      if (op.type === 'Revenu') {
        move(op.account_id, op.amount, op.currency, +1);
        return;
      }
      move(op.account_id, op.amount, op.currency, -1);
      if (op.to_account_id && (op.type === 'Transfert' || OUTFLOW_TYPES.includes(op.type))) {
        move(op.to_account_id, op.amount, op.currency, +1);
      }
    });
    Object.keys(map).forEach((k) => {
      map[k] = round2(map[k]);
    });
    return map;
  }

  function netWorth(accounts, balanceMap, profile) {
    const base = (profile && profile.base_currency) || 'USD';
    return round2(
      (accounts || [])
        .filter((a) => !a.archived)
        .reduce((s, a) => s + convert(balanceMap[a.id] || 0, a.currency, base, profile && profile.rates), 0)
    );
  }

  // ------------------------------------------------------------
  // Projets
  // ------------------------------------------------------------
  function monthsRemaining(deadline, now) {
    const d = parseISODate(deadline);
    if (!d) return null;
    const today = now ? new Date(now) : new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = (d.getTime() - today.getTime()) / 86400000;
    if (diffDays < 0) return -1;
    return diffDays / 30.4375;
  }

  function projectProgress(project, ops, profile, now) {
    const contributions = (ops || [])
      .filter((op) => op.project_id === project.id && op.type === 'Projet')
      .reduce((s, op) => s + toBase(op, profile), 0);
    const target = num(project.target);
    const saved = round2(num(project.initial_saved) + contributions);
    const remaining = round2(Math.max(0, target - saved));
    const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
    const months = monthsRemaining(project.deadline, now);
    let monthly = 0;
    let deadlineState;
    if (months === null) deadlineState = 'none';
    else if (months < 0) {
      deadlineState = 'overdue';
      monthly = remaining;
    } else if (months < 1) {
      deadlineState = 'this-month';
      monthly = remaining;
    } else {
      deadlineState = 'future';
      monthly = remaining / months;
    }
    const reached = target > 0 && saved >= target;
    return {
      saved,
      target,
      remaining,
      pct,
      months,
      monthly: round2(monthly),
      deadlineState,
      reached,
      status: reached ? 'Atteint' : project.status || 'En cours'
    };
  }

  // ------------------------------------------------------------
  // Récurrences
  // ------------------------------------------------------------
  function nextOccurrence(rec, fromDate) {
    const start = parseISODate(rec.start_date);
    if (!start) return null;
    if (rec.frequency === 'weekly') {
      const d = new Date(fromDate);
      d.setDate(d.getDate() + 7);
      return d;
    }
    const step = rec.frequency === 'yearly' ? 12 : 1;
    const target = new Date(fromDate.getFullYear(), fromDate.getMonth() + step, 1);
    const day = Math.min(start.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
    return new Date(target.getFullYear(), target.getMonth(), day);
  }

  // Dates dues (AAAA-MM-JJ) après la dernière génération, jusqu'à aujourd'hui inclus
  function dueDates(rec, today) {
    if (!rec || rec.active === false) return [];
    const start = parseISODate(rec.start_date);
    const end = parseISODate(today);
    if (!start || !end) return [];
    const endDate = parseISODate(rec.end_date);
    const limit = endDate && endDate < end ? endDate : end;
    const last = parseISODate(rec.last_generated);
    const out = [];
    let cursor = start;
    let guard = 0;
    while (cursor && cursor <= limit && guard < 1000) {
      if (!last || cursor > last) out.push(toISODate(cursor));
      cursor = nextOccurrence(rec, cursor);
      guard++;
    }
    return out;
  }

  function upcomingDate(rec, today) {
    if (!rec || rec.active === false) return null;
    const start = parseISODate(rec.start_date);
    const now = parseISODate(today);
    if (!start || !now) return null;
    let cursor = start;
    let guard = 0;
    while (cursor && cursor <= now && guard < 1000) {
      cursor = nextOccurrence(rec, cursor);
      guard++;
    }
    const endDate = parseISODate(rec.end_date);
    if (!cursor || (endDate && cursor > endDate)) return null;
    return toISODate(cursor);
  }

  function operationFromRecurring(rec, date) {
    return {
      id: uuid(),
      type: rec.type,
      category: rec.category || '',
      description: rec.description || '',
      amount: num(rec.amount),
      currency: rec.currency || 'USD',
      date,
      account_id: rec.account_id || null,
      to_account_id: rec.to_account_id || null,
      project_id: rec.project_id || null,
      recurring_id: rec.id
    };
  }

  // ------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------
  function validateOperation(op) {
    const errors = [];
    if (!TYPES.includes(op.type)) errors.push("Choisissez un type d'opération.");
    if (!(num(op.amount) > 0)) errors.push('Le montant doit être supérieur à 0.');
    if (!CURRENCIES[op.currency]) errors.push('Devise inconnue.');
    if (!parseISODate(op.date)) errors.push('Date invalide.');
    if (!op.account_id) errors.push('Choisissez un compte.');
    if (op.type === 'Transfert') {
      if (!op.to_account_id) errors.push('Choisissez le compte de destination.');
      else if (op.to_account_id === op.account_id) errors.push('Les deux comptes doivent être différents.');
    }
    if (op.type === 'Projet' && !op.project_id) errors.push('Choisissez le projet à alimenter.');
    return errors;
  }

  // ------------------------------------------------------------
  // Export CSV (séparateur ; et BOM pour Excel)
  // ------------------------------------------------------------
  function csvCell(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(ops, ctx) {
    const accounts = new Map(((ctx && ctx.accounts) || []).map((a) => [a.id, a.name]));
    const projects = new Map(((ctx && ctx.projects) || []).map((p) => [p.id, p.title]));
    const profile = (ctx && ctx.profile) || { base_currency: 'USD' };
    const base = profile.base_currency || 'USD';
    const headers = [
      'Date', 'Type', 'Catégorie', 'Description', 'Compte', 'Compte destination', 'Projet',
      'Montant', 'Devise', `Montant (${base})`
    ];
    const rows = (ops || [])
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .map((op) => {
        const sign = op.type === 'Revenu' ? 1 : op.type === 'Transfert' ? 0 : -1;
        return [
          op.date,
          op.type,
          op.category,
          op.description,
          accounts.get(op.account_id) || '',
          accounts.get(op.to_account_id) || '',
          projects.get(op.project_id) || '',
          String(round2(num(op.amount))).replace('.', ','),
          op.currency || 'USD',
          String(round2(sign * toBase(op, profile))).replace('.', ',')
        ].map(csvCell).join(';');
      });
    return '﻿' + [headers.join(';'), ...rows].join('\r\n');
  }

  // ------------------------------------------------------------
  // Import des sauvegardes JSON v1 (fichier HTML) et v2 (PWA locale)
  // ------------------------------------------------------------
  function convertLegacyBackup(data, defaultAccountId) {
    const empty = { operations: [], projects: [] };
    if (!data || typeof data !== 'object') return Object.assign({ errors: ['Fichier JSON illisible.'] }, empty);
    if (!Array.isArray(data.operations) || !Array.isArray(data.projects)) {
      return Object.assign(
        { errors: ["Ce fichier n'est pas une sauvegarde du carnet (operations/projects manquants)."] },
        empty
      );
    }
    const errors = [];
    const projects = [];
    data.projects.forEach((p, i) => {
      const target = num(p.target);
      if (!p.title || !(target > 0)) {
        errors.push(`Projet ${i + 1} ignoré : titre ou objectif manquant.`);
        return;
      }
      projects.push({
        id: uuid(),
        title: String(p.title).slice(0, 120),
        category: String(p.category || 'Autre').slice(0, 60),
        priority: ['Haute', 'Moyenne', 'Basse'].includes(p.priority) ? p.priority : 'Moyenne',
        target: round2(target),
        initial_saved: round2(Math.max(0, num(p.saved))),
        deadline: parseISODate(p.deadline) ? p.deadline : null,
        status: ['En cours', 'En pause', 'Atteint'].includes(p.status) ? p.status : 'En cours'
      });
    });
    const operations = [];
    data.operations.forEach((op, i) => {
      const amount = num(op.amount);
      if (!BUDGET_TYPES.includes(op.type) || !(amount > 0) || !parseISODate(op.date)) {
        errors.push(`Opération ${i + 1} ignorée : type, montant ou date invalide.`);
        return;
      }
      operations.push({
        id: uuid(),
        type: op.type,
        category: String(op.category || '').slice(0, 120),
        description: String(op.description || '').slice(0, 500),
        amount: round2(amount),
        currency: 'USD',
        date: op.date,
        account_id: defaultAccountId || null,
        to_account_id: null,
        project_id: null,
        recurring_id: null
      });
    });
    return { errors, operations, projects };
  }

  // ------------------------------------------------------------
  // Taux de change : date, source, fraîcheur
  // rates = { USD: 1, CDF: 2850, EUR: 0.92, _date: 'AAAA-MM-JJ', _source: 'auto'|'manuel', _auto: true }
  // ------------------------------------------------------------
  function ratesInfo(rates, today) {
    const r = rates || {};
    const d = parseISODate(r._date);
    const t = parseISODate(today || todayISO());
    const ageDays = d && t ? Math.round((t - d) / 86400000) : null;
    return { date: r._date || null, source: r._source || 'manuel', auto: r._auto !== false, ageDays };
  }

  function needsRateRefresh(rates, today) {
    const info = ratesInfo(rates, today);
    return info.auto && (info.ageDays === null || info.ageDays >= 1);
  }

  // Lit la réponse d'un service public de taux (base USD) et valide les valeurs
  function parseRateResponse(json) {
    const src = json && (json.rates || json.conversion_rates);
    if (!src) return null;
    const cdf = Number(src.CDF);
    const eur = Number(src.EUR);
    if (!(cdf > 100 && cdf < 1e6) || !(eur > 0.1 && eur < 10)) return null;
    return { CDF: round2(cdf), EUR: Math.round(eur * 10000) / 10000 };
  }

  // ------------------------------------------------------------
  // Alertes en couleurs
  // Niveaux : danger (rouge) > warning (orange) > info (bleu) > success (vert)
  // ------------------------------------------------------------
  const DEFAULT_ALERT_RULES = { loyerMax: 30, alerteDep: 70 };
  const LEVEL_ORDER = { danger: 0, warning: 1, info: 2, success: 3 };

  function buildAlerts(ctx) {
    const { operations, profile, accounts, projects, recurring, month, today } = ctx;
    const base = (profile && profile.base_currency) || 'USD';
    const rules = Object.assign({}, DEFAULT_RULES, DEFAULT_ALERT_RULES, profile && profile.rules);
    const money = (v) => formatMoney(v, base);
    const pctTxt = (v) => `${Math.round(v)} %`;
    const t = totals(operations, profile, month);
    const rc = ruleCheck(t, rules);
    const out = [];
    const add = (level, id, title, text) => out.push({ level, id, title, text });

    if (t.revenus <= 0) {
      if (t.count > 0) add('info', 'no-income', 'Revenus du mois manquants', 'Des sorties sont enregistrées mais aucun revenu : ajoutez vos revenus pour suivre la règle.');
    } else {
      if (rc.alerts.depenses) {
        add('danger', 'budget', 'Alerte budget', `Vos dépenses représentent ${pctTxt(rc.depPct)} des revenus. Vous avez dépassé la limite de ${rules.depensesMax} % (${money(rc.maxDep)}).`);
      } else if (rc.depPct >= rules.alerteDep) {
        add('warning', 'budget-near', 'Dépenses à surveiller', `Vos dépenses atteignent ${pctTxt(rc.depPct)} des revenus, proche de la limite de ${rules.depensesMax} %. Il reste ${money(rc.maxDep - t.depenses)} avant le plafond.`);
      }
      const loyer = (operations || [])
        .filter((o) => o.type === 'Dépense' && inMonth(o, month) && /loyer|rent|maison/i.test(o.category || ''))
        .reduce((s, o) => s + toBase(o, profile), 0);
      const loyerPct = (loyer / t.revenus) * 100;
      if (loyer > 0 && loyerPct > rules.loyerMax) {
        add('danger', 'rent', 'Alerte loyer', `Votre loyer représente ${pctTxt(loyerPct)} des revenus. Le seuil de ${rules.loyerMax} % est dépassé.`);
      }
      if (rc.alerts.epargne) {
        add('warning', 'saving', 'Épargne à renforcer', `Votre épargne représente ${pctTxt(rc.eparPct)} des revenus. L'objectif est d'au moins ${rules.epargneMin} % (${money(rc.minEpar)}).`);
      }
      if (rc.alerts.projets) {
        add('warning', 'projects', 'Projets au-dessus de la cible', `Les projets représentent ${pctTxt(rc.projPct)} des revenus, au-delà de la cible de ${rules.projetsMax} %.`);
      }
      if (rc.respected) {
        add('success', 'cap-ok', 'Cap tenu', `Bravo : ce mois-ci, la règle ${rules.depensesMax}/${rules.projetsMax}/${rules.epargneMin} est respectée.`);
      }
    }

    const bal = balances(accounts, operations, profile && profile.rates);
    (accounts || []).filter((a) => !a.archived && bal[a.id] < 0).forEach((a) => {
      add('danger', `overdraft-${a.id}`, 'Compte à découvert', `« ${a.name} » est négatif : ${formatMoney(bal[a.id], a.currency)}. Vérifiez vos saisies ou faites un transfert.`);
    });

    (projects || []).forEach((p) => {
      const pr = projectProgress(p, operations, profile, today ? parseISODate(today) : undefined);
      if (pr.reached || pr.status === 'En pause') return;
      if (pr.deadlineState === 'overdue') {
        add('warning', `late-${p.id}`, 'Projet en retard', `« ${p.title} » a dépassé son échéance : il manque ${money(pr.remaining)}.`);
      }
    });

    const day = today || todayISO();
    const in3 = toISODate(new Date(parseISODate(day).getTime() + 3 * 86400000));
    (recurring || []).forEach((r) => {
      const next = upcomingDate(r, day);
      if (next && next <= in3) {
        add('info', `soon-${r.id}`, `${r.type === 'Revenu' ? 'Entrée' : 'Échéance'} bientôt`, `${r.category || r.type} : ${formatMoney(r.amount, r.currency)} prévu le ${next.split('-').reverse().join('/')}.`);
      }
    });

    const usesOtherCurrency = base !== 'USD' || (operations || []).some((o) => o.currency && o.currency !== 'USD') || (accounts || []).some((a) => a.currency !== 'USD');
    const ri = ratesInfo(profile && profile.rates, day);
    if (usesOtherCurrency && (ri.ageDays === null || ri.ageDays > 7)) {
      add('info', 'rates', 'Taux de change à vérifier', ri.date ? `Le taux utilisé date du ${ri.date.split('-').reverse().join('/')}. Mettez-le à jour dans Paramètres.` : 'Vérifiez le taux USD/CDF dans Paramètres pour des conversions justes.');
    }

    return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }

  const api = {
    TYPES,
    BUDGET_TYPES,
    CURRENCIES,
    DEFAULT_RATES,
    DEFAULT_RULES,
    DEFAULT_ALERT_RULES,
    ratesInfo,
    needsRateRefresh,
    parseRateResponse,
    buildAlerts,
    round2,
    uuid,
    toISODate,
    todayISO,
    parseISODate,
    monthKey,
    shiftMonth,
    monthLabel,
    inMonth,
    convert,
    toBase,
    formatMoney,
    totals,
    ruleCheck,
    compare,
    history,
    categoryBreakdown,
    balances,
    netWorth,
    monthsRemaining,
    projectProgress,
    dueDates,
    upcomingDate,
    operationFromRecurring,
    validateOperation,
    toCSV,
    convertLegacyBackup
  };

  global.Cap75Finance = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
