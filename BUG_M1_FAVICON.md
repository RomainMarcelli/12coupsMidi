# BUG M1.1 — Favicon Mahylan toujours visible (régression L3.2)

## Symptôme

Après L3.2 (favicon générique forcé pour tous les utilisateurs), le
favicon dans l'onglet du navigateur affichait **toujours le logo
Mahylan**, peu importe le compte connecté. La régénération de
`public/favicon.ico` via `npm run gen-icons` ne changeait rien.

## Cause racine

**Convention File-based Metadata de Next.js App Router.**

Next.js 13+ (App Router) sert automatiquement comme favicon
n'importe quel fichier nommé `icon.{ico,png,svg,jpg,jpeg}`,
`favicon.ico`, `apple-icon.{png,jpg,jpeg}` ou `apple-touch-icon.*`
placé directement dans le dossier `app/`. Cette convention prend
**priorité absolue** sur :

- les fichiers du même nom dans `public/`
- les `metadata.icons` déclarés dans `layout.tsx`
- les balises `<link rel="icon">` ajoutées manuellement

Réf. doc officielle :
https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons

Dans notre cas, un fichier obsolète `src/app/favicon.ico` (9 449
octets, daté du 25/04, généré sans doute par un ancien `create-next-app`
ou une regen précédente avec le logo Mahylan) shadowait silencieusement
le `public/favicon.ico` régénéré par `gen-icons.mjs`.

Conséquence : peu importait combien on regénérait `public/favicon.ico`,
le navigateur recevait toujours `src/app/favicon.ico`.

## Fix appliqué

```bash
rm src/app/favicon.ico
```

C'est tout. `metadata.icons` dans
[`src/app/layout.tsx`](src/app/layout.tsx#L40-L48) pointe déjà sur
`/favicon.ico` (= `public/favicon.ico`), qui est bien le générique
généré par `gen-icons.mjs`.

## Vérification

1. `npm run build` — pas d'erreur
2. Le manifest Next.js (`.next/server/app/icon.txt` ou similaire) ne
   référence plus le fichier supprimé
3. Le favicon servi à `GET /favicon.ico` est bien le
   `public/favicon.ico` régénéré (62.6% pixels transparents, logo
   générique)

## Procédure utilisateur post-fix

Le navigateur cache le favicon de manière agressive (souvent au-delà
des règles HTTP cache classiques). Pour forcer la mise à jour :

1. **Fermer COMPLÈTEMENT le navigateur** (toutes les fenêtres, pas
   juste l'onglet)
2. Re-ouvrir → l'onglet doit afficher le bon favicon
3. **Si toujours KO** :
   - DevTools (F12) → onglet **Application**
   - **Storage** (à gauche) → **Clear site data** → cocher tout →
     **Clear**
   - Recharger avec **Ctrl+Shift+R**
4. **Cas extrême** (Chrome qui s'entête) : visiter directement
   `chrome://favicon/http://localhost:3000` puis vider le cache du
   profil

## Pour futur Claude / dev

Avant de modifier les icônes ou favicons :

```bash
# Toujours lister CES DEUX endroits
ls -la src/app/icon* src/app/apple-icon* src/app/favicon*
ls -la public/favicon* public/icon* public/apple-touch*
```

Si un fichier existe dans `src/app/`, **il prend le pas sur tout
le reste**. Soit on le maintient comme source de vérité (et on
oublie `public/`), soit on le supprime pour laisser
`metadata.icons` + `public/` faire le job.

Notre projet utilise la convention `public/` + `metadata.icons` car
on génère les icônes dynamiquement via `npm run gen-icons` à partir
de `public/logos/generic/logo.png`. Donc **aucun fichier
`icon.*`/`favicon.*` ne doit jamais réapparaître dans `src/app/`**.

## Limitation connue

Le favicon est servi AVANT l'authentification (le navigateur le
demande à la première requête HTML). Il est donc **impossible** de
le rendre conditionnel par utilisateur (générique vs Mahylan). Tous
les utilisateurs voient le favicon générique, y compris le owner
Mahylan. Voir les commentaires dans
[`src/app/layout.tsx`](src/app/layout.tsx#L20-L25) et
[`src/lib/branding.ts`](src/lib/branding.ts#L13-L17).
