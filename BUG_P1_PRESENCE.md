# Bug P1 — Présence joueurs unfiable (heartbeat BDD trop lent)

## Symptômes

Sur le mode TV, certains joueurs apparaissaient "En ligne" 30 à 60s
après avoir fermé leur onglet (icône verte qui ne tournait pas au
rouge). Inversement, des joueurs en ligne pouvaient passer brièvement
"Hors ligne" en cas de coupure réseau de 15s, alors qu'ils étaient
toujours sur la page.

## Cause racine

Le mécanisme de présence reposait sur un booléen `tv_room_players.is_connected`
mis à jour côté téléphone via :

1. Heartbeat toutes les 12s : UPDATE `is_connected = true, last_seen_at = now()`
2. Au `beforeunload` : UPDATE `is_connected = false`

Problèmes :

- Le `beforeunload` n'est PAS fiable sur mobile (iOS Safari ne le
  déclenche jamais quand l'utilisateur ferme l'onglet, swipe l'app, ou
  passe en arrière-plan). Conséquence : un téléphone "fantôme" peut
  rester `is_connected = true` indéfiniment.
- L'intervalle de 12s pour le heartbeat crée une zone aveugle : un
  joueur déconnecté il y a 11s est encore considéré "online".
- La requête UPDATE BDD coûte 1 round-trip Supabase à chaque tick → on
  consomme inutilement du quota Postgres pour ce qui devrait être un
  signal léger.

## Fix (P1.1)

Migration vers **Supabase Realtime Presence** comme source de vérité :

- Le téléphone appelle `channel.track({ token, pseudo, avatarUrl, role })`
  au mount. Supabase envoie automatiquement un heartbeat WebSocket
  natif (timeout ~15s).
- Quand le socket se déconnecte (close de l'onglet, perte réseau, mise
  en arrière-plan iOS), Supabase émet un event `leave` après ~15s.
- La TV s'abonne à `channel.on("presence", ...)` et croise le set des
  tokens présents avec sa liste BDD pour calculer `isConnected`.

### Avantages

- Détection de déconnexion < 30s même si `beforeunload` ne tire pas.
- Aucune requête BDD pour le heartbeat — uniquement WebSocket.
- Reconnexion auto : si le réseau revient, le socket se reconnecte et
  Presence émet un `join` immédiat.

### Pourquoi on garde `tv_room_players.is_connected`

- Cache rétro-compatibilité (anciens clients qui n'ont pas encore le
  patch P1).
- Audit/historique : peut être utile pour debug post-mortem ("ce
  joueur était noté connecté à telle heure mais on n'a pas son score").
- Les fonctions `sendHeartbeat` et `markDisconnected` deviennent des
  no-op pour ne pas casser les anciens callers.

## Fichiers modifiés

- `src/lib/realtime/tv-channel.ts` — ajout API `trackPresence` /
  `untrackPresence` / `onPresence` / `presenceState`.
- `src/lib/realtime/player-actions.ts` — heartbeat/markDisconnected
  → no-op + nouveau `updatePlayerProfile`.
- `src/app/play/[code]/light/play-light-client.tsx` — track presence
  au mount, plus d'interval 12s.
- `src/app/(app)/tv/host/[code]/tv-host-room.tsx` — utilise
  `playersWithPresence` (BDD ∩ Presence) au lieu de `is_connected`.

## Régression à surveiller

- Le timer Supabase Realtime de "leave" est ~15s. Si on veut < 5s, il
  faudrait coupler avec un Visibility API listener (`visibilitychange`)
  qui appelle explicitement `untrack()` au passage en arrière-plan.
  Pour le MVP, 15s est acceptable.
- Si Supabase Realtime tombe (incident infra), tous les joueurs
  passent "Hors ligne" simultanément. Fallback : laisser le statut
  basé sur `tv_room_players.is_connected` BDD si presenceTokens est
  vide ET la liste BDD non vide (à implémenter si on observe ce
  scénario en prod).
