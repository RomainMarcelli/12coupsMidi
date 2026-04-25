# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Les versions sont datées (pas de SemVer encore — V1 publique pas sortie).

## [Unreleased] — 2026-04-25

### Rebrand
- Application renommée **Les 12 coups de Mahylan** (slug technique : `mahylan`).
- `package.json` `name: "les-12-coups-de-mahylan"`.
- `manifest.json`, balises HTML, Navbar, page 404, notification daily, scripts seed/export.
- README mis à jour ; `MIDI_MASTER_PROJET.md` conservé comme historique.

### Ajouts
- **Favicon & icônes PWA** : `favicon.ico` multi-résolution (16/32/48 PNG-inside-ICO), `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`. Génération depuis `public/logo.png` via `npm run gen-icons` (script réécrit, encodeur ICO maison).
- **Auto-remplissage pseudo Joueur 1** : tous les setups multijoueur (12 Coups, Coup d'Envoi, Coup par Coup, Face-à-Face) pré-remplissent le champ avec `profiles.pseudo` (fallback : partie locale de l'email puis "Joueur"). Helper `resolveUserPseudo` dans [user-display.ts](src/lib/user-display.ts).
- **30 s + bouton "Passer à la suite"** entre les questions du Jeu 1 (mode standalone `/jouer/jeu-1` ET sous-jeu Jeu 1 du parcours `/jouer/douze-coups`). Composant [FeedbackCountdown.tsx](src/components/game/FeedbackCountdown.tsx) (tap target 48 px, countdown live, barre de progression).
- **Mode spectateur** dans le parcours **12 Coups** : encart "Tu as été éliminé !" avec actions "Recommencer" (rematch avec mêmes paramètres) ou "Continuer à regarder" (bouton flottant disponible ensuite). Désactive le bouton Recommencer si d'autres humains sont en jeu. Composants [SpectatorBanner.tsx](src/components/game/SpectatorBanner.tsx).
- **Sélecteur voix TTS** dans Paramètres → Audio & Voix : dropdown des voix françaises (filtrage `lang.startsWith("fr")`, étiquetage par pays), sliders vitesse / hauteur, bouton **Tester** qui prononce une phrase de démonstration. Helpers `loadVoices()` (avec gestion `voiceschanged` Chrome), `frenchVoices()` dans [tts.ts](src/lib/tts.ts).
- **Sécurité du compte** dans Paramètres → Profil : changement d'email (re-auth via mot de passe actuel + mail de confirmation Supabase) et changement de mot de passe (ré-auth + validation 8 char + 1 chiffre + confirmation). Tout côté client via `supabase.auth.updateUser`.
- **Refonte page Stats** :
  - Carte spéciale **Tableau de bord Maître de Midi** : score 0-100 composite, date estimée pour atteindre 100 %, top 3 catégories à renforcer, breakdown détaillé par dimension (précision / couverture / consistance / face-à-face).
  - 4 graphiques Recharts : courbe d'évolution sur 30 jours, barres horizontales par catégorie (couleurs natives BDD), camembert par mode joué, heatmap d'activité (30 cases).
  - 8 KPIs (niveau, précision, série actuelle/record, favoris, temps moyen, meilleur Face-à-Face, cagnotte 12 coups totale, score Maître).
  - Section badges visibles (depuis tables `badges` / `user_badges`).
  - Algo pur testé : [maitre-de-midi.ts](src/lib/stats/maitre-de-midi.ts) + [maitre-de-midi.test.ts](src/lib/stats/maitre-de-midi.test.ts) (13 tests).

### Corrigés
- **Bug upload photo "Body exceeded 1 MB limit"** : l'upload se fait désormais 100 % côté navigateur (compression `<canvas>` 512×512 WebP qualité 0.85 + `supabase.storage.from('avatars').upload()`), évitant la limite 1 MB des Server Actions Next.js. Le profil est ensuite mis à jour via `saveProfile({ avatarUrl })` (payload < 1 KB). Helper [avatar-upload.ts](src/lib/avatar-upload.ts).
- **Doublon "XP 600 XP"** dans le tab Compte de `/parametres` : retiré (l'XP est visible sur `/stats` avec contexte).

### Modifiés
- **Mode sombre — refonte complète** ([globals.css](src/app/globals.css)) :
  - Nouvelle palette : `#0A0E27` (background), `#141A3A` (card), `#1F2752` (popover), `#2A3563` (border), `#F1FAEE` (text), `#A8B2D1` (muted), `#F5C518` (gold), `#FF6B6B` (buzz), `#51CF66` (life-green).
  - Surcharges des couleurs sémantiques (`--color-navy`, `--color-cream`, etc.) en `.dark` pour que les utilitaires Tailwind existants s'adaptent automatiquement.
  - Override CSS pour `.bg-white` (devient `var(--card)` en dark) et atténuation des dégradés `from-gold-pale via-cream to-sky-pale`.
  - Ombres adoucies en dark : `.glow-card` / `.glow-sun` / `.glow-gold` neutralisés/adaptés.
  - `theme-color` du viewport dépend désormais du `prefers-color-scheme`.
- **Reconnaissance vocale** plus rapide ([VoiceInput.tsx](src/components/game/VoiceInput.tsx) + [speech-recognition.ts](src/lib/voice/speech-recognition.ts)) : auto-submit après 800 ms de silence, gros bouton vert "Valider maintenant" pendant l'écoute.
- **TTS auto-play (Mode TV)** : le `SpeakerButton` lit automatiquement chaque énoncé si l'option globale `ttsAutoPlay` est activée (toggle dans Paramètres → Audio).

### Migrations BDD
Aucune nouvelle migration nécessaire pour ce lot. Les préférences voix TTS (`ttsVoiceUri`, `ttsRate`, `ttsPitch`) sont stockées dans la colonne JSONB existante `profiles.settings` (créée en migration `0005_profile_settings_and_favorites.sql`).

### Notes & limites
- Le **mode spectateur** est branché uniquement sur le parcours **12 Coups** ; les modes standalone (`/jouer/jeu-1`, `/jeu-2`, `/face-a-face`) terminent dès l'élimination du user humain donc l'analogie ne s'applique pas (rien à observer).
- Les **notifications PWA** restent locales (pas de push backend) — fonctionnent quand l'app est ouverte/installée.
- L'algo **Maître de Midi** estime les jours sur base de la pente des 14 derniers jours d'historique de score moyen ; cap à 365 jours, retourne `null` si pente ≤ 0 ou historique trop court.
- Le streak quotidien est calculé sur `game_sessions.created_at` (≥ 1 partie par jour suffit).

### Tests
- 12 fichiers de tests, **228 tests** au total (+13 sur le score Maître de Midi).
- `npm run typecheck` clean, `npm run build` génère 21 routes.
