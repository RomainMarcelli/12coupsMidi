# 🏆 MIDI MASTER — Cahier des charges & Prompts Claude Code

> PWA d'entraînement aux **12 Coups de Midi**, pour devenir Maître de Midi.
> Document à donner à Claude Code phase par phase.

---

## 📋 TABLE DES MATIÈRES

1. [Vision & Règles des jeux](#1-vision--règles-des-jeux)
2. [Stack technique](#2-stack-technique)
3. [Architecture du projet](#3-architecture-du-projet)
4. [Schéma de base de données](#4-schéma-de-base-de-données)
5. [Plan de développement par phases](#5-plan-de-développement-par-phases)
6. [Prompts Claude Code (à copier/coller)](#6-prompts-claude-code)

---

## 1. VISION & RÈGLES DES JEUX

### 🎯 Objectif produit
Aider un joueur à devenir **Maître de Midi** via un entraînement fidèle aux jeux télé, avec un **mode révision** qui retient les erreurs pour les retravailler.

### 🎮 Les jeux

#### **Jeu 1 — Quizz 1 chance sur 2**
- Question avec **2 propositions** (A ou B).
- Système de vies par couleurs : **🟢 Vert → 🟡 Jaune → 🔴 Rouge**.
- Chaque mauvaise réponse fait descendre d'un cran.
- Si **Rouge + nouvelle erreur** → bascule en **Face-à-Face (pénalité)**.
- Timer par question : **10 secondes**.

#### **Jeu 2 — Étoile Mystérieuse**
- Deviner une **personnalité** à partir d'indices dévoilés progressivement (image pixellisée qui se révèle + indices textuels).
- 5 indices textuels, l'image se dépixellise au fil du temps ou des bonnes réponses à des sous-questions.
- Bonus : mode "thème + 4 propositions dont 1 intrus" (version simple pour varier).

#### **Jeu 3 — Face-à-Face**
- **60 secondes** par joueur.
- Des questions défilent, on peut **répondre** ou **passer**.
- Tant qu'on n'a pas la bonne réponse, **le chrono tourne**.
- Bonne réponse → le chrono se fige, c'est à l'adversaire de jouer.
- Modes : **vs Bot** (IA avec niveau ajustable) ou **vs Ami** (local, tour par tour).
- **Reconnaissance vocale** (Web Speech API) + saisie clavier en fallback.
- Tolérance sur l'orthographe (Levenshtein).

#### **Coup de Maître** (jeu final)
- **4 célébrités** à identifier en **45 secondes** à partir d'indices.
- Si réussi → cagnotte virtuelle débloquée + badge Maître de Midi.

### 🧠 Mode Révision
- Toutes les questions **ratées** sont stockées dans une table `wrong_answers`.
- Section "Mes erreurs" où l'on peut refaire **uniquement les questions ratées**.
- Une fois une question ratée **3 fois bien retrouvée d'affilée**, elle sort de la table.
- Filtres par catégorie / sous-catégorie / difficulté.

### 📊 Stats & progression
- Dashboard avec : % de réussite global, % par catégorie, streak actuel, meilleur streak, niveau (XP).
- Graphiques d'évolution (7 / 30 jours).
- Badges débloquables (1er quizz, 10 bonnes d'affilée, Maître de Midi, etc.).

### ⚙️ Admin / Ajout de questions
- Interface réservée aux comptes avec rôle `admin`.
- Ajout manuel via formulaire.
- **Import JSON** en masse.
- **Export JSON** pour backup.

---

## 2. STACK TECHNIQUE

| Couche | Techno | Pourquoi |
|---|---|---|
| **Framework front** | **Next.js 15 (App Router) + TypeScript** | PWA native, SSR, routing, perfs top |
| **UI** | **Tailwind CSS + shadcn/ui** | Rapide, propre, thème custom facile |
| **Animations** | **Framer Motion** | Transitions fluides type TV |
| **Icônes** | **Lucide React** | Léger, cohérent |
| **Backend / BDD** | **Supabase** (Postgres + Auth + RLS) | Gratuit, temps réel, auth email magique |
| **ORM/Client** | **@supabase/supabase-js** | Officiel |
| **State management** | **Zustand** | Léger, parfait pour état de jeu |
| **PWA** | **next-pwa** (ou Serwist) | Offline, installable |
| **Vocal** | **Web Speech API** (natif) | Gratuit, FR supporté |
| **Sons** | **Howler.js** | Jingles TV, effets |
| **Graphiques stats** | **Recharts** | Simple, joli |
| **Déploiement** | **Vercel** | Gratuit, intégration Next.js parfaite |
| **Fuzzy matching** | **fastest-levenshtein** | Tolérance fautes de frappe |

### Design system — "Style Reichmann"
- **Couleurs** : `#0B1F4D` (bleu nuit TV), `#F5C518` (or midi), `#E63946` (rouge buzz), `#F1FAEE` (blanc cassé), `#2ECC71` (vert vie).
- **Typos** : Display → `Montserrat` (titres), `Inter` (texte).
- **Ambiance** : dégradés bleu/or, glow sur les boutons, transitions "TV show".

---

## 3. ARCHITECTURE DU PROJET

```
midi-master/
├── public/
│   ├── icons/              # Icônes PWA
│   ├── sounds/             # Jingles, buzzer, tic-tac
│   └── manifest.json
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (app)/
│   │   │   ├── layout.tsx           # Nav + auth guard
│   │   │   ├── page.tsx             # Dashboard / accueil
│   │   │   ├── jouer/
│   │   │   │   ├── jeu-1/           # Quizz 1/2
│   │   │   │   ├── jeu-2/           # Étoile Mystérieuse
│   │   │   │   ├── face-a-face/
│   │   │   │   └── coup-de-maitre/
│   │   │   ├── parcours/            # Mode complet enchaîné
│   │   │   ├── revision/
│   │   │   ├── stats/
│   │   │   └── admin/
│   │   │       └── questions/
│   │   ├── api/
│   │   │   └── questions/import/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                      # shadcn
│   │   ├── game/
│   │   │   ├── LifeBar.tsx          # Vert/Jaune/Rouge
│   │   │   ├── Timer.tsx
│   │   │   ├── QuestionCard.tsx
│   │   │   ├── AnswerButton.tsx
│   │   │   └── VoiceInput.tsx
│   │   ├── layout/
│   │   └── stats/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── game-logic/
│   │   │   ├── jeu1.ts
│   │   │   ├── jeu2.ts
│   │   │   ├── faceAFace.ts
│   │   │   ├── coupDeMaitre.ts
│   │   │   └── scoring.ts
│   │   ├── voice/
│   │   │   └── speech-recognition.ts
│   │   ├── matching/
│   │   │   └── fuzzy-match.ts       # Levenshtein + normalisation
│   │   └── utils.ts
│   ├── stores/
│   │   ├── gameStore.ts             # Zustand état de partie
│   │   └── userStore.ts
│   ├── types/
│   │   └── database.ts              # Généré depuis Supabase
│   └── data/
│       └── seed-questions.json      # 150 questions de départ
├── supabase/
│   └── migrations/
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. SCHÉMA DE BASE DE DONNÉES (Supabase / Postgres)

```sql
-- Utilisateurs (géré par Supabase Auth, on ajoute un profil)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  pseudo text unique not null,
  role text check (role in ('user', 'admin')) default 'user',
  xp int default 0,
  niveau int default 1,
  created_at timestamptz default now()
);

-- Catégories (grandes)
create table categories (
  id serial primary key,
  nom text unique not null,
  slug text unique not null,
  emoji text,
  couleur text
);

-- Sous-catégories
create table subcategories (
  id serial primary key,
  category_id int references categories on delete cascade,
  nom text not null,
  slug text not null,
  unique (category_id, slug)
);

-- Questions
create table questions (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('quizz_2', 'quizz_4', 'etoile', 'face_a_face', 'coup_maitre')) not null,
  category_id int references categories,
  subcategory_id int references subcategories,
  difficulte int check (difficulte between 1 and 5) default 2,
  enonce text not null,
  reponses jsonb not null,           -- [{text: "...", correct: bool}, ...]
  bonne_reponse text,                -- pour face_a_face (réponse libre)
  alias jsonb,                       -- variantes acceptées : ["Bonaparte", "Napoléon Ier"]
  indices jsonb,                     -- pour étoile/coup de maître : ["indice 1", "indice 2", ...]
  image_url text,
  explication text,
  author_id uuid references profiles,
  created_at timestamptz default now()
);

-- Historique de parties
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  mode text not null,                -- 'jeu1', 'jeu2', 'face_a_face', 'coup_maitre', 'parcours', 'revision'
  score int default 0,
  correct_count int default 0,
  total_count int default 0,
  duration_seconds int,
  xp_gained int default 0,
  created_at timestamptz default now()
);

-- Réponses individuelles (pour stats et mode révision)
create table answers_log (
  id bigserial primary key,
  session_id uuid references game_sessions on delete cascade,
  user_id uuid references profiles on delete cascade,
  question_id uuid references questions on delete cascade,
  is_correct boolean not null,
  time_taken_ms int,
  created_at timestamptz default now()
);

-- Table révision : questions ratées à retravailler
create table wrong_answers (
  id bigserial primary key,
  user_id uuid references profiles on delete cascade,
  question_id uuid references questions on delete cascade,
  fail_count int default 1,
  success_streak int default 0,      -- compteur de bonnes réponses consécutives en révision
  last_seen_at timestamptz default now(),
  unique (user_id, question_id)
);

-- Badges
create table badges (
  id serial primary key,
  code text unique not null,         -- 'first_game', 'maitre_midi', etc.
  nom text not null,
  description text,
  icone text
);

create table user_badges (
  user_id uuid references profiles on delete cascade,
  badge_id int references badges on delete cascade,
  obtained_at timestamptz default now(),
  primary key (user_id, badge_id)
);

-- RLS policies à activer partout
alter table profiles enable row level security;
alter table questions enable row level security;
alter table game_sessions enable row level security;
alter table answers_log enable row level security;
alter table wrong_answers enable row level security;
alter table user_badges enable row level security;

-- Lecture questions : tout le monde (connecté)
create policy "Lecture questions pour users connectés"
  on questions for select using (auth.role() = 'authenticated');

-- Ajout questions : admin uniquement
create policy "Ajout questions par admin"
  on questions for insert
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Chaque user voit et modifie ses propres données
create policy "User voit ses sessions"
  on game_sessions for select using (user_id = auth.uid());
create policy "User crée ses sessions"
  on game_sessions for insert with check (user_id = auth.uid());

-- (idem pour answers_log, wrong_answers, user_badges...)
```

### 🗂️ Catégories & sous-catégories

| Catégorie | Sous-catégories |
|---|---|
| 🏛️ **Histoire** | Antiquité, Moyen-Âge, Renaissance, Révolution, XIXe, XXe, Contemporain |
| 🌍 **Géographie** | France, Europe, Monde, Capitales, Drapeaux, Fleuves/Montagnes |
| ⚽ **Sport** | Football, Tennis, JO, Rugby, Cyclisme, Autres |
| 🎨 **Art** | Peinture, Sculpture, Architecture, Cinéma, Musique classique |
| 📚 **Littérature** | Classiques FR, Romans étrangers, Poésie, BD |
| 🧬 **SVT** | Corps humain, Animaux, Plantes, Écologie |
| ⚗️ **Chimie** | Éléments, Réactions, Vie quotidienne |
| ⚛️ **Physique** | Mécanique, Optique, Astronomie, Électricité |
| 🎮 **Jeu vidéo** | Rétro, Consoles, Licences, Esport |
| 📰 **Actualité** | Politique, Économie, Société, People |
| 🎬 **Cinéma/TV** | Films cultes, Séries, Acteurs, Oscars/César |
| 🎵 **Musique** | Chanson FR, Rock/Pop, Rap, Classique |
| 🍽️ **Gastronomie** | Cuisine FR, Du monde, Vins, Ingrédients |
| 💡 **Culture G** | Inventions, Mythologie, Religions, Langues |

---

## 5. PLAN DE DÉVELOPPEMENT PAR PHASES

Claude Code travaillera **phase par phase**. Ne lance pas la phase suivante tant que la précédente n'est pas validée et testée.

| Phase | Titre | Livrable |
|---|---|---|
| **0** | Setup projet | Next.js + Tailwind + shadcn + PWA configurés |
| **1** | Supabase & Auth | BDD créée, auth magic link, profils |
| **2** | Design system | Thème Reichmann, composants UI de base |
| **3** | Seed & Admin questions | 150 questions en base + interface admin |
| **4** | Jeu 1 — Quizz 1/2 | Jouable de bout en bout avec LifeBar |
| **5** | Jeu 2 — Étoile Mystérieuse | Jouable avec indices progressifs |
| **6** | Face-à-Face | vs Bot + vs Ami local + reconnaissance vocale |
| **7** | Coup de Maître | 4 célébrités / 45 sec |
| **8** | Parcours complet | Enchaînement des jeux type émission |
| **9** | Mode Révision | Table wrong_answers + interface |
| **10** | Stats & Badges | Dashboard + système XP/niveaux/badges |
| **11** | PWA & Polish | Offline, installable, sons, anims, responsive |
| **12** | Déploiement | Vercel + Supabase prod |

---

## 6. PROMPTS CLAUDE CODE

> 💡 **Mode d'emploi** : tu colles un prompt, tu attends que Claude Code finisse et te confirme que ça marche, tu testes rapidement, puis tu passes au suivant. Si un truc casse, tu dis "répare X" avant de continuer.

---

### 🔧 PROMPT PHASE 0 — Setup du projet

```
Tu es le développeur expert du projet "Midi Master", une PWA d'entraînement
aux 12 Coups de Midi. Stack imposée :
- Next.js 15 (App Router) + TypeScript strict
- Tailwind CSS v4
- shadcn/ui
- next-pwa (ou Serwist)
- Framer Motion
- Zustand
- Supabase JS
- Howler.js
- Recharts
- fastest-levenshtein

MISSION PHASE 0 :
1. Initialise un projet Next.js 15 nommé "midi-master" avec TypeScript,
   Tailwind, App Router, alias "@/*", ESLint.
2. Installe toutes les dépendances listées + devDeps nécessaires.
3. Configure shadcn/ui (base color: slate, CSS variables: yes).
4. Configure next-pwa avec manifest.json (nom "Midi Master",
   theme_color #0B1F4D, background #0B1F4D, icônes 192/512 en placeholder).
5. Crée la structure de dossiers complète telle que définie ci-dessous :

[colle ici la section "3. ARCHITECTURE DU PROJET" du cahier des charges]

6. Mets en place un .env.example avec les variables :
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY.
7. Crée une page d'accueil temporaire "src/app/page.tsx" qui affiche
   "🏆 Midi Master — en construction" pour vérifier que ça tourne.

CONTRAINTES :
- TypeScript strict, pas de `any` non justifié.
- Respecte exactement l'arborescence demandée.
- Ne touche pas encore à la BDD ni aux jeux.

Quand tu as terminé, liste les commandes à lancer (npm install, npm run dev)
et confirme que le projet démarre sans erreur.
```

---

### 🔧 PROMPT PHASE 1 — Supabase & Auth

```
PHASE 1 — Supabase & Auth.

1. Crée le fichier supabase/migrations/0001_init.sql contenant EXACTEMENT
   le schéma SQL suivant (ne modifie pas les noms de tables/colonnes) :

[colle ici la section "4. SCHÉMA DE BASE DE DONNÉES" — tout le bloc SQL]

2. Crée les clients Supabase :
   - src/lib/supabase/client.ts (côté navigateur, @supabase/ssr)
   - src/lib/supabase/server.ts (côté serveur, avec cookies)
   - src/lib/supabase/middleware.ts
   - src/middleware.ts à la racine src/ pour refresh session

3. Implémente l'auth par MAGIC LINK (email) :
   - Page src/app/(auth)/login/page.tsx : formulaire email + bouton
     "Recevoir le lien", design style TV (bleu/or).
   - Route /auth/callback qui gère le retour du magic link.
   - À la première connexion, crée automatiquement une ligne dans `profiles`
     avec un pseudo par défaut (partie avant @ de l'email).

4. Layout (app) protégé :
   - src/app/(app)/layout.tsx vérifie la session, sinon redirect /login.
   - Navbar minimaliste avec : logo, pseudo, bouton déconnexion.

5. Génère les types TypeScript Supabase dans src/types/database.ts
   (documente la commande `supabase gen types typescript`).

6. README.md à la racine : comment créer son projet Supabase, lancer
   la migration, configurer .env.local.

Teste : un user non connecté arrive sur /, est redirigé vers /login,
peut se connecter, voit son pseudo.
```

---

### 🔧 PROMPT PHASE 2 — Design system Reichmann

```
PHASE 2 — Design system "12 Coups de Midi".

1. Dans tailwind.config.ts (ou globals.css pour Tailwind v4),
   ajoute le thème :
   - primary: #0B1F4D (bleu nuit)
   - gold: #F5C518
   - buzz: #E63946 (rouge)
   - life-green: #2ECC71
   - life-yellow: #F5C518
   - life-red: #E63946
   - cream: #F1FAEE
   Fonts : Montserrat (display), Inter (body) via next/font.

2. Installe via shadcn les composants : button, card, dialog, input,
   progress, toast, tabs, badge, avatar, dropdown-menu.

3. Customise le Button shadcn : variantes "gold" (fond or, texte bleu,
   glow au hover), "buzz" (rouge), "ghost-gold".

4. Crée src/components/game/ :
   - LifeBar.tsx : 3 pastilles vert/jaune/rouge, anime le passage
     d'un état à l'autre (Framer Motion, scale + couleur).
     Props : state: 'green' | 'yellow' | 'red'.
   - Timer.tsx : cercle SVG qui se vide, couleur qui passe au rouge
     à 3 secondes, tic-tac sonore optionnel.
     Props : duration: number, onEnd: () => void, paused?: boolean.
   - QuestionCard.tsx : carte avec catégorie (badge coloré), énoncé
     gros et lisible, animation d'entrée slide + fade.
   - AnswerButton.tsx : bouton réponse, 3 états (idle, correct=vert glow,
     wrong=rouge shake).

5. Crée src/components/layout/Navbar.tsx avec logo "🏆 Midi Master"
   en or sur fond bleu, navigation : Jouer, Révision, Stats, Admin (si role).

6. Page d'accueil src/app/(app)/page.tsx : grande tuile "Lancer le parcours",
   4 tuiles plus petites pour chaque jeu, 1 tuile "Révision".
   Style : dégradés bleu/or, glow, hover scale 1.02.

Teste toutes les variantes de composants dans une page de démo temporaire
/demo.
```

---

### 🔧 PROMPT PHASE 3 — Seed 150 questions & Admin

```
PHASE 3 — Seed des catégories + 150 questions + interface admin.

1. Crée supabase/migrations/0002_seed.sql :
   - INSERT des 14 catégories avec emojis/couleurs (cf. tableau suivant) :

[colle ici le tableau "Catégories & sous-catégories" en le transformant en INSERT SQL]

   - INSERT des sous-catégories.
   - INSERT de ~10 badges de base : first_game, streak_5, streak_10,
     perfect_game, maitre_midi, night_owl, révisionniste, etc.

2. Crée src/data/seed-questions.json contenant EXACTEMENT 150 questions
   réparties sur toutes les catégories, mix des types :
   - 60 questions type "quizz_2" (2 propositions)
   - 40 questions type "quizz_4" (4 propositions, 1 bonne)
   - 20 questions type "etoile" (avec `indices` array de 5 items +
     `bonne_reponse` + `alias`)
   - 20 questions type "face_a_face" (réponse libre + alias)
   - 10 questions type "coup_maitre" (célébrités avec indices)

   Format JSON strict :
   {
     "type": "quizz_2",
     "category_slug": "histoire",
     "subcategory_slug": "xxe",
     "difficulte": 2,
     "enonce": "En quelle année a eu lieu le débarquement en Normandie ?",
     "reponses": [{"text":"1944","correct":true},{"text":"1945","correct":false}],
     "explication": "Le 6 juin 1944, opération Overlord."
   }

   IMPORTANT : questions de culture générale française, variées,
   vérifiables, pas d'erreur factuelle. Niveau moyen (difficulté 2-3).

3. Crée un script src/scripts/seed.ts qui lit le JSON et insère dans
   Supabase (utilise SUPABASE_SERVICE_ROLE_KEY, résout les slugs en IDs).
   Commande npm : "seed": "tsx src/scripts/seed.ts".

4. Interface admin src/app/(app)/admin/questions/ :
   - Guard : redirect si role !== 'admin'.
   - Page liste : tableau paginé avec filtres (catégorie, type, difficulté),
     recherche texte, actions (éditer/supprimer).
   - Page /admin/questions/new : formulaire complet (type dynamique,
     les champs changent selon le type choisi).
   - Page /admin/questions/import : zone drop de fichier JSON +
     textarea, validation du schéma avec zod, preview avant insert,
     import batch avec progress bar.
   - Page /admin/questions/export : télécharge toutes les questions en JSON.

5. Pour passer un user en admin : documente dans README la commande
   SQL à lancer dans Supabase (`update profiles set role='admin' where ...`).

Teste : lance le seed, vérifie que 150 questions sont en base, connecte-toi
en admin, édite une question, importe un mini-JSON de 2 questions.
```

---

### 🔧 PROMPT PHASE 4 — Jeu 1 : Quizz 1 chance sur 2

```
PHASE 4 — Jeu 1 "Quizz 1 chance sur 2".

Règles exactes :
- 10 questions type "quizz_2" tirées au hasard (priorité aux catégories
  variées).
- Timer 10 secondes par question.
- État de vie : 🟢 green → 🟡 yellow → 🔴 red.
- Mauvaise réponse OU temps écoulé = 1 vie perdue.
- Red + nouvelle erreur = déclenche le Face-à-Face pénalité (pour l'instant
  un écran "Tu passes au Face-à-Face" avec redirect à préparer — on
  branchera en phase 6).
- Bonne réponse = +100 XP, gagner la partie (10/10 survie) = bonus +500 XP.

IMPLÉMENTATION :

1. src/stores/gameStore.ts (Zustand) :
   - state : mode, questions[], currentIndex, lifeState, score, answers[]
   - actions : startGame(mode), answerQuestion(value), nextQuestion(),
     endGame()
   - persistance dans sessionStorage pour reprise.

2. src/lib/game-logic/jeu1.ts :
   - fetchQuestions(count=10, type='quizz_2') : tire du Supabase
     en randomisant, variété des catégories (algo : max 2 questions
     par catégorie).
   - computeLifeState(wrongCount) : 0→green, 1→yellow, 2→red.
   - shouldTriggerFaceAFace(wrongCount) : wrongCount >= 3.

3. src/app/(app)/jouer/jeu-1/page.tsx :
   - Écran intro avec règles + bouton "C'EST PARTI !" (style TV).
   - Loop de jeu : QuestionCard + 2 AnswerButtons grands, côte à côte,
     avec Timer au-dessus, LifeBar à droite.
   - Animation de révélation de la bonne réponse (vert glow + son "ding").
   - Mauvaise réponse : shake rouge + son "buzz" + affichage de la bonne +
     transition LifeBar.
   - À la fin : écran résultats (score, XP gagné, questions ratées), boutons
     "Rejouer" / "Révision" / "Accueil".

4. Enregistre en base :
   - 1 ligne dans game_sessions à la fin.
   - 1 ligne dans answers_log par question.
   - Les questions ratées vont dans wrong_answers (upsert, increment fail_count).
   - Update profiles.xp.

5. Sons : ajoute dans public/sounds/ les fichiers :
   - tick.mp3 (tic-tac timer)
   - ding.mp3 (bonne réponse)
   - buzz.mp3 (mauvaise réponse)
   - win.mp3 (fin de partie gagnée)
   - Si tu ne peux pas fournir les fichiers, utilise des URLs CDN libres
     de droits ou génère-les via Howler avec Web Audio API (tons simples).

CONTRAINTE UX : tout doit être jouable uniquement au clavier (touches A/B
ou ←/→).

Teste 3 scénarios : victoire parfaite, game over avant face-à-face,
déclenchement du face-à-face.
```

---

### 🔧 PROMPT PHASE 5 — Jeu 2 : Étoile Mystérieuse

```
PHASE 5 — Jeu 2 "Étoile Mystérieuse".

Règles :
- 1 personnalité à deviner.
- Image floutée/pixellisée en grand (CSS filter: blur + pixelate).
- 5 indices textuels révélés progressivement (1 toutes les 20 secondes OU
  après une sous-question répondue).
- À chaque étape, le joueur peut : (a) proposer une réponse libre
  (vocal + clavier), (b) attendre l'indice suivant.
- Tolérance aux fautes : normalisation (minuscules, sans accents) +
  Levenshtein ≤ 2 + alias.
- Durée max : 2 minutes.
- Scoring : trouvé au 1er indice = 500 XP, 2e = 400, 3e = 300, 4e = 200,
  5e = 100, pas trouvé = 0.

Bonus "mode simple" (activable depuis l'intro) :
- Thème + 4 propositions dont 1 intrus à identifier.
- Plus rapide, bon pour varier.

IMPLÉMENTATION :

1. src/lib/matching/fuzzy-match.ts :
   - normalize(s) : toLowerCase, deburr (sans accents), trim, retire
     articles "le/la/les/l'".
   - isMatch(userInput, correctAnswer, aliases=[]) :
     normalise tout, puis vérifie égalité OU Levenshtein ≤ 2 sur un
     des candidats.

2. src/lib/voice/speech-recognition.ts :
   - hook useSpeechRecognition() basé sur window.SpeechRecognition /
     webkitSpeechRecognition, lang='fr-FR', continuous=false, interim=true.
   - Retourne { transcript, listening, start, stop, supported }.
   - Fallback gracieux si non supporté.

3. src/components/game/VoiceInput.tsx :
   - Gros bouton micro (toggle), affiche transcript en temps réel,
     input texte en dessous pour fallback, bouton "Valider".

4. src/lib/game-logic/jeu2.ts :
   - fetchEtoile() : prend 1 question type 'etoile' au hasard avec ses 5 indices.
   - revealNextIndice(state) : dévoile l'indice suivant.
   - computePixelation(indicesRevealed) : niveau 5 → 1 (plus on avance,
     moins c'est flouté).

5. src/app/(app)/jouer/jeu-2/page.tsx :
   - Layout : à gauche l'image (filter dynamique), à droite la liste des
     indices (certains révélés, les autres masqués "???"), en bas
     VoiceInput + bouton "Indice suivant".
   - Timer global 2 minutes + option "abandonner" → affiche la réponse.
   - Résultat : animation de révélation de l'image nette + XP + retour.

6. Enregistre la session comme d'habitude.

Important : l'image peut être un placeholder (avatar via DiceBear API)
si pas d'URL en base — à partir du nom. Permet de tester sans vraies images.

Teste : joueur trouve au 1er indice, au 3e, ne trouve pas, utilise la voix.
```

---

### 🔧 PROMPT PHASE 6 — Face-à-Face

```
PHASE 6 — Face-à-Face (vs Bot et vs Ami local).

Règles :
- 2 joueurs, chacun son chrono de 60 secondes.
- Une question apparaît ; le joueur actif peut :
  - Répondre (vocal ou clavier)
  - Passer (nouvelle question, chrono continue à tourner)
- Tant que la réponse est fausse OU qu'il passe → son chrono tourne.
- Bonne réponse → son chrono se FIGE, c'est au tour de l'adversaire.
- Premier dont le chrono atteint 0 = perd.

Modes :
- vs BOT : IA avec niveau (facile/moyen/difficile). Le bot a un taux de
  réussite ajustable (facile 50%, moyen 70%, difficile 90%) et un temps
  de réponse variable (1.5s à 4s). Simulation simple.
- vs AMI (local) : même appareil, on se passe le téléphone entre chaque
  tour. Au début, demande les 2 pseudos.

IMPLÉMENTATION :

1. src/lib/game-logic/faceAFace.ts :
   - Type GameState : { p1: PlayerState, p2: PlayerState, activePlayer,
     currentQuestion, status }.
   - PlayerState : { pseudo, timeLeftMs, lastTickAt }.
   - fetchQuestions(count=50, type='face_a_face') : pool de 50 questions
     pour éviter de retomber sur les mêmes.
   - tick(state, deltaMs) : décrémente timeLeftMs du joueur actif.
   - onCorrectAnswer(state) : fige, switch d'actif.
   - onPass(state) : question suivante du pool.
   - botPlay(state, difficulty) : après delay aléatoire, proba de
     bonne réponse selon difficulté.

2. src/app/(app)/jouer/face-a-face/page.tsx :
   - Écran sélection : vs Bot (choix difficulté) / vs Ami (saisie pseudos).
   - Écran de jeu : 2 chronos en haut (P1 à gauche, P2 à droite, celui
     qui joue est mis en évidence avec glow or), question au centre,
     VoiceInput + bouton "Passer" en bas.
   - Pour vs Ami : écran "passe le téléphone à X" entre chaque switch.
   - Animation de transition de tour (zoom/slide).

3. Vocal obligatoire pour ce mode (plus rapide), mais fallback clavier
   toujours dispo.

4. Fin de partie : écran victoire/défaite, XP au vainqueur, retour.

5. Ce mode doit aussi être déclenchable depuis le Jeu 1/2 en cas de "Rouge
   + erreur" (penalty mode : 1v1 contre le bot en 30 secondes seulement,
   si tu perds la session Jeu 1 est perdue).

Teste : vs Bot facile/difficile, vs Ami, mode pénalité depuis Jeu 1.
```

---

### 🔧 PROMPT PHASE 7 — Coup de Maître

```
PHASE 7 — Coup de Maître (jeu final).

Règles :
- 4 célébrités à identifier en 45 secondes TOTAL (pas 45s chacune).
- Pour chacune, 2-3 indices s'affichent en même temps.
- Le joueur répond (vocal ou clavier), si bonne réponse → passe à la
  suivante, si mauvaise → il peut réessayer ou passer.
- 4/4 réussi avant 45s = débloque le badge "Maître de Midi" + cagnotte
  virtuelle (compteur qui s'incrémente à chaque Coup de Maître réussi).

IMPLÉMENTATION :

1. src/lib/game-logic/coupDeMaitre.ts :
   - fetchCelebrities(count=4) : tire 4 questions type 'coup_maitre'.
   - Chaque question a : { bonne_reponse, alias, indices (array) }.

2. src/app/(app)/jouer/coup-de-maitre/page.tsx :
   - Intro cinématique (musique, dégradé or, "LE COUP DE MAÎTRE").
   - Écran de jeu : grand chrono central, carte célébrité avec indices,
     VoiceInput, compteur "1/4, 2/4...".
   - À chaque bonne réponse : animation "cling" + révèle le nom complet.
   - Fin :
     - Si 4/4 : animation de feu d'artifice (CSS/Framer), son de victoire,
       badge débloqué, cagnotte +10 000€ (virtuel), +2000 XP.
     - Sinon : écran "Dommage, presque !", retour.

3. Incrémente profiles.cagnotte_virtuelle (ajoute cette colonne dans
   une nouvelle migration 0003_cagnotte.sql si pas déjà là).

Teste : 4/4 parfait, 3/4, 0/4.
```

---

### 🔧 PROMPT PHASE 8 — Parcours complet

```
PHASE 8 — Mode "Parcours complet" (enchaînement type émission).

Objectif : reproduire une émission entière d'affilée pour s'entraîner
dans les conditions du direct.

Flux :
1. Jeu 1 (Quizz 1/2) — 10 questions
2. Si survécu : Jeu 2 (Étoile Mystérieuse)
3. Si trouvée : Face-à-Face vs Bot moyen (60 sec chacun)
4. Si gagné : Coup de Maître (4 célébrités / 45 sec)

À la fin : récap complet + "tu es Maître de Midi du jour" si tout réussi.

IMPLÉMENTATION :

1. src/app/(app)/parcours/page.tsx :
   - Intro : "Bienvenue aux 12 Coups de Midi, candidat !" (effet jingle).
   - Orchestre les 4 jeux via le gameStore en mode "parcours".
   - Transitions stylées entre chaque jeu (jingle + titre du jeu qui
     arrive en grand).
   - En cas d'échec à une étape, écran "Parcours terminé ici" + stats
     partielles.

2. Enregistre UNE SEULE game_session avec mode='parcours' qui agrège
   tous les sous-scores.

3. XP bonus : +5000 XP si parcours parfait complet.

Teste un parcours de bout en bout.
```

---

### 🔧 PROMPT PHASE 9 — Mode Révision

```
PHASE 9 — Mode Révision (apprendre de ses erreurs).

Règles :
- Toutes les questions ratées (table wrong_answers) sont rejouables ici.
- Filtres : catégorie, sous-catégorie, type de jeu, difficulté.
- Algorithme spaced repetition simplifié :
  - success_streak < 3 → la question reste dans la table.
  - success_streak >= 3 → la question sort automatiquement.
  - Mauvaise réponse en révision → success_streak = 0, fail_count +1.
- Affiche le nombre de questions à réviser par catégorie sur la page
  d'accueil révision.

IMPLÉMENTATION :

1. src/app/(app)/revision/page.tsx :
   - Liste des catégories avec compteur ("Histoire : 12 à réviser").
   - Filtres (dropdown type, difficulté).
   - Bouton "Lancer une session" : 10 questions piochées dans
     wrong_answers selon les filtres.

2. src/app/(app)/revision/session/page.tsx :
   - Même UX qu'un quizz, mais à la fin de chaque question montre
     l'explication (champ `explication` de la question).
   - Update wrong_answers après chaque réponse.

3. Section "Toutes mes erreurs" : tableau consultable avec recherche,
   possibilité de retirer manuellement une question de la révision.

Teste : rate 5 questions en Jeu 1, va en révision, retrouve-les,
réussis-en 3 fois de suite une → elle doit disparaître.
```

---

### 🔧 PROMPT PHASE 10 — Stats, XP & Badges

```
PHASE 10 — Dashboard stats, système XP/niveaux et badges.

RÈGLES XP/NIVEAUX :
- Niveau 1 : 0 XP
- Niveau n : n * 1000 XP (niveau 2 à 1000, niveau 3 à 2000, etc.)
- Affiche barre de progression vers niveau suivant.

BADGES (vérifiés après chaque fin de partie) :
- first_game : première partie terminée
- streak_5 / streak_10 / streak_20 : bonnes réponses d'affilée
- perfect_jeu1 : 10/10 au Jeu 1
- etoile_first_try : Étoile trouvée au 1er indice
- face_a_face_win_bot_hard : gagné vs Bot difficile
- maitre_midi : Coup de Maître 4/4
- parcours_parfait : parcours complet sans erreur
- revisionniste : 50 questions révisées avec succès
- encyclopedie : 80% de réussite dans une catégorie (min 20 questions)

IMPLÉMENTATION :

1. src/lib/game-logic/scoring.ts :
   - computeXp(session) : calcule XP selon mode et résultat.
   - checkBadges(userId, sessionStats) : fonction côté serveur (route
     API ou RPC Supabase) qui vérifie tous les badges éligibles et insère
     dans user_badges.

2. src/app/(app)/stats/page.tsx :
   - Header : pseudo, niveau, XP actuel, barre de progression.
   - Cartes : nombre de parties, % réussite global, meilleur streak,
     cagnotte virtuelle totale.
   - Recharts : courbe d'XP sur 30 derniers jours, barres horizontales
     de % réussite par catégorie.
   - Liste des badges (obtenus en couleur, non obtenus grisés avec
     condition visible).
   - Historique des 20 dernières sessions.

3. Composant src/components/stats/LevelBadge.tsx réutilisable
   (affiché dans la navbar).

4. Toast festif quand un badge est gagné (Framer Motion + son).

Teste : joue, vérifie que l'XP monte, que les badges se débloquent,
que le dashboard reflète bien la réalité.
```

---

### 🔧 PROMPT PHASE 11 — PWA & Polish

```
PHASE 11 — PWA installable, offline, polish final.

1. Vérifie next-pwa :
   - manifest.json complet (shortcuts vers Jouer/Révision/Stats).
   - Service worker cache les assets statiques + les pages principales.
   - Strategie runtime : NetworkFirst pour Supabase, CacheFirst pour
     images/fonts/sons.
   - Offline fallback : page "/offline" jolie.

2. Icônes PWA : génère 192, 512, maskable (tu peux utiliser un script
   sharp + un logo SVG simple "MM" en or sur fond bleu).

3. Responsive : toutes les pages doivent être impeccables en mobile
   (priorité), tablette, desktop. Teste les points de rupture 375px,
   768px, 1024px.

4. Accessibilité :
   - aria-labels sur tous les boutons actions.
   - focus visible (outline or).
   - contraste AA minimum.
   - Réduction des animations si prefers-reduced-motion.

5. Sons :
   - Réglage volume global (localStorage) + bouton mute dans navbar.
   - Pas de son auto-play sans interaction.

6. Écran de splash stylé (logo qui apparaît + jingle court au premier
   load).

7. Easter egg Reichmann : taper "reichmann" quelque part → la nav
   applaudit 3 secondes.

8. Lighthouse : objectif PWA 100, Accessibility > 90, Performance > 85.
   Corrige tout ce qui bloque.

Teste : installe la PWA sur mobile (Add to Home Screen), coupe le réseau,
vérifie que les questions déjà vues sont lisibles en révision offline
(cache).
```

---

### 🔧 PROMPT PHASE 12 — Déploiement

```
PHASE 12 — Déploiement production.

1. Crée un projet Supabase de production (documente les étapes dans
   DEPLOY.md) :
   - Lance les migrations.
   - Lance le seed.
   - Active les policies RLS.
   - Configure l'URL de redirection auth vers le domaine Vercel.

2. Déploie sur Vercel :
   - Push sur GitHub.
   - Connecte Vercel, configure les variables d'environnement.
   - Build et vérifie que tout marche en prod.

3. Crée un compte admin via SQL dans Supabase prod pour toi + ton ami.

4. Post-déploiement checklist (dans DEPLOY.md) :
   - Auth magic link marche en prod.
   - Un user normal ne voit pas l'admin.
   - Import JSON fonctionne.
   - PWA installable depuis le domaine HTTPS.
   - Sons chargent bien (CORS).
   - Pas d'erreur console.

5. Monitoring : ajoute un try/catch global + envoi des erreurs dans
   une table `error_logs` Supabase pour debugging.

Livre le lien final prêt à partager à ton ami.
```

---

## 🎁 BONUS — Évolutions futures (post V1)

À garder dans un fichier `TODO.md` :

- Multijoueur en ligne (Supabase Realtime) pour face-à-face à distance.
- Classement public (leaderboard hebdo).
- Mode "défi du jour" : 1 quizz quotidien partagé.
- Génération de questions par IA (Claude API) avec validation admin.
- Application mobile native via Capacitor si besoin.
- Intégration de vraies images de célébrités (attention droits).
- Mode "entraînement ciblé" : l'algo propose les catégories faibles.

---

## ✅ CHECKLIST DE VALIDATION

Avant de dire "c'est fini", vérifie :

- [ ] Le parcours complet est jouable sans bug.
- [ ] La reconnaissance vocale marche en FR sur Chrome mobile.
- [ ] Les questions ratées remontent bien en révision.
- [ ] Les badges se débloquent aux bons moments.
- [ ] L'admin peut ajouter 10 questions via JSON en moins d'une minute.
- [ ] La PWA s'installe sur iOS et Android.
- [ ] Le design est vraiment "12 Coups de Midi" (bleu/or, transitions TV).
- [ ] Zero erreur console en prod.
- [ ] Ton ami te dit "c'est ouf" 🏆
