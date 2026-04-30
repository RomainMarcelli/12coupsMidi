"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { RoomEventName, RoomEvents } from "./room-events";

/**
 * Wrapper typé autour de `supabase.channel('room:{code}')` pour les events
 * du Mode TV Soirée. Encapsule subscribe / send / cleanup.
 *
 * Channel naming : `room:{code}` (4 chiffres). Une seule connexion par
 * onglet — les composants React doivent appeler `unsubscribe()` au unmount.
 */

export interface TvChannelHandle {
  channel: RealtimeChannel;
  send: <K extends RoomEventName>(event: K, payload: RoomEvents[K]) => void;
  on: <K extends RoomEventName>(
    event: K,
    handler: (payload: RoomEvents[K]) => void,
  ) => void;
  unsubscribe: () => Promise<"ok" | "timed out" | "error">;
}

export function joinTvChannel(roomCode: string): TvChannelHandle {
  const supabase = createClient();
  const channel = supabase.channel(`room:${roomCode}`, {
    config: {
      broadcast: { self: false, ack: false },
      // Pas de presence pour l'instant, on tracke `is_connected` via la DB.
      presence: { key: roomCode },
    },
  });

  // Souscription après le binding (cf. handlers ajoutés via .on() ci-dessous).
  // Subscribe différé : le caller fait .on() plusieurs fois puis on souscrit
  // automatiquement à la première utilisation. Pour simplifier on souscrit
  // immédiatement et on bind au fur et à mesure (Supabase Realtime accepte
  // d'ajouter des listeners après subscribe).
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
    async unsubscribe() {
      const supabase = createClient();
      const status = await channel.unsubscribe();
      // Détache le channel du client pour libérer la connexion WebSocket.
      void supabase.removeChannel(channel);
      return status;
    },
  };
}
