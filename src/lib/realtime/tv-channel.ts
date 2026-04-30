"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { RoomEventName, RoomEvents } from "./room-events";

/**
 * Wrapper typé autour de `supabase.channel('room:{code}')` pour les events
 * du Mode TV Soirée. Encapsule subscribe / send / cleanup + Presence (P1.1).
 *
 * Channel naming : `room:{code}` (4 chiffres). Une seule connexion par
 * onglet — les composants React doivent appeler `unsubscribe()` au unmount.
 *
 * **Presence (P1.1)** : la source de vérité "qui est en ligne" est Supabase
 * Realtime Presence (heartbeat WebSocket natif, ~15s timeout). On garde
 * `tv_room_players.is_connected` comme cache best-effort en BDD, mais
 * l'UI live (lobby, sidebar des joueurs) doit utiliser `presenceState()`.
 */

export interface PresencePlayerMeta {
  /** player_token UUID (clé d'identification stable). */
  token: string;
  /** Pseudo (peut changer si édité dans le lobby). */
  pseudo: string;
  /** URL avatar (peut changer si édité dans le lobby). */
  avatarUrl: string | null;
  /** Timestamp ms du track() initial — utile pour ordonnancer les arrivées. */
  joinedAt: number;
  /** Rôle dans la room. "host" = TV, "player" = téléphone. */
  role: "host" | "player";
}

export type PresenceListener = (state: Record<string, PresencePlayerMeta[]>) => void;

export interface TvChannelHandle {
  channel: RealtimeChannel;
  send: <K extends RoomEventName>(event: K, payload: RoomEvents[K]) => void;
  on: <K extends RoomEventName>(
    event: K,
    handler: (payload: RoomEvents[K]) => void,
  ) => void;
  /**
   * Track ce client dans la presence du channel. À appeler une fois après
   * mount (ou sur changement de pseudo/avatar pour broadcast).
   */
  trackPresence: (meta: PresencePlayerMeta) => Promise<void>;
  /** Untrack ce client de la presence (à appeler au unmount/beforeunload). */
  untrackPresence: () => Promise<void>;
  /**
   * S'abonne aux changements de presence. Le handler est appelé avec l'état
   * complet `{ key: PresencePlayerMeta[] }` à chaque sync/join/leave. Retourne
   * une fonction d'unbind.
   */
  onPresence: (listener: PresenceListener) => () => void;
  /** Lit l'état presence courant (snapshot synchrone). */
  presenceState: () => Record<string, PresencePlayerMeta[]>;
  unsubscribe: () => Promise<"ok" | "timed out" | "error">;
}

export function joinTvChannel(roomCode: string): TvChannelHandle {
  const supabase = createClient();
  const channel = supabase.channel(`room:${roomCode}`, {
    config: {
      broadcast: { self: false, ack: false },
      // Presence key : le `token` est unique par téléphone, l'hôte utilise
      // `host:{roomCode}` pour ne pas entrer en collision avec les joueurs.
      // Voir trackPresence ci-dessous : on passe la clé via `meta.token`.
      presence: { key: "" },
    },
  });

  // Buffer des handlers presence + on émet à chaque event Realtime
  const presenceListeners = new Set<PresenceListener>();
  function emitPresence() {
    const raw = channel.presenceState() as Record<
      string,
      Array<PresencePlayerMeta & { presence_ref: string }>
    >;
    // Cast vers `PresencePlayerMeta[]` (presence_ref est interne Supabase)
    const cleaned: Record<string, PresencePlayerMeta[]> = {};
    for (const [key, metas] of Object.entries(raw)) {
      cleaned[key] = metas.map((m) => ({
        token: m.token,
        pseudo: m.pseudo,
        avatarUrl: m.avatarUrl,
        joinedAt: m.joinedAt,
        role: m.role,
      }));
    }
    for (const l of presenceListeners) l(cleaned);
  }

  channel.on("presence", { event: "sync" }, () => emitPresence());
  channel.on("presence", { event: "join" }, () => emitPresence());
  channel.on("presence", { event: "leave" }, () => emitPresence());

  void channel.subscribe();

  return {
    channel,
    send(event, payload) {
      void channel.send({
        type: "broadcast",
        event,
        payload,
      });
    },
    on(event, handler) {
      channel.on("broadcast", { event }, ({ payload }) => {
        // Cast volontaire : Realtime perd le typage générique.
        handler(payload as RoomEvents[typeof event]);
      });
    },
    async trackPresence(meta) {
      // Note : Supabase utilise la clé fournie dans meta._key si présente,
      // sinon une clé interne. On utilise `meta.token` comme clé stable
      // pour pouvoir dédupliquer les multi-onglets (même token = même slot).
      // L'API track accepte un object meta — la clé presence du channel
      // est paramétrée à la création (`presence.key`). Pour avoir un slot
      // par token, on encode le token dans la meta directement.
      await channel.track(meta);
    },
    async untrackPresence() {
      await channel.untrack();
    },
    onPresence(listener) {
      presenceListeners.add(listener);
      // Push immédiat de l'état courant si déjà disponible
      try {
        const raw = channel.presenceState();
        if (Object.keys(raw).length > 0) emitPresence();
      } catch {
        // ignore — channel pas encore subscribed
      }
      return () => {
        presenceListeners.delete(listener);
      };
    },
    presenceState() {
      const raw = channel.presenceState() as Record<
        string,
        Array<PresencePlayerMeta & { presence_ref: string }>
      >;
      const cleaned: Record<string, PresencePlayerMeta[]> = {};
      for (const [key, metas] of Object.entries(raw)) {
        cleaned[key] = metas.map((m) => ({
          token: m.token,
          pseudo: m.pseudo,
          avatarUrl: m.avatarUrl,
          joinedAt: m.joinedAt,
          role: m.role,
        }));
      }
      return cleaned;
    },
    async unsubscribe() {
      const supabase = createClient();
      try {
        await channel.untrack();
      } catch {
        // ignore — déjà unsubscribed
      }
      const status = await channel.unsubscribe();
      // Détache le channel du client pour libérer la connexion WebSocket.
      void supabase.removeChannel(channel);
      return status;
    },
  };
}
