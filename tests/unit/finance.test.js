import { describe, it, expect } from 'vitest';
import '../../js/finance.js';

// finance.js s'attache à window comme dans le navigateur
const F = globalThis.Cap75Finance || window.Cap75Finance;

const profile = {
  base_currency: 'USD',
  rates: { USD: 1, CDF: 2850, EUR: 0.92 },
  rules: { depensesMax: 75, projetsMax: 15, epargneMin: 10 }
};
const op = (o) => Object.assign({ id: F.uuid(), currency: 'USD', account_id: 'caisse', category: '', description: '' }, o);

describe('Devises', () => {
  it('convertit CDF → USD et USD → EUR', () => {
    expect(F.convert(2850, 'CDF', 'USD', profile.rates)).toBeCloseTo(1, 6);
    expect(F.convert(100, 'USD', 'EUR', profile.rates)).toBeCloseTo(92, 6);
    expect(F.convert(50, 'USD', 'USD', profile.rates)).toBe(50);
  });

  it('ignore un taux nul au lieu de diviser par zéro', () => {
    expect(F.convert(10, 'CDF', 'USD', { CDF: 0 })).toBe(10);
  });

  it('formate selon la devise (0 décimale pour le franc congolais)', () => {
    const clean = (s) => s.replace(/\s/g, ' ');
    expect(clean(F.formatMoney(1234.5, 'USD'))).toBe('1 234,50 $');
    expect(clean(F.formatMoney(197500, 'CDF'))).toBe('197 500 FC');
    expect(clean(F.formatMoney(-5, 'EUR'))).toBe('−5,00 €');
  });
});

describe('Totaux du mois et règle 75/15/10', () => {
  const ops = [
    op({ type: 'Revenu', amount: 1000, date: '2026-11-01' }),
    op({ type: 'Dépense', amount: 700, date: '2026-11-02' }),
    op({ type: 'Dépense', amount: 28500, currency: 'CDF', date: '2026-11-03' }),
    op({ type: 'Projet', amount: 150, date: '2026-11-04' }),
    op({ type: 'Épargne', amount: 100, date: '2026-11-05' }),
    op({ type: 'Transfert', amount: 999, to_account_id: 'mpesa', date: '2026-11-06' }),
    op({ type: 'Revenu', amount: 5000, date: '2026-10-30' })
  ];

  it('ne compte que le mois choisi et ignore les transferts', () => {
    const t = F.totals(ops, profile, '2026-11');
    expect(t.revenus).toBe(1000);
    expect(t.depenses).toBe(710);
    expect(t.projets).toBe(150);
    expect(t.epargne).toBe(100);
    expect(t.solde).toBe(40);
  });

  it('vérifie les seuils de la règle', () => {
    const rc = F.ruleCheck(F.totals(ops, profile, '2026-11'), profile.rules);
    expect(rc.maxDep).toBe(750);
    expect(rc.alerts.depenses).toBe(false);
    expect(rc.alerts.epargne).toBe(false);
    expect(rc.respected).toBe(true);
    const bad = F.ruleCheck({ revenus: 1000, depenses: 800, projets: 0, epargne: 50 }, profile.rules);
    expect(bad.alerts.depenses).toBe(true);
    expect(bad.alerts.epargne).toBe(true);
    expect(bad.respected).toBe(false);
  });

  it('ne déclenche aucune alerte sans revenus', () => {
    const rc = F.ruleCheck(F.totals([], profile, '2026-11'), profile.rules);
    expect(rc.alerts).toEqual({ depenses: false, projets: false, epargne: false });
    expect(rc.respected).toBe(false);
  });

  it('accepte une règle personnalisée', () => {
    const rc = F.ruleCheck({ revenus: 1000, depenses: 650, projets: 0, epargne: 200 }, { depensesMax: 60, projetsMax: 20, epargneMin: 20 });
    expect(rc.alerts.depenses).toBe(true);
    expect(rc.maxDep).toBe(600);
  });

  it('compare au mois précédent', () => {
    const c = F.compare({ revenus: 1100, depenses: 500, projets: 0, epargne: 0 }, { revenus: 1000, depenses: 1000, projets: 0, epargne: 0 });
    expect(c.revenus).toBeCloseTo(10);
    expect(c.depenses).toBeCloseTo(-50);
    expect(c.projets).toBeNull();
  });

  it("produit l'historique de 12 mois, du plus ancien au plus récent", () => {
    const h = F.history(ops, profile, '2026-11', 12);
    expect(h).toHaveLength(12);
    expect(h[0].month).toBe('2025-12');
    expect(h[11].month).toBe('2026-11');
    expect(h[10].revenus).toBe(5000);
  });

  it('répartit les dépenses par catégorie', () => {
    const cats = F.categoryBreakdown(
      [
        op({ type: 'Dépense', amount: 300, category: 'Loyer', date: '2026-11-01' }),
        op({ type: 'Dépense', amount: 100, category: 'Transport', date: '2026-11-02' }),
        op({ type: 'Dépense', amount: 100, category: '', date: '2026-11-03' })
      ],
      profile,
      '2026-11'
    );
    expect(cats[0]).toMatchObject({ category: 'Loyer', amount: 300, share: 60 });
    expect(cats.map((c) => c.category)).toContain('Sans catégorie');
  });
});

describe('Soldes des comptes', () => {
  const accounts = [
    { id: 'caisse', currency: 'USD', opening_balance: 100 },
    { id: 'mpesa', currency: 'CDF', opening_balance: 10000 },
    { id: 'epargne', currency: 'USD', opening_balance: 0, archived: false }
  ];

  it('applique revenus, dépenses, transferts et épargne vers un compte', () => {
    const ops = [
      op({ type: 'Revenu', amount: 500, date: '2026-11-01' }),
      op({ type: 'Dépense', amount: 50, date: '2026-11-02' }),
      op({ type: 'Transfert', amount: 10, to_account_id: 'mpesa', date: '2026-11-03' }),
      op({ type: 'Épargne', amount: 100, to_account_id: 'epargne', date: '2026-11-04' }),
      op({ type: 'Dépense', amount: 5000, currency: 'CDF', account_id: 'mpesa', date: '2026-11-05' })
    ];
    const b = F.balances(accounts, ops, profile.rates);
    expect(b.caisse).toBe(440);
    expect(b.mpesa).toBe(10000 + 28500 - 5000);
    expect(b.epargne).toBe(100);
    expect(F.netWorth(accounts, b, profile)).toBeCloseTo(440 + 33500 / 2850 + 100, 2);
  });

  it('peut calculer le solde à une date donnée', () => {
    const ops = [op({ type: 'Revenu', amount: 500, date: '2026-12-01' })];
    expect(F.balances(accounts, ops, profile.rates, '2026-11-30').caisse).toBe(100);
  });
});

describe('Projets', () => {
  const project = { id: 'p1', target: 1000, initial_saved: 200, deadline: '2027-11-24', status: 'En cours' };

  it('additionne le capital de départ et les apports liés', () => {
    const ops = [
      op({ type: 'Projet', amount: 300, project_id: 'p1', date: '2026-11-10' }),
      op({ type: 'Projet', amount: 999, project_id: 'autre', date: '2026-11-10' })
    ];
    const pr = F.projectProgress(project, ops, profile, new Date(2026, 10, 24));
    expect(pr.saved).toBe(500);
    expect(pr.remaining).toBe(500);
    expect(pr.pct).toBe(50);
    expect(pr.deadlineState).toBe('future');
    expect(pr.monthly).toBeGreaterThan(40);
    expect(pr.monthly).toBeLessThan(43);
  });

  it("retire l'apport si l'opération est supprimée (bug de la v2 corrigé)", () => {
    const pr = F.projectProgress(project, [], profile, new Date(2026, 10, 24));
    expect(pr.saved).toBe(200);
  });

  it('signale une échéance dépassée et un objectif atteint', () => {
    expect(F.projectProgress({ ...project, deadline: '2026-01-01' }, [], profile, new Date(2026, 10, 24)).deadlineState).toBe('overdue');
    const done = F.projectProgress({ ...project, initial_saved: 1000 }, [], profile);
    expect(done.reached).toBe(true);
    expect(done.status).toBe('Atteint');
  });
});

describe('Récurrences', () => {
  it('génère chaque mois en gardant le jour, ajusté aux mois courts', () => {
    const rec = { id: 'r', active: true, frequency: 'monthly', start_date: '2026-01-31' };
    expect(F.dueDates(rec, '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('ne régénère pas ce qui a déjà été créé', () => {
    const rec = { id: 'r', active: true, frequency: 'monthly', start_date: '2026-09-25', last_generated: '2026-10-25' };
    expect(F.dueDates(rec, '2026-11-24')).toEqual([]);
    expect(F.dueDates(rec, '2026-11-25')).toEqual(['2026-11-25']);
  });

  it('gère les fréquences hebdomadaire et annuelle, la date de fin et la pause', () => {
    expect(F.dueDates({ id: 'w', frequency: 'weekly', start_date: '2026-11-01' }, '2026-11-20')).toEqual(['2026-11-01', '2026-11-08', '2026-11-15']);
    expect(F.dueDates({ id: 'y', frequency: 'yearly', start_date: '2024-02-29' }, '2026-03-01')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28']);
    expect(F.dueDates({ id: 'e', frequency: 'monthly', start_date: '2026-01-10', end_date: '2026-02-15' }, '2026-06-01')).toEqual(['2026-01-10', '2026-02-10']);
    expect(F.dueDates({ id: 'p', active: false, frequency: 'monthly', start_date: '2026-01-10' }, '2026-06-01')).toEqual([]);
  });

  it('donne la prochaine échéance', () => {
    expect(F.upcomingDate({ frequency: 'monthly', start_date: '2026-10-25' }, '2026-11-24')).toBe('2026-11-25');
    expect(F.upcomingDate({ frequency: 'monthly', start_date: '2026-10-25', end_date: '2026-11-01' }, '2026-11-24')).toBeNull();
  });

  it('crée une opération liée à la récurrence', () => {
    const o = F.operationFromRecurring({ id: 'r1', type: 'Dépense', amount: '350', currency: 'USD', account_id: 'caisse', category: 'Loyer' }, '2026-11-03');
    expect(o).toMatchObject({ type: 'Dépense', amount: 350, date: '2026-11-03', recurring_id: 'r1', category: 'Loyer' });
    expect(o.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('Validation des opérations', () => {
  it('refuse montant nul, compte manquant, transfert vers le même compte, projet sans projet, date invalide', () => {
    expect(F.validateOperation(op({ type: 'Dépense', amount: 0, date: '2026-11-01' }))).toContain('Le montant doit être supérieur à 0.');
    expect(F.validateOperation(op({ type: 'Dépense', amount: 5, date: '2026-11-01', account_id: null }))).toContain('Choisissez un compte.');
    expect(F.validateOperation(op({ type: 'Transfert', amount: 5, date: '2026-11-01', to_account_id: 'caisse' }))).toContain('Les deux comptes doivent être différents.');
    expect(F.validateOperation(op({ type: 'Projet', amount: 5, date: '2026-11-01' }))).toContain('Choisissez le projet à alimenter.');
    expect(F.validateOperation(op({ type: 'Dépense', amount: 5, date: '2026-02-30' }))).toContain('Date invalide.');
    expect(F.validateOperation(op({ type: 'Revenu', amount: 5, date: '2026-11-01' }))).toEqual([]);
  });
});

describe('Export CSV', () => {
  it('produit un CSV Excel avec BOM, séparateur ; et guillemets échappés', () => {
    const csv = F.toCSV(
      [
        op({ type: 'Dépense', amount: 12.5, category: 'Courses; marché', description: 'Dit "frais"', date: '2026-11-02' }),
        op({ type: 'Revenu', amount: 100, category: 'Salaire', date: '2026-11-01' })
      ],
      { accounts: [{ id: 'caisse', name: 'Caisse' }], profile }
    );
    const lines = csv.slice(1).split('\r\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toContain('Montant (USD)');
    expect(lines[1]).toContain('"Courses; marché"');
    expect(lines[1]).toContain('"Dit ""frais"""');
    expect(lines[1]).toContain('-12,5');
    expect(lines[2]).toContain('Salaire');
  });
});

describe('Import des anciens carnets DOXTEHAD (v1 et v2)', () => {
  it('convertit opérations et projets, et ignore les lignes invalides', () => {
    const res = F.convertLegacyBackup(
      {
        operations: [
          { id: 'op_1', type: 'Revenu', category: 'Salaire', amount: 800, date: '2026-05-01' },
          { id: 'op_2', type: 'Hack', amount: 10, date: '2026-05-01' },
          { id: 'op_3', type: 'Dépense', category: 'Œuvre & frais', amount: '25.5', date: '2026-05-02' }
        ],
        projects: [
          { id: 'proj_1', title: 'Moto', target: 1500, saved: 300, deadline: '2027-01-01', status: 'En cours', priority: 'Haute' },
          { id: 'proj_2', title: '', target: 10 }
        ]
      },
      'acc-1'
    );
    expect(res.operations).toHaveLength(2);
    expect(res.operations[1]).toMatchObject({ category: 'Œuvre & frais', amount: 25.5, account_id: 'acc-1', currency: 'USD' });
    expect(res.projects).toHaveLength(1);
    expect(res.projects[0]).toMatchObject({ title: 'Moto', initial_saved: 300, target: 1500 });
    expect(res.errors).toHaveLength(2);
  });

  it("refuse un fichier qui n'est pas une sauvegarde", () => {
    expect(F.convertLegacyBackup({ foo: 1 }).errors[0]).toMatch(/sauvegarde/);
    expect(F.convertLegacyBackup(null).errors[0]).toMatch(/illisible/);
  });
});

describe('Mois', () => {
  it('avance et recule de mois, y compris à cheval sur deux années', () => {
    expect(F.shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(F.shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(F.monthLabel('2026-11')).toBe('Novembre 2026');
  });

  it('donne la date du jour en heure locale', () => {
    expect(F.todayISO(new Date(2026, 10, 24, 23, 59))).toBe('2026-11-24');
  });
});
