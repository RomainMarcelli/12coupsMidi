# Midi Master — Journal des décisions

Ce fichier liste les décisions techniques qui **s'écartent** du cahier des charges
[MIDI_MASTER_PROJET.md](./MIDI_MASTER_PROJET.md), ou qui méritent d'être tracées
(choix non triviaux). Une entrée par décision, datée.

Format :
> **[DATE] — Titre**
> - **Contexte** : ce qui a motivé le choix.
> - **Décision** : ce qu'on a tranché.
> - **Conséquence** : ce que ça change pour la suite.

---

## 2026-04-23 — Next.js 16 au lieu de Next.js 15

- **Contexte** : Le cahier des charges impose Next.js 15. `create-next-app@latest` installe Next 16.2.4 en avril 2026. Un `AGENTS.md` auto-généré à la racine du projet précise explicitement que Next 16 contient des breaking changes par rapport à Next 15.
- **Décision** : On reste sur Next 16. Adaptation au fil de l'eau en lisant les guides embarqués dans `node_modules/next/dist/docs/`.
- **Conséquences** :
  - **Middleware → Proxy** : en Next 16, le middleware est renommé en "Proxy". Le fichier attendu est `src/proxy.ts` (ou `proxy.ts` à la racine), plus `src/middleware.ts`. Impacte la Phase 1 (Supabase auth middleware) : on créera `proxy.ts` au lieu de `middleware.ts`.
  - React 19.2 est embarqué (App Router n'utilise plus strictement la version du `package.json`).
  - À chaque phase, vérifier dans les docs embarquées si l'API visée a changé avant d'écrire du code.

## 2026-04-23 — Serwist au lieu de next-pwa

- **Contexte** : Le cahier des charges dit "next-pwa (ou Serwist)". `next-pwa` n'est plus maintenu activement et a des incompatibilités connues avec Next 15+ (Turbopack, app router avancé).
- **Décision** : Serwist d'emblée.
- **Conséquences** :
  - Service worker écrit en TypeScript dans `src/app/sw.ts` (convention Serwist).
  - Désactivé en dev (`disable: NODE_ENV === 'development'`) pour éviter les caches parasites.
  - Le SW est généré dans `public/sw.js` à chaque build → ajouté au `.gitignore`.

## 2026-04-23 — Tailwind v4 (et pas de `tailwind.config.ts`)

- **Contexte** : Le cahier des charges mentionne `tailwind.config.ts` dans l'arborescence, mais impose aussi Tailwind v4 en Phase 2. Tailwind v4 pilote la config via `@theme` dans `globals.css` et se passe généralement de `tailwind.config.ts`.
- **Décision** : Pas de `tailwind.config.ts`. Thème "Reichmann" défini en Phase 2 directement dans `src/app/globals.css` via `@theme`.
- **Conséquences** :
  - L'arborescence de la Phase 3 (du cahier des charges) ne contient donc pas `tailwind.config.ts` — on documente l'absence ici.
  - Si un plugin Tailwind a besoin de JS, on rebasculera vers un `tailwind.config.ts` à ce moment-là.

## 2026-04-23 — TypeScript strict renforcé

- **Contexte** : Le cahier des charges demande "TypeScript strict, pas de `any` non justifié". `strict: true` seul est déjà bien, mais on peut mieux.
- **Décision** : Ajout de `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`. `target` remonté de ES2017 à ES2022.
- **Conséquences** :
  - Les accès à des index (`array[0]`, `map["key"]`) retournent `T | undefined` : il faudra narrower avant usage. Impact sur la game logic et le parsing JSON.
  - Gain en sûreté : bugs off-by-one et clés typo détectés au compile.

## 2026-04-23 — shadcn/ui preset "base-nova"

- **Contexte** : `npx shadcn init --defaults` applique désormais le preset `base-nova` (nouveau style canonique) avec base color `neutral`.
- **Décision** : On garde `base-nova`, on change `baseColor` de `neutral` → `slate` pour coller à la spec.
- **Conséquences** :
  - Aucune, la Phase 2 réécrira de toute façon les variables CSS pour le thème Reichmann.

## 2026-04-23 — Webpack forcé (Turbopack désactivé)

- **Contexte** : Next 16 active Turbopack par défaut. Serwist n'est pas encore compatible Turbopack (cf. issue [serwist/serwist#54](https://github.com/serwist/serwist/issues/54)). Sans action, `next build` échoue avec `WorkerError: Call retries were exceeded`.
- **Décision** : Scripts `dev` et `build` passent explicitement `--webpack`. Turbopack pourra être réactivé quand `@serwist/turbopack` sortira du stade expérimental ou quand Serwist aura une intégration native.
- **Conséquences** :
  - Build un peu plus lent qu'avec Turbopack (~60s en froid au lieu de ~20s attendus).
  - À revoir en Phase 11 (Polish).

## 2026-04-23 — `sharp` installé dès la Phase 0

- **Contexte** : Le cahier des charges prévoit `sharp` pour la Phase 11 (icônes PWA finales). On en a besoin maintenant pour générer les placeholders 192/512/maskable.
- **Décision** : `sharp` ajouté en devDependency dès la Phase 0, avec un script `src/scripts/gen-icons.mjs` réutilisable.
- **Conséquences** :
  - En Phase 11, il suffira d'éditer le SVG dans le script pour régénérer les icônes finales.
