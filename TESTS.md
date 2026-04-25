# Mahylan — Check-list des tests manuels (Phases 1 → 3)

Tous les tests à passer avant de valider les phases 1, 2 et 3.
Coche les cases au fur et à mesure. En cas d'échec, note l'étape et signale-la.

---

## 0. Pré-requis (à faire UNE FOIS)

### 0.1 Projet Supabase & `.env.local`

- [ ] Projet Supabase créé (Dashboard → New project)
- [ ] `.env.local` rempli avec les 3 variables :
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3000` dans `.env.local`

### 0.2 Supabase — URLs de redirection auth

- [ ] Dashboard → Authentication → URL Configuration :
  - [ ] **Site URL** = `http://localhost:3000`
  - [ ] **Redirect URLs** contient `http://localhost:3000/auth/callback`

### 0.3 Supabase — migrations passées

- [ ] SQL Editor : coller et exécuter [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
  - [ ] Table Editor : les 9 tables existent (`profiles`, `categories`, `subcategories`, `questions`, `game_sessions`, `answers_log`, `wrong_answers`, `badges`, `user_badges`)
- [ ] SQL Editor : coller et exécuter [`supabase/migrations/0002_seed.sql`](./supabase/migrations/0002_seed.sql)
  - [ ] `categories` contient 14 lignes
  - [ ] `subcategories` contient ~60 lignes
  - [ ] `badges` contient 11 lignes

### 0.4 Install & build

- [ ] `npm install` sans erreur
- [ ] `npm run typecheck` — aucune erreur
- [ ] `npm run build` — build webpack OK, 10 routes listées

---

## 1. Phase 1 — Supabase & Auth

### 1.1 Auth guard (user non connecté)

Lance `npm run dev`.

- [ ] http://localhost:3000 → **redirigé** vers `/login`
- [ ] http://localhost:3000/demo → redirigé vers `/login`
- [ ] http://localhost:3000/admin/questions → redirigé vers `/login`

### 1.2 Magic link — envoi

- [ ] Saisir un email invalide (`toto`) → message rouge "Adresse email invalide."
- [ ] Saisir ton vrai email → clic "Recevoir le lien" → message vert "Lien envoyé à …"
- [ ] Le bouton reste désactivé tant que le message est affiché
- [ ] Email reçu dans la boîte mail (ou onglet spam)

### 1.3 Magic link — retour

- [ ] Clic sur le lien dans l'email → arrivé sur `/` (dashboard)
- [ ] **Navbar visible** : Trophy + "Midi Master" en or + ton pseudo à droite
- [ ] Pseudo = préfixe avant @ de ton email + tiret + 4 caractères (ex: `fwlf0725-a3c1`)

### 1.4 Profil auto-créé

- [ ] Supabase → Table Editor → `profiles` → ta ligne existe, `role = 'user'`, `xp = 0`, `niveau = 1`

### 1.5 Déconnexion / reconnexion

- [ ] Clic bouton "Déconnexion" (icône LogOut) → retour à `/login`
- [ ] Retour sur `/` → redirigé vers `/login` (session coupée)
- [ ] Nouvelle magic link → reconnexion → retour sur `/` sans nouveau profil créé (même pseudo)

---

## 2. Phase 2 — Design system Reichmann

### 2.1 Dashboard (home page)

- [ ] http://localhost:3000/ → grande tuile or "Lancer le parcours"
- [ ] 4 tuiles en grille : Quizz 1/2, Étoile Mystérieuse, Face-à-Face, Coup de Maître
- [ ] Tuile "Mode Révision" en bas (icône Brain verte)
- [ ] Survol : scale 1.02, glow coloré (or sur les 4 tuiles sauf Face-à-Face qui doit être rouge)
- [ ] **Aucun emoji** visible dans l'UI

### 2.2 Navbar

- [ ] Sticky en haut, fond bleu nuit + backdrop blur
- [ ] Liens Jouer / Révision / Stats cliquables (mènent à des pages 404 pour l'instant — normal)
- [ ] **Pas de lien Admin** (car `role = 'user'`)
- [ ] Pseudo visible à droite (sauf en mobile où il disparaît < 640px)

### 2.3 /demo — playground

Va sur http://localhost:3000/demo.

- [ ] Titre "Design system playground" en or
- [ ] Section **Buttons** — clique chaque variante :
  - [ ] gold : fond or, texte bleu, effet 3D (enfoncement + glow au hover)
  - [ ] buzz : rouge, même 3D
  - [ ] ghost-gold : outline or transparent
  - [ ] default / outline / secondary / ghost / link : shadcn standard
  - [ ] sizes sm / default / lg / icon : tailles correctes
- [ ] Section **Card/Input/Badge/Progress** : rendu propre, pas de texte invisible
- [ ] Section **LifeBar** :
  - [ ] état green → pastille verte gonflée avec glow
  - [ ] state yellow → jaune gonflée, verte dimée
  - [ ] state red → rouge gonflée, les 2 autres dimées
- [ ] Section **Timer** :
  - [ ] Cercle or qui se vide de 10 à 0
  - [ ] À 3 s : passage au rouge + pulse / scale 110
  - [ ] Bouton "Reset (10 s)" : repart à 10
  - [ ] Bouton "Pause / Reprendre" : stoppe et reprend proprement
- [ ] Section **QuestionCard** :
  - [ ] Badge catégorie "Histoire" en or
  - [ ] 3 barres d'or (difficulté 3/5)
  - [ ] Énoncé gros, Montserrat bold
  - [ ] Bouton "Rejouer l'animation" → slide-up + fade
- [ ] Section **AnswerButton** :
  - [ ] idle : bordure blanche, hover = bordure or
  - [ ] correct : vert + glow
  - [ ] wrong : rouge + **shake** 5 secousses
  - [ ] kbd "A" / "B" visible à gauche

### 2.4 Responsive

DevTools → Device Toolbar → iPhone 12 (375 px).

- [ ] Home : les 4 tuiles passent en 2 colonnes, lisibles
- [ ] Navbar : labels Jouer/Révision/Stats cachés (icônes seulement), pseudo caché
- [ ] /demo : sections empilées, scroll horizontal uniquement sur la table de filtres

### 2.5 Fonts

- [ ] Les titres sont en **Montserrat** (gras, angulaire)
- [ ] Le texte courant est en **Inter**
- [ ] DevTools → Network → filtre "font" → deux fichiers `.woff2` chargés (Montserrat + Inter)

---

## 3. Phase 3 — Seed & Admin questions

### 3.1 Seed des 150 questions

- [ ] `npm run seed` dans un terminal
- [ ] Output :
  ```
  Questions lues : 150
    par type : quizz_2=60, quizz_4=40, etoile=20, face_a_face=20, coup_maitre=10
  Insertion (150 questions, lots de 100)…
    150 / 150
  Seed terminé. 150 questions insérées en X.Xs.
  ```
- [ ] Supabase → Table Editor → `questions` → 150 lignes

### 3.2 Passage en admin

- [ ] SQL Editor (remplacer l'email) :
  ```sql
  update public.profiles
  set role = 'admin'
  where id = (select id from auth.users where email = 'admin@vyzor.fr');
  ```
- [ ] Déconnexion / reconnexion dans l'app
- [ ] Navbar → lien rouge **Admin** visible

### 3.3 Liste des questions

- [ ] Clic Admin → `/admin/questions`
- [ ] Titre "Questions · 150 questions en base · page 1 / 8"
- [ ] Tableau avec colonnes Type / Cat. / Diff. / Énoncé / Actions
- [ ] Boutons en haut à droite : Nouvelle / Importer JSON / Exporter

### 3.4 Filtres & recherche

- [ ] Select **Type** = `etoile` → ne reste que les étoiles (20)
- [ ] Select **Catégorie** = Histoire → filtre sur histoire
- [ ] Select **Difficulté** = 3 étoiles → ne garde que difficulté = 3
- [ ] Champ **Recherche** : tape "Normandie" → debounce 300 ms puis filtre (doit montrer la question sur le débarquement)
- [ ] Bouton **Réinitialiser** apparaît quand un filtre est actif → reset complet

### 3.5 Pagination

- [ ] Chevron **Suivante** → page 2 / 8
- [ ] Chevron **Précédente** en page 1 est grisé / désactivé
- [ ] Aller en dernière page → **Suivante** grisé

### 3.6 Nouvelle question

- [ ] Clic **Nouvelle** → formulaire vide, type `quizz_2` par défaut
- [ ] Change type en `quizz_4` → **4 champs de réponse** apparaissent
- [ ] Change type en `etoile` → champs réponses disparaissent, apparaissent : **Bonne réponse**, **Alias**, **Indices**
- [ ] Change type en `face_a_face` → Bonne réponse + Alias, **pas** d'indices
- [ ] Change type en `coup_maitre` → Bonne réponse + Alias + Indices
- [ ] Catégorie → choisir "Histoire" → le select **Sous-catégorie** se remplit (Antiquité, Moyen-Âge, etc.)
- [ ] Slider difficulté : bouger de 1 à 5, label mis à jour
- [ ] Créer une quizz_4 sans cocher aucune "correcte" → message d'erreur "exactement 1 réponse correcte"
- [ ] Remplir une quizz_2 valide + clic "Créer la question" → redirection vers la liste, question présente

### 3.7 Édition

- [ ] Clic sur l'icône crayon d'une question → formulaire pré-rempli
- [ ] Modifier l'énoncé → clic "Mettre à jour" → message vert "Question mise à jour"
- [ ] Retour à la liste → la modif est visible

### 3.8 Suppression

- [ ] Clic poubelle sur une question → dialogue confirm()
- [ ] Annuler → rien ne se passe
- [ ] Confirmer → la question disparaît de la liste, compteur décrémenté

### 3.9 Export JSON

- [ ] Clic **Exporter** → télécharge `midi-master-questions-2026-04-24.json`
- [ ] Ouvrir le fichier : tableau JSON, chaque question contient `category_slug` (pas `category_id`), `reponses`, etc.
- [ ] Longueur du tableau = nombre de questions en base

### 3.10 Import JSON

- [ ] `/admin/questions/import`
- [ ] Dépose ce mini-JSON dans la textarea :
  ```json
  [
    {
      "type": "quizz_2",
      "category_slug": "culture-g",
      "difficulte": 2,
      "enonce": "Test import manuel Midi Master",
      "reponses": [{"text": "Oui", "correct": true}, {"text": "Non", "correct": false}]
    }
  ]
  ```
- [ ] Preview vert : "Prêt à importer : 1 questions · quizz_2 : 1"
- [ ] Dépose un JSON volontairement faux (ex: enlever `reponses`) → preview rouge avec les erreurs zod
- [ ] Remettre le JSON valide → clic "Importer 1 questions" → bandeau vert → redirection vers la liste, question "Test import manuel" visible

### 3.11 Re-import via fichier

- [ ] Retour au bouton Exporter → télécharger à nouveau le JSON complet
- [ ] Import → sélectionne le fichier → preview doit montrer ~150+ questions → **ne PAS cliquer importer** (ça ferait des doublons) : le but est juste de vérifier que le round-trip export → import passe la validation.

### 3.12 Accès admin depuis compte `user`

- [ ] SQL Editor : repasser en user
  ```sql
  update public.profiles set role = 'user' where id = (select id from auth.users where email = 'admin@vyzor.fr');
  ```
- [ ] Déco / reco
- [ ] Lien Admin disparu de la navbar
- [ ] Accès direct http://localhost:3000/admin/questions → redirigé vers `/`
- [ ] http://localhost:3000/api/questions/export → redirigé vers `/` (pas de téléchargement)
- [ ] Repasser en admin pour la suite des phases

---

## 4. Vérifications transverses

### 4.1 Console navigateur

- [ ] DevTools → Console → **zéro erreur rouge** sur toutes les pages testées
- [ ] Pas de warning hydration / React

### 4.2 PWA (basique pour l'instant)

- [ ] DevTools → Application → Manifest → manifest.json chargé, 3 icônes (192/512/maskable) affichées
- [ ] Le Service Worker n'est **pas** actif en dev (c'est voulu, désactivé en NODE_ENV=development)

### 4.3 Types

- [ ] `npm run typecheck` reste vert après tes manipulations

---

## Problèmes fréquents

| Symptôme | Cause probable | Solution |
|---|---|---|
| Magic link → page blanche | Redirect URL manquante dans Supabase | Ajoute `http://localhost:3000/auth/callback` dans Auth → URL Config |
| `Unable to find matching row` au login | Trigger `on_auth_user_created` pas créé | Re-passer `0001_init.sql` |
| Lien Admin pas visible | Pas passé en admin OU pas relogué | SQL UPDATE + déco/reco |
| `npm run seed` : "Variables manquantes" | `.env.local` pas rempli | Recopier depuis `.env.example` |
| `npm run seed` : "Impossible de charger catégories" | `0002_seed.sql` pas passé | Le passer en SQL Editor |
| Accents cassés dans le tableau | Problème d'encodage | Vérifier que les fichiers sont en UTF-8 |
| Import JSON : tout est invalide | Le fichier exporté est déjà au bon format | OK, ne pas importer deux fois (pas de dédupe) |

---

Quand tout est coché, dis "ok phase 4" et j'enchaîne sur le **Jeu 1 — Quizz 1 chance sur 2**.

---

## ANNEXE — Check-list lot 2026-04-25 (rebrand + dark mode + stats + voix TTS)

### A. Rebrand
- [ ] Onglet du navigateur affiche "Les 12 coups de Mahylan"
- [ ] Navbar affiche "Les 12 coups de Mahylan" (plus aucun "Midi Master" visible)
- [ ] Favicon visible dans l'onglet du navigateur
- [ ] PWA installée → icône Mahylan + nom court "Mahylan" sur l'écran d'accueil
- [ ] Page 404 → alt image OK

### B. Bug upload photo
- [ ] /parametres → Profil → upload une photo > 1 MB → succès (compression auto)
- [ ] Avatar visible dans la Navbar et dans /parametres après reload
- [ ] Bouton de fallback (initiale) si pas d'avatar

### C. Auto-pseudo Joueur 1
- [ ] /jouer/douze-coups → setup → champ Joueur 1 pré-rempli avec mon pseudo
- [ ] /jouer/jeu-1 → idem
- [ ] /jouer/jeu-2 → idem
- [ ] /jouer/face-a-face → idem
- [ ] Si pseudo BDD vide → fallback sur partie gauche de l'email (pas "Toi")

### D. Sécurité du compte
- [ ] /parametres → Profil → "Modifier" l'email → mot de passe correct → mail envoyé
- [ ] Mauvais mot de passe → message d'erreur clair
- [ ] Changement de mot de passe : 8 char + 1 chiffre + confirmation
- [ ] Bouton œil pour afficher/masquer

### E. Dark mode
- [ ] /parametres → Apparence → Sombre → tout passe en nuit
- [ ] Pages testées en dark : `/`, `/jouer/douze-coups`, `/revision`, `/stats`, `/parametres`
- [ ] Aucun fond blanc inattendu
- [ ] Texte lisible (contraste)
- [ ] Préférence persistée après refresh

### F. Timing 30 s + bouton Passer (Jeu 1 uniquement)
- [ ] /jouer/jeu-1 → après réponse → bouton "Passer à la suite" gros bouton or
- [ ] Compte à rebours visible "Suite dans X s…" qui décrémente
- [ ] Clic sur le bouton → passe à la suivante immédiatement
- [ ] À 0 s → passe automatiquement
- [ ] /jouer/douze-coups → Jeu 1 → même comportement
- [ ] Autres modes (jeu-2, face-a-face) : timing inchangé

### G. Mode spectateur (12 Coups vs Bots)
- [ ] Lancer une partie 1 humain + 3 bots, perdre un duel
- [ ] Encart rouge "Tu as été éliminé !" en haut
- [ ] Bouton "Recommencer" → relance la partie avec mêmes paramètres
- [ ] Bouton "Continuer à regarder" → encart fermé + bouton flottant en bas à droite
- [ ] Le bouton flottant relance aussi
- [ ] Cas multi-humains : encart sans bouton Recommencer

### H. Voix TTS
- [ ] /parametres → Audio & Voix → section "Voix de lecture" visible
- [ ] Dropdown liste les voix françaises (FR/CA/BE/CH/LU)
- [ ] Sliders Vitesse + Hauteur fonctionnels
- [ ] Bouton "Tester" prononce la phrase de démo avec les paramètres en cours
- [ ] Préférences persistées en BDD (refresh → toujours là)
- [ ] Aucune voix française → message d'aide

### I. Page Stats
- [ ] Carte "Maître de Midi" en haut, % en très grand
- [ ] Date estimée affichée (ou "Continue à t'entraîner")
- [ ] Top 3 catégories à renforcer si applicable
- [ ] Breakdown : Précision / Couverture / Consistance / Face-à-Face
- [ ] 8 KPIs (niveau, précision, série, favoris, temps moyen, etc.)
- [ ] Courbe d'évolution sur 30 jours
- [ ] Barres horizontales par catégorie (couleurs natives BDD)
- [ ] Camembert des modes joués
- [ ] Heatmap d'activité (30 cases plus ou moins dorées)
- [ ] Section badges (vide ou avec badges)

### J. Doublon XP
- [ ] /parametres → Compte → plus de ligne "XP : 600 XP"
- [ ] Niveau / Email / Pseudo / Rôle restent affichés

