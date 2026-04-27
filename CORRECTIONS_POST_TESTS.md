# Corrections post-tests utilisateur — récap

> 9 corrections livrées en 4 vagues. **Aucune migration BDD requise.**
> Validation finale : `typecheck` clean · **276/276 tests passants** · `build` OK.

---

## Vague A — Quick fixes critiques

### A.1 — Bug "L'autre" affiché comme bonne réponse

**Fichiers** :
- [`src/lib/game-logic/answer-display.ts`](src/lib/game-logic/answer-display.ts) : helpers `isGenericChoiceLabel`, `guessLabelFromExplanation`, `resolveCorrectAnswerLabel`.
- [`src/lib/game-logic/answer-display.test.ts`](src/lib/game-logic/answer-display.test.ts) : 15 tests unitaires.
- [`src/app/(app)/jouer/douze-coups/douze-coups-client.tsx`](src/app/(app)/jouer/douze-coups/douze-coups-client.tsx) : `WrongFeedback` utilise `resolveCorrectAnswerLabel`.
- [`src/app/(app)/revision/_components/QuizPlayer.tsx`](src/app/(app)/revision/_components/QuizPlayer.tsx) : idem.

**Stratégie** (option A validée) : si `reponses[correctIdx].text` est un placeholder générique (`L'un`, `L'autre`, `Vrai`, `Faux`, `Plus`, `Moins`, `Oui`, `Non`, `A`, `B`), on **extrait** le vrai libellé depuis le début de l'explication en coupant sur la première ponctuation forte ou auxiliaire (`,`, `(`, `:`, `est`, `a été`, `a`, `depuis`, `en`, …). Cap à 60 chars avec ellipse.

**Résultat sur l'exemple Frank Gehry** :
- Avant : "Mauvaise réponse · La bonne réponse était : L'autre · L'architecte canado-américain Frank Gehry a conçu…"
- Après : "Mauvaise réponse · La bonne réponse était : **L'architecte canado-américain Frank Gehry** · L'architecte canado-américain Frank Gehry a conçu…"

Si l'explication est absente ou trop courte, fallback : ligne masquée et explication seule en gras.

### A.4 — Timer retiré du DuelPanel

**Fichier** : [`src/components/game/DuelPanel.tsx`](src/components/game/DuelPanel.tsx)

Suppression du composant `<Timer>` + de `handleTimerEnd` + de l'import `DUEL_TIMER_SECONDS`. Le duel est désormais sans pression de chrono. Le joueur réfléchit tranquillement.

### A.7 — Touche Entrée pour passer à la suivante

**Fichier** : [`src/app/(app)/revision/_components/QuizPlayer.tsx`](src/app/(app)/revision/_components/QuizPlayer.tsx)

`useEffect` keydown global qui écoute `Enter` quand le feedback est affiché. Si focus sur `INPUT`/`TEXTAREA` (saisie en cours), on n'intercepte pas — Entrée garde son rôle natif.

S'applique au **Marathon libre** et à tous les modes Révision avec saisie texte.

### A.10 — Modal d'aide installation voix françaises

**Fichier** : [`src/components/parametres/VoiceInstallHelp.tsx`](src/components/parametres/VoiceInstallHelp.tsx) (nouveau).

Branchement dans le `VoiceSelector` ([parametres-client.tsx](src/app/(app)/parametres/parametres-client.tsx)) :
- **Mode discret** par défaut : lien "Comment installer plus de voix ?" sous le dropdown.
- **Mode proactif** (encart doré accentué) si ≤ 2 voix françaises détectées.

La modal contient les étapes pour Windows / macOS / Android, plus une astuce Chromium.

---

## Vague B — Fixes structurels

### B.2 — Modifier/Supprimer joueurs (refonte modals)

**Fichiers** :
- [`src/components/ui/Modal.tsx`](src/components/ui/Modal.tsx) (nouveau) : composant réutilisable basique.
- [`src/app/(app)/parametres/joueurs/joueurs-client.tsx`](src/app/(app)/parametres/joueurs/joueurs-client.tsx) : refonte complète.

**Changements** :
- Édition inline → **modal d'édition** propre avec photo + pseudo + boutons Annuler/Enregistrer.
- `window.confirm` (parfois bloqué) → **modal de confirmation** dédiée avec bouton Supprimer en rouge.
- **Try/catch** + bandeau d'erreur visible si Supabase échoue (RLS, etc.).
- **Recherche** par pseudo + **tri** (Plus récents / Plus joués / Plus victorieux).
- **Stat globale** en haut : "X joueurs · Y parties au total".

### B.3 — Slot 0 déverrouillé (édition éphémère pseudo + photo)

**Fichiers** :
- [`src/app/(app)/jouer/douze-coups/page.tsx`](src/app/(app)/jouer/douze-coups/page.tsx) : SELECT `pseudo, avatar_url` au lieu de `pseudo` seul.
- [`src/app/(app)/jouer/douze-coups/douze-coups-client.tsx`](src/app/(app)/jouer/douze-coups/douze-coups-client.tsx) : transmission `userAvatarUrl` au setup.
- [`src/app/(app)/jouer/douze-coups/setup-screen.tsx`](src/app/(app)/jouer/douze-coups/setup-screen.tsx) : retrait des `disabled={i === 0}` / `readOnly`. Slot 0 pré-rempli depuis le profil mais éditable.

**Comportement** :
- Pseudo + photo modifiables sur le slot 0 dans le setup.
- Modification **éphémère** : ne touche PAS `profiles.pseudo` ni `profiles.avatar_url`.
- Le profil du compte reste géré dans Paramètres → Profil (source de vérité unique).

Pas de migration BDD : on réutilise `profiles.pseudo` + `profiles.avatar_url` partout (option 2 validée).

---

## Vague C — Centralisation TTS

### C.5 — Hook `useAutoPlayTTS` unique

**Fichiers** :
- [`src/lib/tts-helpers.ts`](src/lib/tts-helpers.ts) (nouveau) : helpers + hook.
- [`src/lib/tts-helpers.test.ts`](src/lib/tts-helpers.test.ts) : 11 tests unitaires.

**API** :
- `buildTTSText({ enonce, choices, explanation })` : assemble le texte avec `,` entre choix sauf le dernier qui prend un `ou`. Pour 2 choix : juste `ou`.
- `buildTTSFeedbackText({ isCorrect, correctLabel, explanation })` : "Bonne/Mauvaise réponse. La bonne réponse était X. Explication."
- `useAutoPlayTTS({ enonce, choices, feedbackText, enabled? })` : hook qui :
  1. Lit énoncé + choix au mount, **dédup** par `enonce` (pas de relecture si la question reste affichée).
  2. Lit le feedback dès que `feedbackText` apparaît.
  3. **Stoppe** la lecture en cours si `feedbackText` repasse à null (passage à la question suivante → pas de chevauchement).
  4. Désactivé si `ttsAutoPlay` setting = false ou prop `enabled = false`.

**Branché dans** :
- [`DcJeu1Stage`](src/app/(app)/jouer/douze-coups/douze-coups-client.tsx) : énoncé + 2 choix + feedback (avec label intelligent via `resolveCorrectAnswerLabel`).
- [`DcDuelStage`/`DuelPanel`](src/components/game/DuelPanel.tsx) : énoncé + 4 choix + feedback. **Lit pendant le duel** (Bug #5 résolu) + ajout d'un `SpeakerButton` pour le clic manuel.
- [`DcJeu2Stage`](src/app/(app)/jouer/douze-coups/douze-coups-client.tsx) : énoncé "Trouve l'intrus" + 7 propositions séparées par virgules + `ou` final.
- [`DcFaceAFaceStage`](src/app/(app)/jouer/douze-coups/douze-coups-client.tsx) : énoncé seul (réponse libre).
- [`QuizPlayer`](src/app/(app)/revision/_components/QuizPlayer.tsx) : énoncé + choix (si quizz_2/4) + feedback complet — c'est le mode où la lecture du feedback est la plus utile.

**Sur tous ces écrans** : `SpeakerButton` reste affiché pour le clic manuel mais avec `autoPlay={false}` (le hook prend la main, pas de double lecture).

---

## Vague D — Polish UX

### D.9 — Polish UI

**a) Croix de retrait photo** ([setup-screen.tsx](src/app/(app)/jouer/douze-coups/setup-screen.tsx) `PlayerAvatarSlot`) :
- Visible **au hover uniquement** (overflow visible, cercle blanc d'isolement, légèrement décalée hors photo).
- Sur tactile, le hover persiste après un tap initial → reste utilisable au doigt.
- `e.stopPropagation()` pour ne pas re-déclencher le picker.

**b) `BackButton` réutilisable** ([`src/components/ui/BackButton.tsx`](src/components/ui/BackButton.tsx) nouveau) :
- Icône `ChevronLeft` Lucide + label personnalisable.
- Style ghost or : transparent au repos, fond doré subtil + glow + scale au hover.
- Branché dans [`/parametres/joueurs`](src/app/(app)/parametres/joueurs/joueurs-client.tsx).

**c) Autosuggestion shadcn-style** ([setup-screen.tsx](src/app/(app)/jouer/douze-coups/setup-screen.tsx) `PseudoAutocomplete`) :
- Animation Framer Motion (fade + slide-down).
- Coins arrondis `rounded-xl` + `shadow-lg`.
- Header "Joueurs déjà utilisés" en petit titre gris.
- Avatar 40×40 circulaire + pseudo gras + stats `🎮 X · 🏆 Y` à droite.
- **Navigation clavier** : ↑↓ pour highlighter, Entrée pour sélectionner.
- **Échap** ou clic extérieur ferme.
- **Si > 5 résultats** : lien "Voir tous mes joueurs" → `/parametres/joueurs`.
- Limite affichage : 5 suggestions max.

### D.8 — Sauvegarde joueurs opt-in + popup "Mes joueurs"

**a) Toggle "Enregistrer ce joueur"** ([setup-screen.tsx](src/app/(app)/jouer/douze-coups/setup-screen.tsx)) :
- Checkbox `💾 Enregistrer ce joueur` sur chaque slot humain ≥ 1 (visible quand pseudo non vide).
- **Décoché par défaut** (opt-in). Stocké dans `LocalPlayer.saveToBdd` puis remonté dans `DcSetupResult`.
- Le client [`DouzeCoupsClient`](src/app/(app)/jouer/douze-coups/douze-coups-client.tsx) ne sauvegarde plus que les joueurs explicitement cochés (au lieu de tout sauver auto).
- `recordGamePlayed` à la fin de partie ne crée pas de ligne — il met à jour `games_played`/`games_won` UNIQUEMENT si l'enregistrement existe déjà → comportement cohérent automatique.

**b) Bouton "Mes joueurs" + modal** ([setup-screen.tsx](src/app/(app)/jouer/douze-coups/setup-screen.tsx) `MyPlayersModal`) :
- Bouton en haut du setup (visible uniquement en mode humains_local + si saved_players ≥ 1).
- Modal liste des saved_players sous forme de cards (avatar + pseudo + stats).
- Clic sur une card → ajoute le joueur au **prochain slot humain vide** + pré-coche `Enregistrer` (pour bumper ses stats à la fin).
- Cards "déjà ajoutées" sont grisées et non cliquables.

**c) Tri/recherche dans `/parametres/joueurs`** : déjà inclus dans la refonte B.2 (champ recherche + select de tri Plus récents / Plus joués / Plus victorieux + stat globale).

### D.6 — Polish overlays jaune/rouge

**Sirène synthétique** ([`src/lib/sounds.ts`](src/lib/sounds.ts)) :
- 2 nouveaux sons générés via Web Audio API :
  - `yellow-warn` : bip bi-tons "ding-dong" 660→880 Hz triangle (style avertissement métro).
  - `red-alert` : sirène 2 tons descendante 880→440 Hz sawtooth, **2 cycles**, ~1.4 s (style alerte police).

**Overlay enrichi** ([`src/components/game/ColorTransitionOverlay.tsx`](src/components/game/ColorTransitionOverlay.tsx)) :

| Élément | Jaune | Rouge |
|---|---|---|
| **Particules** | 12 confettis qui pleuvent depuis le haut, rotation | 18 particules qui jaillissent du centre en éventail radial |
| **Strobe bords** | — | 5 flashs (top + bottom) |
| **Sirènes rotatives** | — | 4 dans les coins (rotation 360°, faisceau lumineux, pulse) |
| **Bordure pulsante** | Bordure navy, 3 pulses | Bordure cream, 3 pulses |
| **Shake écran** | 1 secousse légère | 3 secousses marquées |
| **Icône** | `AlertTriangle` qui scale+rotate (1.2× boucle 1×) | `Siren` qui scale+rotate (1.15× boucle 1×) |
| **Glow texte** | drop-shadow navy léger | drop-shadow cream intense `0_4px_16px_rgba(0,0,0,0.6)` |
| **Son** | `yellow-warn` (joué au mount) | `red-alert` (joué au mount) |

`prefers-reduced-motion` respecté : désactive particules / strobe / sirènes / shake, mais conserve le son (court, peu intrusif).

---

## Tests à passer

### Bugs critiques

- [ ] **A.1** Mode normal vs humains : reponds faux à une question Vrai/Faux ou L'un/L'autre → l'encart rouge affiche le **vrai libellé** de la bonne réponse (pas "L'autre").
- [ ] **A.1** Mode révision : même test sur une question quizz_2 format "ou".
- [ ] **A.4** Quand un joueur passe au rouge, démarre le duel : **plus de timer** affiché. Le joueur peut prendre son temps.
- [ ] **A.7** Marathon libre : tape une réponse, valide → feedback affiché → presse `Entrée` → passage immédiat à la question suivante.
- [ ] **A.10** Paramètres → Audio & Voix → "Comment installer plus de voix ?" → modal s'ouvre avec instructions Win/Mac/Android. Si tu n'as ≤ 2 voix françaises, l'encart proactif doré apparaît.

### Joueurs sauvegardés

- [ ] **B.2** `/parametres/joueurs` : clic crayon → modal édition s'ouvre. Modifie pseudo et/ou photo, "Enregistrer" → la liste se met à jour. En cas d'erreur, bandeau rouge visible.
- [ ] **B.2** `/parametres/joueurs` : clic poubelle → modal de confirmation. "Supprimer" → ligne disparaît immédiatement.
- [ ] **B.2** `/parametres/joueurs` : champ recherche fonctionne, tri (Plus récents / Plus joués / Plus victorieux) trie correctement.
- [ ] **B.3** Setup 12 Coups vs humains local : le slot **Joueur 1** est ÉDITABLE (pseudo + photo). Pré-rempli avec ton compte. Modifier le pseudo ne change PAS Paramètres → Profil.

### TTS (Bug #5)

- [ ] **C.5** Active "Mode TV (lecture auto)" dans Paramètres → Audio. Lance 12 Coups vs bots.
- [ ] **C.5** Jeu 1 : voix lit "[énoncé]. [choix A] ou [choix B]" au démarrage. Reponds faux → la voix lit "Mauvaise réponse. La bonne réponse était [label]. [explication]".
- [ ] **C.5** Tu cliques "Suivant" pendant la lecture du feedback → la lecture s'**arrête immédiatement** (pas de chevauchement).
- [ ] **C.5** Pendant le duel : voix lit "[énoncé]. [A], [B], [C] ou [D]" + feedback (résolution Bug #5 critique).
- [ ] **C.5** Jeu 2 (Coup par Coup) : voix lit "[thème]. Trouve l'intrus. [proposition 1], [...], [...] ou [proposition 7]".
- [ ] **C.5** Mode Révision Marathon libre : énoncé lu + feedback lu après réponse (mauvaise OU bonne).

### Polish UX

- [ ] **D.9.a** Setup, slot avec photo : passe la souris dessus → croix rouge apparaît au coin (cercle blanc isolé), pas de chevauchement disgracieux.
- [ ] **D.9.b** `/parametres/joueurs` : bouton retour en haut à gauche est un `ChevronLeft` + label "Paramètres", style ghost or (hover doré).
- [ ] **D.9.c** Setup, slot 2+ : tape les premières lettres d'un pseudo connu → dropdown moderne avec animation, hover surligné, ↑↓ Entrée fonctionnent, Échap ferme.
- [ ] **D.8.a** Setup vs humains : checkbox "💾 Enregistrer ce joueur" décochée par défaut. Si tu ne coches pas, le joueur n'apparaît PAS dans `/parametres/joueurs` après la partie.
- [ ] **D.8.b** Setup vs humains (avec ≥ 1 saved_player) : bouton "Mes joueurs" en haut à droite → modal avec cards. Clic sur une card → joueur ajouté au prochain slot vide.
- [ ] **D.6** Premier passage au jaune : overlay plein écran ~2s avec pluie de confettis navy, halo, son bi-tons.
- [ ] **D.6** Passage au rouge : overlay plein écran ~2s avec sirènes rotatives dans les 4 coins, particules qui jaillissent du centre, 5 flashs strobe, secousses marquées, son sirène 2 cycles.
- [ ] **D.6** Active prefers-reduced-motion dans l'OS : overlays simplifiés (~500 ms, pas de particules/strobe/shake). Le son reste joué.

---

## Fichiers créés ou modifiés

**Nouveaux** :
- `src/lib/game-logic/answer-display.ts` + `.test.ts` (15 tests)
- `src/lib/tts-helpers.ts` + `.test.ts` (11 tests)
- `src/components/ui/Modal.tsx`
- `src/components/ui/BackButton.tsx`
- `src/components/parametres/VoiceInstallHelp.tsx`

**Modifiés** :
- `src/components/game/SpeakerButton.tsx` (déjà existant, pas modifié ce lot)
- `src/components/game/ColorTransitionOverlay.tsx` (refonte enrichie)
- `src/components/game/DuelPanel.tsx` (Timer retiré + SpeakerButton ajouté + hook TTS)
- `src/lib/sounds.ts` (+ 2 sons : yellow-warn, red-alert)
- `src/app/(app)/jouer/douze-coups/page.tsx` (récupère `avatar_url`)
- `src/app/(app)/jouer/douze-coups/douze-coups-client.tsx` (sauvegarde opt-in + branchement TTS hook)
- `src/app/(app)/jouer/douze-coups/setup-screen.tsx` (slot 0 éditable + autosuggestion + toggle save + modal "Mes joueurs")
- `src/app/(app)/jouer/jeu-1/coup-d-envoi-client.tsx` (SpeakerButton choices)
- `src/app/(app)/parametres/parametres-client.tsx` (VoiceInstallHelp branché)
- `src/app/(app)/parametres/joueurs/joueurs-client.tsx` (refonte modals + recherche + tri)
- `src/app/(app)/revision/_components/QuizPlayer.tsx` (Entrée pour suivant + hook TTS + label intelligent)

**Aucune migration BDD nécessaire pour ce lot.**

---

## Prochaines étapes possibles (non incluses)

- Re-seed des questions `quizz_12_coups_de_midi (1).json` pour remplacer `text: "L'autre"` par les vrais libellés (le champ `autre_reponse` existe déjà dans le JSON source). Ça rendrait le helper `resolveCorrectAnswerLabel` superflu pour ces questions, mais le helper continue de couvrir les Vrai/Faux/Plus/Moins génériques.
- Pseudo de jeu séparé (`profiles.game_pseudo`) si tu veux dissocier identité Supabase et identité de jeu.
- Polish sons : remplacer les sons synthétiques par de vrais .mp3 si tu en trouves de qualité.
