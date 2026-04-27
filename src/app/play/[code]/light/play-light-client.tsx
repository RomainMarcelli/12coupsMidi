"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2, Trophy, X } from "lucide-react";
import { motion } from "framer-motion";
import {
  joinTvChannel,
  type TvChannelHandle,
} from "@/lib/realtime/tv-channel";
import {
  markDisconnected,
  readStoredToken,
  rejoinRoomByToken,
  sendHeartbeat,
} from "@/lib/realtime/player-actions";
import type {
  QuestionResultPayload,
  QuestionShowPayload,
} from "@/lib/realtime/room-events";
import { cn } from "@/lib/utils";

interface PlayLightClientProps {
  code: string;
  roomId: string;
  /** Si true, affiche aussi l'énoncé + libellés des choix. */
  fullMode: boolean;
}

type Phase = "waiting" | "playing" | "result" | "ended";

const ANSWER_COLORS = [
  "bg-buzz text-cream", // A = rouge
  "bg-sky text-navy", // B = bleu
  "bg-life-green text-navy", // C = vert
  "bg-life-yellow text-navy", // D = jaune
];

/**
 * UI téléphone : pendant son tour, 4 (ou 2) gros boutons couleurs A/B/C/D
 * occupent l'écran. Hors tour : "X est en train de jouer…" + score/état.
 *
 * Vibration + flash or au passage du tour. Heartbeat de 12 s pour signaler
 * la connexion. Reconnexion auto si on revient sur la page (via token
 * localStorage) — sinon rebascule vers /play/[code] pour rejoindre proprement.
 */
export function PlayLightClient({
  code,
  roomId,
  fullMode,
}: PlayLightClientProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("waiting");
  const [question, setQuestion] = useState<QuestionShowPayload | null>(null);
  const [result, setResult] = useState<QuestionResultPayload | null>(null);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState(false);
  const channelRef = useRef<TvChannelHandle | null>(null);

  // Reconnexion auto au mount
  useEffect(() => {
    const stored = readStoredToken(code);
    if (!stored) {
      router.replace(`/play/${code}`);
      return;
    }
    void rejoinRoomByToken({ code, token: stored }).then((res) => {
      if (!res.ok) {
        router.replace(`/play/${code}`);
        return;
      }
      setToken(stored);
      setPlayerId(res.data.playerId);
    });
  }, [code, router]);

  // Récupère mon pseudo (utile pour fallback affichage)
  useEffect(() => {
    if (!playerId) return;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      void createClient()
        .from("tv_room_players")
        .select("pseudo")
        .eq("id", playerId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.pseudo) setPseudo(data.pseudo as string);
        });
    });
  }, [playerId]);

  // Channel realtime
  useEffect(() => {
    if (!token || !playerId) return;
    const ch = joinTvChannel(code);
    channelRef.current = ch;

    ch.on("question:show", (payload) => {
      setQuestion(payload);
      setResult(null);
      setPhase("playing");
      // Mon tour ? → vibration + flash or
      if (payload.currentPlayerToken === token) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.([200, 100, 200]);
        }
        setFlash(true);
        window.setTimeout(() => setFlash(false), 1000);
      }
    });

    ch.on("question:result", (payload) => {
      setResult(payload);
      setPhase("result");
      if (payload.byToken === token && payload.isCorrect) {
        setScore((s) => s + 1);
      }
    });

    ch.on("phase:change", (payload) => {
      if (payload.phase === "results") setPhase("ended");
    });

    return () => {
      void ch.unsubscribe();
      channelRef.current = null;
    };
  }, [code, token, playerId]);

  // Heartbeat toutes les 12 s + marquer déconnecté à l'unload
  useEffect(() => {
    if (!playerId || !token) return;
    const interval = window.setInterval(() => {
      void sendHeartbeat({ playerId, token });
    }, 12_000);
    function onBeforeUnload() {
      void markDisconnected({ playerId: playerId!, token: token! });
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [playerId, token]);

  function handleAnswer(idx: number) {
    if (!question || !channelRef.current || !token) return;
    if (question.currentPlayerToken !== token) return;
    if (phase !== "playing") return;
    channelRef.current.send("answer:submit", {
      questionId: question.questionId,
      chosenIdx: idx,
      playerToken: token,
    });
    // Optimistic : on bascule en attente de result
    setPhase("result");
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-warm" aria-hidden="true" />
      </main>
    );
  }

  if (phase === "ended") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <Trophy
          className="h-16 w-16 text-gold-warm"
          aria-hidden="true"
          fill="currentColor"
        />
        <h1 className="font-display text-3xl font-extrabold text-navy">
          Partie terminée !
        </h1>
        <p className="text-navy/70">
          Tes réponses : <strong className="text-life-green">{score}</strong> bonnes.
        </p>
        <p className="text-sm text-navy/50">
          Le classement final est sur la TV.
        </p>
      </main>
    );
  }

  const isMyTurn =
    phase === "playing" && question?.currentPlayerToken === token;

  return (
    <main
      className={cn(
        "flex min-h-screen flex-col gap-4 p-4 transition-colors",
        flash ? "bg-gold/40" : "bg-cream",
      )}
    >
      <header className="flex items-center justify-between text-navy">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-navy/50">
            Partie {code}
          </p>
          <p className="font-display text-base font-extrabold">{pseudo}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-sm font-bold text-gold-warm">
          <Trophy className="h-4 w-4" aria-hidden="true" />
          {score}
        </div>
      </header>

      {phase === "result" && result && (
        <ResultBanner result={result} myToken={token} />
      )}

      {fullMode && question && (
        <section className="rounded-2xl border border-border bg-white p-4 text-center">
          {question.format && (
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold-warm">
              {question.format}
            </span>
          )}
          <p className="mt-2 font-display text-base font-bold text-navy">
            {question.enonce}
          </p>
        </section>
      )}

      {isMyTurn && question ? (
        <section className="grid flex-1 grid-cols-1 gap-3">
          {question.choices.map((c) => {
            const colorClass =
              ANSWER_COLORS[c.idx] ?? "bg-navy/10 text-navy";
            return (
              <motion.button
                key={c.idx}
                type="button"
                onClick={() => handleAnswer(c.idx)}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "flex w-full items-center justify-center gap-3 rounded-3xl px-6 text-2xl font-extrabold uppercase shadow-lg",
                  "min-h-[120px] flex-1",
                  colorClass,
                )}
              >
                <span className="font-display text-3xl">
                  {String.fromCharCode(65 + c.idx)}
                </span>
                {fullMode && <span className="text-base normal-case">{c.text}</span>}
              </motion.button>
            );
          })}
        </section>
      ) : (
        <WaitingTurn question={question} myToken={token} />
      )}
    </main>
  );
}

function WaitingTurn({
  question,
  myToken,
}: {
  question: QuestionShowPayload | null;
  myToken: string;
}) {
  const isMine = question?.currentPlayerToken === myToken;
  if (!question) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-navy/60">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        <p>En attente de la première question…</p>
      </div>
    );
  }
  if (isMine) return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <Crown className="h-10 w-10 text-gold-warm" aria-hidden="true" />
      <p className="font-display text-2xl font-extrabold text-navy">
        {question.currentPlayerPseudo}
      </p>
      <p className="text-navy/60">est en train de jouer…</p>
    </div>
  );
}

function ResultBanner({
  result,
  myToken,
}: {
  result: QuestionResultPayload;
  myToken: string;
}) {
  const isMine = result.byToken === myToken;
  const correct = result.isCorrect;
  const Icon = correct ? Check : X;
  const tone = correct
    ? "border-life-green/40 bg-life-green/15 text-life-green"
    : "border-buzz/40 bg-buzz/15 text-buzz";
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold",
        tone,
      )}
      role="status"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="flex-1">
        {isMine
          ? correct
            ? "Bonne réponse !"
            : "Mauvaise réponse"
          : correct
            ? "Bonne réponse"
            : "Loupé"}
      </span>
    </motion.div>
  );
}
