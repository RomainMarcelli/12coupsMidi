"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { RoomEventName, RoomEvents } from "./room-events";

/**
 * Wrapper typé autour de `supabase.channel('room:{code}')` pour les events
 * du Mode TV Soirée. Encapsule subscribe / send / cleanup + Presence (P1.1).
 *
 * Channel naming : `room:{code}` (4 chiffres).
 *
 * **Cache + ref-counting (fix P1 production)** : plusieurs `useEffect`
 * peuvent légitimement vouloir le même channel (presence + broadcast +
 * face-à-face). Pour ne PAS créer plusieurs `RealtimeChannel` sur le même
 * topic (ce qui faisait planter Supabase avec
 * `cannot add 'presence' callbacks ... after subscribe()` dès qu'un 2e
 * useEffect tentait de re-binder presence sur un channel déjà subscribed),
 * on cache un seul channel par roomCode et on incrémente un compteur de
 * références. L'unsubscribe réel n'a lieu que quand le dernier handle
 * disparaît.
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

interface CachedChannel {
  channel: RealtimeChannel;
  presenceListeners: Set<PresenceListener>;
  refCount: number;
}

const channelCache = new Map<string, CachedChannel>();

function cleanPresenceState(
  channel: RealtimeChannel,
): Record<string, PresencePlayerMeta[]> {
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
}

export function joinTvChannel(roomCode: string): TvChannelHandle {
  const supabase = createClient();
  let entry = channelCache.get(roomCode);

  if (!entry) {
    // Première instance : on crée le channel, on enregistre les callbacks
    // presence (avant subscribe — obligatoire côté Supabase) et on lance
    // le subscribe.
    const channel = supabase.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: "" },
      },
    });

    const presenceListeners = new Set<PresenceListener>();
    function emitPresence() {
      const cleaned = cleanPresenceState(channel);
      for (const l of presenceListeners) l(cleaned);
    }

    channel.on("presence", { event: "sync" }, () => emitPresence());
    channel.on("presence", { event: "join" }, () => emitPresence());
    channel.on("presence", { event: "leave" }, () => emitPresence());

    void channel.subscribe();

    entry = { channel, presenceListeners, refCount: 0 };
    channelCache.set(roomCode, entry);
  }

  entry.refCount++;
  const cur = entry;

  return {
    channel: cur.channel,
    send(event, payload) {
      void cur.channel.send({
        type: "broadcast",
        event,
        payload,
      });
    },
    on(event, handler) {
      // Broadcast peut être bindé après subscribe — Supabase l'autorise.
      cur.channel.on("broadcast", { event }, ({ payload }) => {
        handler(payload as RoomEvents[typeof event]);
      });
    },
    async trackPresence(meta) {
      try {
        await cur.channel.track(meta);
      } catch {
        // ignore — peut arriver si le channel est en cours de subscribe
      }
    },
    async untrackPresence() {
      try {
        await cur.channel.untrack();
      } catch {
        // ignore
      }
    },
    onPresence(listener) {
      cur.presenceListeners.add(listener);
      // Push immédiat de l'état courant si déjà disponible (utile quand
      // un 2e useEffect s'abonne après que la presence sync ait déjà eu lieu).
      try {
        const cleaned = cleanPresenceState(cur.channel);
        if (Object.keys(cleaned).length > 0) listener(cleaned);
      } catch {
        // channel pas encore subscribed — la sync arrivera bientôt
      }
      return () => {
        cur.presenceListeners.delete(listener);
      };
    },
    presenceState() {
      try {
        return cleanPresenceState(cur.channel);
      } catch {
        return {};
      }
    },
    async unsubscribe() {
      cur.refCount--;
      if (cur.refCount > 0) {
        // Il reste d'autres handles actifs sur ce channel — on garde le
        // channel ouvert pour eux.
        return "ok";
      }
      // Dernier handle : on coupe vraiment.
      channelCache.delete(roomCode);
      try {
        await cur.channel.untrack();
      } catch {
        // ignore
      }
      const status = await cur.channel.unsubscribe();
      void supabase.removeChannel(cur.channel);
      return status;
    },
  };
}

/**
 * Pour les tests : reset du cache. Ne pas appeler en prod — utilisé
 * uniquement par les tests unitaires.
 */
export function __resetTvChannelCache(): void {
  channelCache.clear();
}
