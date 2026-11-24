/* Configuration publique Cap75.
   La clé « anon / publishable » est faite pour être publique :
   la sécurité des données repose sur les règles RLS de la base.
   Ne jamais mettre ici la clé « service_role ». */
window.CAP75_CONFIG = {
  supabaseUrl: 'https://VOTRE-PROJET.supabase.co',
  supabaseAnonKey: 'VOTRE_CLE_ANON'
};
