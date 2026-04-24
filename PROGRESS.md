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

## Phase 4 — Jeu 1 Quizz 1/2 + refonte visuelle

**Statut** : DONE
**Date** : 2026-04-24

### Hors-périmètre cahier des charges (demandes du user)

- [x] **Logo Midi Master** : `public/logo.svg` (soleil + 12 rayons + aiguilles 12:00 + "XII"). Regénération de toutes les icônes PNG (192 / 512 / maskable / favicon-32 / apple-touch-icon-180) via [`npm run gen-icons`](./src/scripts/gen-icons.mjs).
- [x] **Refonte thème clair "12 coups de midi"** : fond `cream` #FFF8EC (halo solaire subtil en CSS), texte `navy` #0B1F4D, primary `gold` #F5B700, accent `sky` #2B8EE6, cards blanches avec glow léger. Tokens exposés : `bg-cream`, `text-navy`, `bg-gold`, `text-gold-warm`, `bg-sky`, `bg-sky-pale`, `bg-cream-deep`, etc. Anciens alias `bg-midnight` / `text-cream` conservés en compat.
- [x] **Page 404 custom** [`src/app/not-found.tsx`](./src/app/not-found.tsx) avec logo animé (halo pulse) + bouton retour accueil.
- [x] **Placeholders anti-404** : `/jouer` (hub), `/revision`, `/stats`, `/parcours`, `/jouer/jeu-2`, `/jouer/face-a-face`, `/jouer/coup-de-maitre` → toutes affichent [`<ComingSoon/>`](./src/components/layout/ComingSoon.tsx) avec le numéro de phase à venir.
- [x] **Login réécrit** : onglets **Connexion / Inscription** (`email + mot de passe`), magic link retiré. Server Actions `signIn` et `signUp` avec messages d'erreur FR.
- [x] **Admin backdoor** : `ADMIN_EMAIL=ommarcelli31@gmail.com` (dans `.env.example`) ; toute connexion avec cet email → `ensureAdminAccount()` force la création / le password-sync via `service_role`, force `profiles.role='admin'`, ouvre la session sans vérifier le mot de passe. Voir [DECISIONS.md](./DECISIONS.md).

### Livrables Phase 4 (spec)

- [x] [`src/stores/gameStore.ts`](./src/stores/gameStore.ts) — Zustand avec middleware `persist` sur sessionStorage, machine d'états `idle → intro → playing → feedback → results`
- [x] [`src/lib/game-logic/jeu1.ts`](./src/lib/game-logic/jeu1.ts) — `pickJeu1Questions` (max 2/catégorie, shuffle A/B), `computeLifeState`, `shouldTriggerFaceAFace`, `computeJeu1Xp` (100/correct + 500 bonus si parfait)
- [x] [`src/lib/sounds.ts`](./src/lib/sounds.ts) — Web Audio API, 5 sons synthétisés (tick / ding / buzz / win / lose) + volume + mute persistés localStorage. Pas de fichiers MP3 nécessaires.
- [x] Page `/jouer/jeu-1` — Server Component fetch + client game loop :
  - [x] Écran intro avec règles et bouton CTA "C'est parti"
  - [x] Timer 10 s par question (passage en rouge à 3 s)
  - [x] LifeBar animée
  - [x] QuestionCard + 2 AnswerButtons grandes
  - [x] Feedback visuel (vert/rouge glow, shake) + sons
  - [x] Auto-advance (1.2 s correct / 1.8 s wrong)
  - [x] Game over sur `wrongCount === 3` → écran "Face-à-Face pénalité" (Phase 6 prendra la suite)
  - [x] Écran résultats avec stats (correctes / ratées / XP) + rejouer / révision / accueil
- [x] **Persistance BDD** ([`actions.ts`](./src/app/(app)/jouer/jeu-1/actions.ts)) :
  - INSERT `game_sessions` (mode='jeu1')
  - batch INSERT `answers_log`
  - UPSERT `wrong_answers` (increment fail_count + reset success_streak)
  - UPDATE `profiles.xp` + calcul `niveau = floor(xp/1000)+1`
- [x] Contrôles clavier : `A` / `←` / `1` → réponse gauche · `B` / `→` / `2` → réponse droite · `Espace` / `Entrée` sur l'écran intro

### Dépendances

- Aucune nouvelle (zustand et framer-motion déjà installés en Phase 0).

---

## Phase 5 — Jeu 2 Étoile Mystérieuse

**Statut** : DONE
**Date** : 2026-04-24

### Livrables

- [x] [`src/lib/matching/fuzzy-match.ts`](./src/lib/matching/fuzzy-match.ts) — `normalize()` (lowercase + NFD deburr + articles FR/EN + espaces/ponctuation) + `isMatch(input, correct, aliases, threshold=2)` via `fastest-levenshtein`. Seuil de sécurité : pour inputs ≤ 3 caractères, égalité stricte requise (évite les faux positifs du type "oui" / "nui").
- [x] [`src/lib/voice/speech-recognition.ts`](./src/lib/voice/speech-recognition.ts) — hook `useSpeechRecognition()` avec déclarations TS locales (pas de package externe), `lang='fr-FR'`, `continuous=false`, `interimResults=true`. Retourne `{ transcript, listening, supported, error, start, stop, reset }`. Fallback gracieux si non supporté.
- [x] [`src/components/game/VoiceInput.tsx`](./src/components/game/VoiceInput.tsx) — gros bouton micro (pulse animé en écoute), transcript live, input texte fallback avec touche Entrée = valider.
- [x] [`src/lib/game-logic/jeu2.ts`](./src/lib/game-logic/jeu2.ts) — `pickOneEtoile`, `computeBlurPx(revealed)` (flou pixel par palier d'indices révélés), `computeJeu2Xp(revealed)` barème **500 / 400 / 300 / 200 / 100**, `placeholderAvatarUrl` via DiceBear si pas d'image en base.
- [x] [`src/app/(app)/jouer/jeu-2/page.tsx`](./src/app/(app)/jouer/jeu-2/page.tsx) — Server Component qui tire 1 question `etoile` aléatoire avec ≥ 3 indices.
- [x] [`jeu2-client.tsx`](./src/app/(app)/jouer/jeu-2/jeu2-client.tsx) — state machine `intro → playing → results` :
  - Timer global 2 min (passe en pulse rouge à ≤ 15 s)
  - Auto-reveal d'un indice toutes les 20 s (+ bouton manuel "Indice suivant")
  - Image floutée avec `filter: blur(Xpx)` qui décroît à chaque révélation (transition 700 ms)
  - VoiceInput pour répondre, match via `isMatch` (Levenshtein + alias)
  - Feedback instantané (vert/rouge) sur chaque essai, historique des tentatives
  - Bouton Abandonner
  - Écran résultats : révélation image + nom + explication + XP
- [x] Persistance BDD ([`actions.ts`](./src/app/(app)/jouer/jeu-2/actions.ts)) : `game_sessions` (mode='jeu2'), `answers_log`, `wrong_answers` si raté, `profiles.xp` + niveau.

### Hors périmètre (noté)

- Mode "simple" bonus (thème + 4 propositions dont 1 intrus) : **skippé** pour garder la phase focus. Pourra être ajouté en Phase 8 (Parcours) ou plus tard.

### Revision 2026-04-24 (après retour user)

- **Bug fix Étoile** : l'écran résultat affichait "5 indices révélés" même quand le joueur trouvait au 1er indice → on capture maintenant `indicesRevealedAtFound` au moment exact où le joueur trouve (avant la révélation de l'image). Le tick 1s et les side-effects (auto-reveal / timeout) ont été séparés en 2 `useEffect` pour éviter les double-setState sous StrictMode (bug "2 indices d'un coup").
- **Redesign Jeu 2** : à la demande du user, **Le Coup par Coup** remplace l'Étoile Mystérieuse en position "jeu 2" (plus fidèle à l'émission). L'Étoile est déplacée en **bonus** accessible depuis `/jouer/etoile`, ligne bonus de la home et hub `/jouer`.
- **Règles Le Coup par Coup** : 5 manches, 7 propositions / manche (6 liées + 1 intrus), LifeBar 2 paliers (**1 erreur = orange, 2 erreurs = Face-à-Face pénalité**). Scoring : 50 XP / bonne proposition, +200 XP bonus par manche parfaite, +500 XP bonus si 5 manches parfaites.
- Nouveau type `coup_par_coup` : ajouté au schéma zod, aux types DB, migration SQL `0003_coup_par_coup.sql` (ALTER TABLE questions / CHECK constraint).
- 17 thèmes seedés via [`src/data/coup-par-coup.json`](./src/data/coup-par-coup.json) — le `npm run seed` lit maintenant les deux fichiers.
- Nouveau fichier [`src/lib/game-logic/coup-par-coup.ts`](./src/lib/game-logic/coup-par-coup.ts).
- Nouveau client [`coup-par-coup-client.tsx`](./src/app/(app)/jouer/jeu-2/coup-par-coup-client.tsx) : état `intro → playing → round-ended → results`, shake sur intrus, feedback 2.2s entre les rounds, staggered reveal des 7 propositions.
- `game_sessions.mode` : on utilise désormais `'etoile'` et `'coup_par_coup'` (au lieu de l'ancien `'jeu2'`). `GameMode` type mis à jour.

---

## Phase 6 — Face-à-Face

**Statut** : DONE
**Date** : 2026-04-24

### Livrables

- [x] [`src/lib/game-logic/faceAFace.ts`](./src/lib/game-logic/faceAFace.ts) — types `FafMode`, `BotDifficulty`, `FafQuestion`, `FafAnswerLog`, constants `FAF_DURATION_MS=60_000` + `FAF_POOL_SIZE=50` + `BOT_PROFILES` (facile 50 %, moyen 70 %, difficile 90 %, délais 1.2 – 4.5 s). Helpers purs : `pickFaceAFaceQuestions`, `nextQuestionIndex`, `botResponseDelayMs`, `botAnswersCorrectly`, `computeFafXp` (500 / 400 / 300 / 200 selon temps restant).
- [x] Page [`/jouer/face-a-face`](./src/app/(app)/jouer/face-a-face/page.tsx) — Server Component qui tire jusqu'à 50 questions `face_a_face` + placeholder `NoFafQuestions` si < 5 dispos.
- [x] [`face-a-face-client.tsx`](./src/app/(app)/jouer/face-a-face/face-a-face-client.tsx) — state machine `mode-select → ami-pseudos → intro → playing ⇄ transition → results`.
  - 2 cartes chrono (P1 gauche, P2 droite) avec glow or + pulse sur le joueur actif, `tabular-nums`, passage en rouge pulsant à ≤ 10 s.
  - Tick RAF pur : décrément du chrono du joueur actif uniquement, fin de partie à 0.
  - Mode vs Bot : 3 difficultés, indicateur « Le bot réfléchit… » pendant le délai random du profil, puis bonne / mauvaise réponse résolue automatiquement.
  - Mode vs Ami local : saisie des 2 pseudos, même UX ensuite.
  - Règle : mauvaise réponse → question suivante auto (chrono continue). Passer → idem. Bonne réponse → fige le chrono, phase `transition` avec bouton « Lancer le tour » avant de switcher.
  - VoiceInput (Phase 5) réutilisé + bouton « Passer ».
  - Feedback flash court (« Passé », « Le bot se trompe », etc.) entre deux questions.
- [x] [`actions.ts`](./src/app/(app)/jouer/face-a-face/actions.ts) — `saveFafSession` : `game_sessions` (mode='face_a_face'), `answers_log` **uniquement** pour le user humain authentifié (pas les réponses bot/ami), `wrong_answers` upsertés, `profiles.xp` mis à jour si victoire.
- [x] Intégration game-over : les écrans de fin de **Jeu 1** (3 erreurs) et **Coup par Coup** (2 intrus) affichent maintenant un bouton rouge « Lancer le Face-à-Face » qui redirige vers `/jouer/face-a-face` (remplace l'ancien texte « dès qu'il sera disponible en Phase 6 »).
- [x] Hub `/jouer` : badge « Bientôt » retiré de la tuile Face-à-Face (`available: true`).

### Décisions validées avec le user

- Mauvaise réponse = **question suivante auto**, chrono continue (pas retry).
- Toujours **60 s par joueur**, même en déclenchement pénalité depuis Jeu 1 / CPC — pas de mode pénalité à chrono réduit.
- Bot UX option (a) : indicateur « Le bot réfléchit… » puis résolution automatique (pas d'animation de frappe texte).
- Mode Ami : demande des 2 pseudos au début (user pré-rempli avec son pseudo profil).

### Tests unitaires ajoutés (Phase 6 + rétroactif)

- [x] **Vitest** installé ([`vitest.config.ts`](./vitest.config.ts)) + scripts npm `test` / `test:watch`.
- [x] 6 fichiers de tests, **114 tests passent** :
  - [`src/lib/matching/fuzzy-match.test.ts`](./src/lib/matching/fuzzy-match.test.ts) — normalize (accents, articles FR/EN, apostrophes typos), isMatch (égalité, Levenshtein, garde-fou ≤ 3 chars, alias, seuil custom), matchDetails.
  - [`src/lib/schemas/question.test.ts`](./src/lib/schemas/question.test.ts) — validation zod par type (quizz_2 / 4 / etoile / coup_maitre / face_a_face / coup_par_coup), champs communs.
  - [`src/lib/game-logic/jeu1.test.ts`](./src/lib/game-logic/jeu1.test.ts) — lifeState, shouldTriggerFaceAFace, computeJeu1Xp (bonus parfait), pickJeu1Questions (variété + fallback).
  - [`src/lib/game-logic/jeu2.test.ts`](./src/lib/game-logic/jeu2.test.ts) — pickOneEtoile (préférence ≥ 3 indices, troncature), computeBlurPx, computeJeu2Xp (barème 500 / 400 / 300 / 200 / 100), placeholderAvatarUrl.
  - [`src/lib/game-logic/coup-par-coup.test.ts`](./src/lib/game-logic/coup-par-coup.test.ts) — cpcLifeState (2 paliers), cpcIsGameOver, pickCoupParCoupRounds (7 props, 6+1), computeCpcXp (bonus round + bonus partie).
  - [`src/lib/game-logic/faceAFace.test.ts`](./src/lib/game-logic/faceAFace.test.ts) — pickFaceAFaceQuestions (déterminisme via RNG seedé), nextQuestionIndex (recyclage), BOT_PROFILES (proba croissante), botResponseDelayMs (dans intervalle), botAnswersCorrectly (loi des grands nombres sur 5000 tirages), computeFafXp (paliers 500 / 400 / 300 / 200).
- [x] Fixtures partagées : [`src/lib/game-logic/_test-fixtures.ts`](./src/lib/game-logic/_test-fixtures.ts) avec `makeQuestion`, `makeCategory`, `SAMPLE_CATEGORIES`, `makeSeededRng` (LCG déterministe).

### Dépendances ajoutées

- `vitest` + `@vitest/coverage-v8` (devDeps).

---

## Phases 7 à 12

Voir le cahier des charges pour le détail. Chaque phase sera notée ici au fil de l'eau.
