# Les 12 coups de Mahylan

PWA d'entraînement aux 12 Coups — multi-modes (Coup d'envoi, Coup par Coup, Face-à-Face, parcours complet, Révision/Apprentissage). Stack : Next.js 16 + TypeScript + Tailwind v4 + Supabase.

Voir le cahier des charges historique dans [MIDI_MASTER_PROJET.md](./docs/MIDI_MASTER_PROJET.md), le journal des phases dans [PROGRESS.md](./docs/PROGRESS.md), les décisions techniques dans [DECISIONS.md](./docs/DECISIONS.md), et le journal des changements dans [CHANGELOG.md](./CHANGELOG.md).

---

## 1. Prérequis

- **Node.js 20+**, npm 10+
- Un compte **Supabase** (plan gratuit suffit)

---

## 2. Setup local

```bash
npm install
cp .env.example .env.local
# remplir .env.local d'après son projet Supabase (voir §3)
npm run dev        # http://localhost:3000
```

---

## 3. Configurer Supabase

### 3.1 Créer le projet

1. Aller sur https://supabase.com/dashboard
2. **New project** → choisir un nom, un mot de passe DB, la région la plus proche.
3. Attendre la fin du provisioning (~1 min).

### 3.2 Récupérer les clés

Settings → API :

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** (Révéler) → `SUPABASE_SERVICE_ROLE_KEY` (SECRET, serveur uniquement)

Les coller dans `.env.local`.

### 3.3 Configurer l'URL de redirection (obligatoire pour le magic link)

Authentication → URL Configuration :

- **Site URL** : `http://localhost:3000` (en dev) / `https://ton-domaine.fr` (en prod)
- **Redirect URLs** (ajouter) : `http://localhost:3000/auth/callback`

### 3.4 Lancer la migration initiale

Deux options.

**Option A — SQL Editor (simple, recommandé en Phase 1) :**

1. Dashboard → SQL Editor → **New query**
2. Coller le contenu de [supabase/migrations/0001_init.sql](./supabase/migrations/0001_init.sql)
3. **Run**

Vérifier dans Table Editor que les 9 tables sont créées (profiles, categories, subcategories, questions, game_sessions, answers_log, wrong_answers, badges, user_badges).

**Option B — CLI Supabase (recommandé à terme) :**

```bash
npm install -D supabase
npx supabase login
npx supabase link --project-ref <ton-project-ref>
npx supabase db push
```

### 3.5 (Optionnel) Se passer en admin

Une fois connecté au moins une fois sur l'app (pour que la ligne dans `profiles` existe), dans le SQL Editor :

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'ton-email@exemple.fr');
```

### 3.6 Régénérer les types TypeScript (dès qu'on modifie une migration)

```bash
npx supabase gen types typescript --project-id <ton-project-ref> --schema public > src/types/database.ts
```

---

## 4. Commandes utiles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de dev (webpack, HMR) |
| `npm run build` | Build production |
| `npm run start` | Démarre le build prod |
| `npm run typecheck` | Vérification TypeScript sans émettre |
| `npm run lint` | ESLint |
| `npm run gen-icons` | Régénère les icônes PWA placeholder |

---

## 5. Architecture

Voir `docs/MIDI_MASTER_PROJET.md §3`. Résumé des dossiers clés :

```
src/
  app/
    (auth)/login/           # Page login + magic link
    (app)/                  # Routes protégées (auth guard dans layout.tsx)
      layout.tsx            # Vérifie session + Navbar
      page.tsx              # Dashboard
    auth/callback/          # Callback magic link Supabase
    sw.ts                   # Service worker Serwist
  lib/
    supabase/
      client.ts             # Client navigateur
      server.ts             # Client Server Components / Actions
      middleware.ts         # updateSession (utilisé par proxy.ts)
  proxy.ts                  # Ex-"middleware" — renommé "proxy" en Next 16
  types/database.ts         # Types générés depuis Supabase
supabase/
  migrations/0001_init.sql  # Schéma complet + RLS + trigger profil
```

---

## 6. Troubleshooting

- **Magic link ne marche pas** : vérifier §3.3 (Redirect URLs) et que `NEXT_PUBLIC_APP_URL` matche ton origin.
- **"Unauthorized" sur une requête** : les policies RLS sont strictes. Vérifier que le user est bien authentifié et que la table a une policy adaptée (voir `0001_init.sql`).
- **Erreur Turbopack / WorkerError** : `npm run build` doit être lancé avec `--webpack` (déjà configuré). Cf. [DECISIONS.md](./docs/DECISIONS.md).
- **Types désynchros après une migration** : relancer `supabase gen types` (§3.6).
