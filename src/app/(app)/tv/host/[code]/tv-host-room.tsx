"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Loader2, Play, Tv, Users, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { endTvRoom, updateTvRoomState } from "@/lib/realtime/room-actions";
import { prepareTvGame, saveTvGameState } from "@/lib/realtime/tv-game-actions";
import { joinTvChannel, type TvChannelHandle } from "@/lib/realtime/tv-channel";
import {
  isTvGameState,
  type TvGameState,
} from "@/lib/realtime/tv-game-state";
import { AnimEffect } from "@/components/animations/AnimEffect";

interface TvHostRoomProps {
  roomId: string;
  code: string;
  initialPlayers: Array<{
    id: string;
    pseudo: string;
    avatarUrl: string | null;
    isConnected: boolean;
    joinedAt: string;
  }>;
  initialStatus: "waiting" | "playing" | "paused" | "ended";
}

/**
 * Vue TV "Salle d'attente" : QR code + code à 4 chiffres en grand,
 * liste des joueurs qui rejoignent en live (via Supabase Realtime sur
 * la table `tv_room_players`), bouton "Démarrer la partie" qui devient
 * actif dès qu'on a au moins 2 joueurs.
 *
 * Note : pour l'instant, "démarrer" ne fait que basculer le status en
 * `playing`. La suite (vue TV en jeu, sync questions) est dans 5.c+.
 */
export function TvHostRoom({
  roomId,
  code,
  initialPlayers,
  initialStatus,
}: TvHostRoomProps) {
  const router = useRouter();
  const [players, setPlayers] = useState(initialPlayers);
  const [status, setStatus] = useState(initialStatus);
  const [starting, setStarting] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  // Calculé côté client uniquement (origin n'est pas dispo en SSR).
  useEffect(() => {
    if (typeof window !== "undefined") {
      setJoinUrl(`${window.location.origin}/play/${code}`);
    }
  }, [code]);

  // Souscription Realtime à la table tv_room_players (filtre par room_id)
  // pour voir arriver/partir les joueurs en live.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tv-room-players:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tv_room_players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const r = payload.new as {
              id: string;
              pseudo: string;
              avatar_url: string | null;
              is_connected: boolean;
              joined_at: string;
            };
            setPlayers((prev) => {
              if (prev.some((p) => p.id === r.id)) return prev;
              return [
                ...prev,
                {
                  id: r.id,
                  pseudo: r.pseudo,
                  avatarUrl: r.avatar_url,
                  isConnected: r.is_connected,
                  joinedAt: r.joined_at,
                },
              ];
            });
          } else if (payload.eventType === "UPDATE") {
            const r = payload.new as {
              id: string;
              pseudo: string;
              avatar_url: string | null;
              is_connected: boolean;
              joined_at: string;
            };
            setPlayers((prev) =>
              prev.map((p) =>
                p.id === r.id
                  ? {
                      ...p,
                      pseudo: r.pseudo,
                      avatarUrl: r.avatar_url,
                      isConnected: r.is_connected,
                    }
                  : p,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const r = payload.old as { id: string };
            setPlayers((prev) => prev.filter((p) => p.id !== r.id));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  const canStart = useMemo(
    () => players.filter((p) => p.isConnected).length >= 2,
    [players],
  );

  // État du jeu TV (en mode playing). Chargé via prepareTvGame ou via
  // un SELECT sur tv_rooms.state si on revient sur la page après refresh.
  const [game, setGame] = useState<TvGameState | null>(null);
  const [hostChannel, setHostChannel] = useState<TvChannelHandle | null>(null);

  async function handleStart() {
    if (!canStart || starting) return;
    setStarting(true);
    // Construit l'ordre de tour à partir des joueurs connectés (par
    // joinedAt). On a besoin du player_token de chacun → re-fetch.
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("tv_room_players")
      .select("player_token, joined_at, is_connected")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    const turnOrder = (rows ?? [])
      .filter((r) => r.is_connected)
      .map((r) => r.player_token as string);
    const res = await prepareTvGame({ roomId, turnOrder, totalRounds: 10 });
    if (!res.ok) {
      alert(res.message);
      setStarting(false);
      return;
    }
    setGame(res.state);
    setStatus("playing");
    setStarting(false);
  }

  async function handleEnd() {
    if (!window.confirm("Mettre fin à la partie ?")) return;
    if (hostChannel) await hostChannel.unsubscribe();
    await endTvRoom(roomId);
    router.push("/tv/host");
  }

  // Une fois en "playing", on monte le channel hôte qui :
  //  - broadcast la question courante au démarrage et à chaque tour
  //  - écoute les `answer:submit` des téléphones, valide, broadcast résultat
  useEffect(() => {
    if (status !== "playing" || !game) return;

    const ch = joinTvChannel(code);
    setHostChannel(ch);

    // Map token → pseudo pour les payloads broadcast
    const tokenToPseudo = new Map(
      players.map((p) => [
        // Le token n'est pas dans `players` (pas exposé via la query
        // initiale). On va le récupérer en parallèle ci-dessous.
        p.id,
        p.pseudo,
      ]),
    );
    void tokenToPseudo;

    /** Diffuse la question courante à tous (sans la bonne réponse). */
    function broadcastCurrent(state: TvGameState) {
      const q = state.questions[state.currentQuestionIdx];
      if (!q || !state.currentPlayerToken) return;
      ch.send("question:show", {
        questionId: q.id,
        enonce: q.enonce,
        format: q.format ?? null,
        choices: q.choices,
        currentPlayerToken: state.currentPlayerToken,
        currentPlayerPseudo: getPseudoForToken(state.currentPlayerToken) ?? "?",
      });
    }

    function getPseudoForToken(token: string): string | undefined {
      // On ne dispose pas direct des tokens dans `players` (volontairement
      // — la TV peut le voir mais pas l'exposer). Un fetch ad-hoc serait
      // mieux ; pour l'instant on utilise pseudo via cache local rempli
      // par l'effet ci-dessous.
      return tokenPseudoCache.current.get(token);
    }

    // Diffusion initiale
    broadcastCurrent(game);

    ch.on("answer:submit", async (payload) => {
      // Verrou : on n'accepte que la réponse du joueur dont c'est le tour
      // ET de la bonne question (anti-spam, anti-race condition).
      setGame((prev) => {
        if (!prev) return prev;
        if (prev.phase !== "playing") return prev;
        const q = prev.questions[prev.currentQuestionIdx];
        if (!q || q.id !== payload.questionId) return prev;
        if (payload.playerToken !== prev.currentPlayerToken) return prev;

        const isCorrect = payload.chosenIdx === q.correctIdx;
        const newScores = {
          ...prev.scores,
          [payload.playerToken]:
            (prev.scores[payload.playerToken] ?? 0) + (isCorrect ? 1 : 0),
        };

        // Broadcast résultat
        ch.send("question:result", {
          questionId: q.id,
          byToken: payload.playerToken,
          chosenIdx: payload.chosenIdx,
          correctIdx: q.correctIdx,
          isCorrect,
          explication: q.explication ?? null,
        });

        // Avance après 3 s pour laisser lire la bonne réponse
        const nextRound = prev.currentRound + 1;
        const isLast = nextRound >= prev.totalRounds;
        const nextIdx =
          (prev.turnOrder.indexOf(payload.playerToken) + 1) %
          prev.turnOrder.length;
        const nextToken = prev.turnOrder[nextIdx] ?? null;
        const nextQIdx = (prev.currentQuestionIdx + 1) % prev.questions.length;

        const nextState: TvGameState = isLast
          ? {
              ...prev,
              scores: newScores,
              phase: "results",
            }
          : {
              ...prev,
              scores: newScores,
              currentQuestionIdx: nextQIdx,
              currentPlayerToken: nextToken,
              currentRound: nextRound,
            };

        // Persiste l'état (best-effort)
        void saveTvGameState({
          roomId,
          state: nextState,
          status: isLast ? "ended" : undefined,
        });

        // Diffuse la prochaine question après le délai de feedback
        if (!isLast) {
          window.setTimeout(() => broadcastCurrent(nextState), 3500);
        } else {
          ch.send("phase:change", { phase: "results" });
        }

        return nextState;
      });
    });

    return () => {
      void ch.unsubscribe();
      setHostChannel(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, code, roomId]);

  // Cache local token → pseudo (rempli après mount via select sur la BDD)
  const tokenPseudoCache = useTokenPseudoCache(roomId, players);

  // Switch waiting / playing / results
  if (status === "playing" && game?.phase === "playing") {
    return (
      <TvPlayingView
        code={code}
        game={game}
        players={players}
        tokenCache={tokenPseudoCache.current}
        onEnd={handleEnd}
      />
    );
  }
  if (status === "playing" && game?.phase === "results") {
    return (
      <TvResultsView
        game={game}
        players={players}
        tokenCache={tokenPseudoCache.current}
        onClose={handleEnd}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 lg:p-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/20 text-gold-warm">
            <Tv className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
              Mode TV Soirée
            </p>
            <h1 className="font-display text-2xl font-extrabold text-navy">
              Salle d&apos;attente
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={handleEnd}
          aria-label="Mettre fin à la partie"
          className="inline-flex items-center gap-1.5 rounded-md border border-buzz/30 bg-white px-3 py-2 text-sm font-semibold text-buzz hover:border-buzz hover:bg-buzz/10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Quitter
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Bloc QR + code */}
        <section className="flex flex-col items-center gap-5 rounded-3xl border border-gold/40 bg-gradient-to-br from-gold-pale via-cream to-sky-pale p-8 text-center glow-sun">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
            Pour rejoindre
          </p>
          {joinUrl ? (
            <div className="rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(245,183,0,0.35)]">
              <QRCodeSVG
                value={joinUrl}
                size={280}
                level="M"
                includeMargin={false}
              />
            </div>
          ) : (
            <div className="flex h-[280px] w-[280px] items-center justify-center rounded-2xl bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-gold-warm" aria-hidden="true" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-navy/70">
              Ou tape le code
            </p>
            <p className="font-display text-7xl font-black tracking-[0.3em] text-navy sm:text-8xl">
              {code}
            </p>
          </div>
          <p className="max-w-xs text-sm text-navy/70">
            Sur ton téléphone, ouvre l&apos;app et entre ce code, ou scanne
            le QR code ci-dessus.
          </p>
        </section>

        {/* Bloc joueurs connectés */}
        <section className="flex flex-col gap-4 rounded-3xl border border-border bg-white p-6 glow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-navy" aria-hidden="true" />
              <h2 className="font-display text-xl font-bold text-navy">
                Joueurs connectés
              </h2>
            </div>
            <span className="rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-gold-warm">
              {players.filter((p) => p.isConnected).length} / 8
            </span>
          </div>

          {players.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-10 text-center text-navy/50">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <p>En attente des premiers joueurs…</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gold/15">
                    {p.avatarUrl ? (
                      <Image
                        src={p.avatarUrl}
                        alt=""
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <Crown className="h-5 w-5 text-gold-warm" aria-hidden="true" />
                    )}
                  </div>
                  <span className="flex-1 font-display text-lg font-bold text-navy">
                    {p.pseudo}
                  </span>
                  <span
                    className={
                      p.isConnected
                        ? "rounded-full bg-life-green/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-life-green"
                        : "rounded-full bg-buzz/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz"
                    }
                  >
                    {p.isConnected ? "En ligne" : "Hors ligne"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Button
            variant="gold"
            size="lg"
            disabled={!canStart || starting || status !== "waiting"}
            onClick={handleStart}
            className="mt-auto text-lg"
          >
            {starting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
            )}
            {status === "playing" ? "Partie en cours…" : "Démarrer la partie"}
          </Button>
          {!canStart && status === "waiting" && (
            <p className="text-center text-xs text-navy/50">
              Au moins 2 joueurs requis pour démarrer.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

// ============================================================================
// useTokenPseudoCache : map token → pseudo (chargée via SELECT sur la BDD)
// ============================================================================
// Les `players` exposés au TV n'incluent pas le `player_token` (volontaire :
// il ne sert qu'aux téléphones). Mais l'hôte a besoin de mapper token →
// pseudo pour les broadcasts ("currentPlayerPseudo"). On fetch séparément.
function useTokenPseudoCache(
  roomId: string,
  players: Array<{ id: string; pseudo: string }>,
) {
  const cache = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("tv_room_players")
      .select("player_token, pseudo")
      .eq("room_id", roomId)
      .then(({ data }) => {
        if (!data) return;
        cache.current.clear();
        for (const r of data) {
          cache.current.set(r.player_token as string, r.pseudo as string);
        }
      });
  }, [roomId, players.length]);
  return cache;
}

// ============================================================================
// TvPlayingView : grand écran avec question + scores + qui joue
// ============================================================================
function TvPlayingView({
  code,
  game,
  players,
  tokenCache,
  onEnd,
}: {
  code: string;
  game: TvGameState;
  players: Array<{
    id: string;
    pseudo: string;
    avatarUrl: string | null;
  }>;
  tokenCache: Map<string, string>;
  onEnd: () => void;
}) {
  const q = game.questions[game.currentQuestionIdx];
  const currentPseudo = game.currentPlayerToken
    ? tokenCache.get(game.currentPlayerToken)
    : "?";

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-6 lg:p-10">
      <header className="flex items-center justify-between text-navy">
        <p className="text-sm font-bold uppercase tracking-widest text-gold-warm">
          Partie {code} · Tour {game.currentRound + 1} / {game.totalRounds}
        </p>
        <button
          type="button"
          onClick={onEnd}
          className="inline-flex items-center gap-1.5 rounded-md border border-buzz/30 bg-white px-3 py-1.5 text-xs font-semibold text-buzz hover:bg-buzz/10"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Terminer
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar joueurs */}
        <aside className="flex flex-col gap-2">
          {players.map((p) => {
            const score =
              Object.entries(game.scores).find(
                ([token]) => tokenCache.get(token) === p.pseudo,
              )?.[1] ?? 0;
            const isActive = currentPseudo === p.pseudo;
            return (
              <div
                key={p.id}
                className={
                  isActive
                    ? "flex items-center gap-3 rounded-2xl border-2 border-gold bg-gold/15 p-3 shadow-[0_0_24px_rgba(245,183,0,0.5)]"
                    : "flex items-center gap-3 rounded-2xl border border-border bg-white p-3"
                }
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gold/15">
                  {p.avatarUrl ? (
                    <Image
                      src={p.avatarUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <Crown className="h-5 w-5 text-gold-warm" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-display text-base font-extrabold text-navy">
                    {p.pseudo}
                  </p>
                  <p className="text-xs text-navy/60">
                    {score} bonne{score > 1 ? "s" : ""} réponse{score > 1 ? "s" : ""}
                  </p>
                </div>
                {isActive && (
                  <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-navy">
                    À jouer
                  </span>
                )}
              </div>
            );
          })}
        </aside>

        {/* Question géante */}
        <section className="flex flex-col items-center justify-center gap-8 rounded-3xl border border-gold/40 bg-gradient-to-br from-gold-pale via-cream to-sky-pale p-10 text-center glow-sun">
          {q ? (
            <>
              {q.format && (
                <span className="rounded-full bg-gold/20 px-4 py-1 text-sm font-bold uppercase tracking-widest text-gold-warm">
                  {q.format}
                </span>
              )}
              <h2 className="font-display text-3xl font-extrabold text-navy lg:text-5xl">
                {q.enonce}
              </h2>
              <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
                {q.choices.map((c) => (
                  <div
                    key={c.idx}
                    className="flex items-center gap-3 rounded-xl border-2 border-gold/30 bg-white px-6 py-5 text-left text-xl font-semibold text-navy"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/20 font-display font-extrabold text-gold-warm">
                      {String.fromCharCode(65 + c.idx)}
                    </span>
                    <span className="flex-1">{c.text}</span>
                  </div>
                ))}
              </div>
              <p className="text-lg font-bold text-navy/70">
                À toi de jouer, <span className="text-gold-warm">{currentPseudo}</span> !
              </p>
            </>
          ) : (
            <Loader2 className="h-12 w-12 animate-spin text-gold-warm" aria-hidden="true" />
          )}
        </section>
      </div>
    </main>
  );
}

// ============================================================================
// TvResultsView : podium final
// ============================================================================
function TvResultsView({
  game,
  players,
  tokenCache,
  onClose,
}: {
  game: TvGameState;
  players: Array<{
    id: string;
    pseudo: string;
    avatarUrl: string | null;
  }>;
  tokenCache: Map<string, string>;
  onClose: () => void;
}) {
  const ranked = useMemo(() => {
    const arr = players.map((p) => {
      const token = Array.from(tokenCache.entries()).find(
        ([, pseudo]) => pseudo === p.pseudo,
      )?.[0];
      const score = token ? (game.scores[token] ?? 0) : 0;
      return { ...p, score };
    });
    arr.sort((a, b) => b.score - a.score);
    return arr;
  }, [players, game.scores, tokenCache]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <AnimEffect animation="crown" size="lg" autoCloseMs={0} />
      <AnimEffect animation="coins-rain" size="fullscreen" autoCloseMs={2400} />
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-gold-warm">
          Mode TV — Partie terminée
        </p>
        <h1 className="font-display text-5xl font-extrabold text-navy">
          {ranked[0]?.pseudo ?? "Pas de vainqueur"} gagne !
        </h1>
      </div>
      <ul className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-white p-5 glow-card">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            className={
              i === 0
                ? "flex items-center gap-3 text-gold-warm"
                : "flex items-center gap-3 text-navy"
            }
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 font-display text-base font-extrabold text-navy">
              {i + 1}
            </span>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gold/15">
              {p.avatarUrl ? (
                <Image
                  src={p.avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <Crown className="h-4 w-4 text-gold-warm" aria-hidden="true" />
              )}
            </div>
            <span className="flex-1 text-left font-display text-lg font-bold">
              {p.pseudo}
            </span>
            <span className="text-base font-bold tabular-nums">
              {p.score}
            </span>
          </li>
        ))}
      </ul>
      <Button variant="gold" size="lg" onClick={onClose}>
        Retour à l&apos;accueil
      </Button>
    </main>
  );
}
