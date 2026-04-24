# Midi Master — Journal de progression

Suivi phase par phase du projet. Chaque phase listée avec statut, date, livrables et points d'attention.

---

## Phase 0 — Setup du projet

**Statut** : DONE
**Date** : 2026-04-23

### Livrables

- [x] Projet Next.js créé dans `midi-master/` (TypeScript, App Router, src/, alias `@/*`, ESLint)
- [x] Dépendances runtime : framer-motion, zustand, @supabase/supabase-js, @supabase/ssr, howler, recharts, fastest-levenshtein, lucide-react, clsx, tailwind-merge, class-variance-authority
- [x] DevDependencies : @types/howler, tsx, sharp, serwist
- [x] TypeScript strict renforcé (`noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `target: ES2022`)
- [x] shadcn/ui initialisé (baseColor `slate`, CSS variables `true`)
- [x] Serwist configuré (`next.config.ts` + `src/app/sw.ts`) avec `disable: NODE_ENV === 'development'`
- [x] `public/manifest.json` (theme #0B1F4D, icônes 192/512/maskable)
- [x] Icônes placeholder générées par `src/scripts/gen-icons.mjs` (logo "MM" or sur fond bleu nuit)
- [x] Métadonnées PWA dans `src/app/layout.tsx` (manifest, appleWebApp, themeColor viewport)
- [x] Arborescence complète créée (voir section 3 du cahier des charges) — `.gitkeep` dans chaque dossier vide
- [x] `.env.example` commenté
- [x] `.gitignore` mis à jour (préserve `.env.example`, exclut `public/sw.js`)
- [x] Page d'accueil temporaire (Trophy Lucide + "Midi Master en construction")
- [x] Scripts npm : `dev`, `build`, `start`, `lint`, `typecheck`, `gen-icons`
- [x] Assets Next par défaut (next.svg, vercel.svg…) supprimés
- [x] Pas d'emojis : UI en icônes Lucide uniquement (cf. règle projet)

### Déviations / décisions notables

Voir [DECISIONS.md](./DECISIONS.md).

---

## Phase 1 — Supabase & Auth

**Statut** : DONE
**Date** : 2026-04-23

### Livrables

- [x] Migration [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) — 9 tables + RLS + trigger auto-création profil
- [x] Clients Supabase :
  - [x] [`src/lib/supabase/client.ts`](./src/lib/supabase/client.ts) — navigateur
  - [x] [`src/lib/supabase/server.ts`](./src/lib/supabase/server.ts) — Server Components / Actions
  - [x] [`src/lib/supabase/middleware.ts`](./src/lib/supabase/middleware.ts) — fonction `updateSession`
- [x] [`src/proxy.ts`](./src/proxy.ts) — Next 16 remplace middleware.ts par proxy.ts
- [x] Auth magic link :
  - [x] Page [`/login`](./src/app/(auth)/login/page.tsx) avec formulaire stylé TV
  - [x] Server Action [`sendMagicLink`](./src/app/(auth)/login/actions.ts)
  - [x] Callback [`/auth/callback`](./src/app/auth/callback/route.ts) — supporte code PKCE + token_hash OTP
- [x] Layout protégé `(app)/` :
  - [x] [`src/app/(app)/layout.tsx`](./src/app/(app)/layout.tsx) — redirect /login si pas de session
  - [x] [`src/components/layout/Navbar.tsx`](./src/components/layout/Navbar.tsx) — logo + pseudo + déconnexion
  - [x] [`src/app/(app)/page.tsx`](./src/app/(app)/page.tsx) — dashboard placeholder
  - [x] Server Action `signOut`
- [x] Auto-création profil par **trigger Postgres** `on_auth_user_created` (pseudo = local-part email + suffixe md5 pour unicité)
- [x] Types TypeScript dans [`src/types/database.ts`](./src/types/database.ts) (placeholder typé à la main, regénérable via `supabase gen types`)
- [x] [README.md](./README.md) complet (setup Supabase, migration, magic link URL, admin role, CLI)

### À faire manuellement côté Supabase (cf. README §3)

- Site URL = `http://localhost:3000`
- Redirect URL autorisée = `http://localhost:3000/auth/callback`
- Passer la migration `0001_init.sql` via SQL Editor

---

## Phase 2 — Design system Reichmann

**Statut** : DONE
**Date** : 2026-04-23

### Livrables

- [x] `globals.css` refondu : palette Reichmann en tokens `@theme` (`bg-midnight`, `text-gold`, `bg-buzz`, `bg-cream`, `bg-life-{green,yellow,red}`) + thème dark-by-default (bleu nuit + or) + utilitaires `glow-gold`, `glow-midnight`, `animate-shake`
- [x] Fonts via `next/font/google` : **Montserrat** (display / titres, poids 600-900) + **Inter** (body) — variables `--font-montserrat` / `--font-inter`
- [x] shadcn components installés : **card, dialog, input, progress, tabs, badge, avatar, dropdown-menu, sonner** (remplace "toast" déprécié)
- [x] Button shadcn customisé : 3 nouvelles variantes **gold** (fond or, texte midnight, ombre 3D + glow au hover), **buzz** (rouge, ombre 3D), **ghost-gold** (outline or transparent)
- [x] Composants game :
  - [x] [LifeBar](./src/components/game/LifeBar.tsx) — 3 pastilles, Framer Motion (scale + opacity spring)
  - [x] [Timer](./src/components/game/Timer.tsx) — cercle SVG via `requestAnimationFrame`, stroke-dashoffset, passe en rouge + pulse à 3s
  - [x] [QuestionCard](./src/components/game/QuestionCard.tsx) — catégorie en badge coloré, difficulté 5-paliers, slide-up+fade à l'entrée (keyId pour re-jouer)
  - [x] [AnswerButton](./src/components/game/AnswerButton.tsx) — 3 états (idle / correct glow vert / wrong shake rouge), support `keyHint` (kbd "A/B/←/→")
- [x] [Navbar](./src/components/layout/Navbar.tsx) étendue : logo Trophy or + liens Jouer / Révision / Stats + Admin (conditionnel role) + active state + pseudo + déconnexion. Sticky + backdrop blur
- [x] [Layout (app)](./src/app/(app)/layout.tsx) : récupère `pseudo` ET `role` du profil Supabase, passe à la Navbar
- [x] [Page d'accueil](./src/app/(app)/page.tsx) : HeroTile "Lancer le parcours" (gradient or/midnight + blob flou), 4 tuiles de jeux (Quizz / Étoile / Face-à-Face / Coup de Maître) avec icônes Lucide, tuile Révision en bas — hover scale 1.02, glow
- [x] [Page /demo](./src/app/(app)/demo/page.tsx) : playground interactif de tous les composants (boutons, LifeBar, Timer, QuestionCard, AnswerButton + shadcn Card/Input/Badge/Progress)

### Règle projet

- Pas d'emoji dans l'app : icônes Lucide React uniquement (règle sauvegardée en mémoire le 2026-04-23).

---

## Phase 3 — Seed 150 questions & admin

**Statut** : DONE
**Date** : 2026-04-23

### Livrables

- [x] Migration [`supabase/migrations/0002_seed.sql`](./supabase/migrations/0002_seed.sql) idempotente : **14 catégories** + **~60 sous-catégories** + **11 badges**
- [x] [`src/lib/category-icons.ts`](./src/lib/category-icons.ts) — mapping slug → Lucide (pas d'emoji dans l'UI)
- [x] [`src/data/seed-questions.json`](./src/data/seed-questions.json) — **150 questions** : 60 quizz_2 + 40 quizz_4 + 20 etoile + 20 face_a_face + 10 coup_maitre
- [x] Schéma zod partagé [`src/lib/schemas/question.ts`](./src/lib/schemas/question.ts) — `questionSchema` avec `superRefine` par type (2/4 réponses, 1 correcte, indices obligatoires pour etoile/coup_maitre, etc.)
- [x] Script `npm run seed` ([`src/scripts/seed.ts`](./src/scripts/seed.ts)) — charge JSON, valide zod, résout slugs → IDs, insère par lots de 100 via `SUPABASE_SERVICE_ROLE_KEY`, reporting
- [x] Guard admin server-side [`src/lib/auth/admin-guard.ts`](./src/lib/auth/admin-guard.ts) — `requireAdmin()` redirige vers / si role !== 'admin'
- [x] Server Actions admin [`src/app/(app)/admin/questions/actions.ts`](./src/app/(app)/admin/questions/actions.ts) : `createQuestion`, `updateQuestion`, `deleteQuestion`, `importQuestionsBulk` (tous avec validation zod + résolution slugs)
- [x] `/admin/questions` : liste paginée (20/page), filtres (type / catégorie / difficulté), recherche texte debouncée (300ms), actions édit/suppr avec `confirm()`
- [x] `/admin/questions/new` : formulaire dynamique par type (QuestionForm unique, champs qui apparaissent/disparaissent selon `type`)
- [x] `/admin/questions/[id]` : édition, pré-remplit depuis la BDD (slugs ré-résolus depuis IDs)
- [x] `/admin/questions/import` : drop zone fichier + textarea JSON, parse en live avec preview (count par type) ou erreurs zod, batch insert
- [x] `/api/questions/export` : route handler qui réexporte toutes les questions au format du seed (category_slug / subcategory_slug), téléchargement via `Content-Disposition`

### Commandes clés ajoutées

- `npm run seed` — seed 150 questions depuis le JSON vers Supabase (service_role)

### Dépendances ajoutées

- `zod` (validation schémas) + `dotenv` (script seed)

---

## Phases 4 à 12

Voir le cahier des charges pour le détail. Chaque phase sera notée ici au fil de l'eau.
