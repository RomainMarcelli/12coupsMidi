"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Crown,
  Lock,
  Minus,
  Play,
  Plus,
  Users,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { BOT_PROFILES, type BotDifficulty } from "@/lib/game-logic/faceAFace";
import { DC_MAX_PLAYERS, DC_MIN_PLAYERS } from "@/lib/game-logic/douze-coups";
import { cn } from "@/lib/utils";

type SubPhase = "mode" | "humans-subpick" | "config";
type Adversary = "bots" | "humans_local";

export interface DcSetupResult {
  players: Array<{
    pseudo: string;
    isBot: boolean;
    botLevel?: BotDifficulty;
  }>;
}

interface SetupScreenProps {
  userPseudo: string;
  onReady: (result: DcSetupResult) => void;
}

interface LocalPlayer {
  pseudo: string;
  isBot: boolean;
  botLevel?: BotDifficulty;
}

/**
 * Écran de configuration du mode 12 Coups de Midi.
 *  1. Choix Bots / Humains
 *  2. Si Humains : Local (actif) / En ligne (désactivé, bientôt)
 *  3. Roster : 2 à 4 joueurs, avec possibilité de mixer humains + bots
 *     et de régler la difficulté de chaque bot individuellement.
 */
export function DcSetupScreen({ userPseudo, onReady }: SetupScreenProps) {
  const [subPhase, setSubPhase] = useState<SubPhase>("mode");
  const [adversary, setAdversary] = useState<Adversary>("bots");
  const [fillWithBots, setFillWithBots] = useState(true);
  const [players, setPlayers] = useState<LocalPlayer[]>(() => [
    { pseudo: userPseudo, isBot: false },
    { pseudo: "Bot 1", isBot: true, botLevel: "moyen" },
    { pseudo: "Bot 2", isBot: true, botLevel: "moyen" },
    { pseudo: "Bot 3", isBot: true, botLevel: "moyen" },
  ]);

  const validationError = useMemo(() => {
    if (players.length < DC_MIN_PLAYERS) {
      return `Au moins ${DC_MIN_PLAYERS} joueurs.`;
    }
    if (players.length > DC_MAX_PLAYERS) {
      return `${DC_MAX_PLAYERS} joueurs maximum.`;
    }
    if (players.some((p) => !p.pseudo.trim())) {
      return "Tous les pseudos doivent être remplis.";
    }
    const pseudos = players.map((p) => p.pseudo.trim().toLowerCase());
    if (new Set(pseudos).size !== pseudos.length) {
      return "Les pseudos doivent être uniques.";
    }
    return null;
  }, [players]);

  // --- Phase 1 : Bots / Humains -----------------------------------------
  if (subPhase === "mode") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gold/20 text-gold-warm">
          <Crown className="h-10 w-10" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold uppercase tracking-widest text-gold-warm">
            Les 12 Coups de Midi
          </p>
          <h1 className="font-display text-4xl font-extrabold text-navy">
            Prépare la partie
          </h1>
          <p className="text-navy/70">Tu joues contre qui ?</p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2">
          <BigChoiceCard
            label="Contre des Bots"
            desc="2 à 4 joueurs, bots ajustables"
            icon={Bot}
            onClick={() => {
              setAdversary("bots");
              setSubPhase("config");
            }}
          />
          <BigChoiceCard
            label="Contre des humains"
            desc="Local ou en ligne"
            icon={Users}
            onClick={() => setSubPhase("humans-subpick")}
          />
        </div>
      </main>
    );
  }

  // --- Phase 2 : Local / En ligne ---------------------------------------
  if (subPhase === "humans-subpick") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sky/15 text-sky">
          <Users className="h-10 w-10" aria-hidden="true" />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-navy">
          Humains — comment ?
        </h1>
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <BigChoiceCard
            label="Local"
            desc="Un seul appareil, on se le passe"
            icon={Users}
            onClick={() => {
              setAdversary("humans_local");
              // Initialise un roster full-humain par défaut (4 humains)
              setPlayers([
                { pseudo: userPseudo, isBot: false },
                { pseudo: "", isBot: false },
                { pseudo: "", isBot: false },
                { pseudo: "", isBot: false },
              ]);
              setSubPhase("config");
            }}
          />
          <BigChoiceCard
            label="En ligne"
            desc="Sur appareils séparés"
            icon={Wifi}
            disabled
            badge="Bientôt"
          />
        </div>
        <button
          type="button"
          onClick={() => setSubPhase("mode")}
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-navy/70 hover:border-navy/40"
        >
          Retour
        </button>
      </main>
    );
  }

  // --- Phase 3 : Config roster -----------------------------------------
  const humanCount = players.filter((p) => !p.isBot).length;

  function handleChangeCount(delta: 1 | -1) {
    const next = Math.max(
      DC_MIN_PLAYERS,
      Math.min(DC_MAX_PLAYERS, players.length + delta),
    );
    setPlayers((prev) => {
      if (next > prev.length) {
        // Ajoute un bot ou un humain selon adversary
        const isBot =
          adversary === "bots" || (fillWithBots && humanCount >= 2);
        return [
          ...prev,
          isBot
            ? {
                pseudo: `Bot ${prev.filter((p) => p.isBot).length + 1}`,
                isBot: true,
                botLevel: "moyen",
              }
            : { pseudo: "", isBot: false },
        ];
      }
      return prev.slice(0, next);
    });
  }

  function handleChangePseudo(i: number, value: string) {
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, pseudo: value } : p)),
    );
  }

  function handleChangeBotLevel(i: number, level: BotDifficulty) {
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, botLevel: level } : p)),
    );
  }

  function handleToggleBotOnSlot(i: number, becomeBot: boolean) {
    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx !== i) return p;
        if (becomeBot) {
          return {
            pseudo: `Bot ${prev.filter((x) => x.isBot).length + 1}`,
            isBot: true,
            botLevel: "moyen",
          };
        }
        return { pseudo: "", isBot: false };
      }),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-1 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
          12 Coups de Midi · Configuration
        </p>
        <h1 className="font-display text-3xl font-extrabold text-navy">
          Les joueurs
        </h1>
      </div>

      {/* Fill with bots (seulement en humains local) */}
      {adversary === "humans_local" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
          <div className="text-left">
            <p className="font-display text-sm font-bold text-navy">
              Compléter avec des bots
            </p>
            <p className="text-xs text-navy/60">
              Les slots vides seront remplis par des bots
            </p>
          </div>
          <ToggleSwitch
            checked={fillWithBots}
            onChange={setFillWithBots}
            label="Compléter avec des bots"
          />
        </div>
      )}

      {/* Nombre de joueurs */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
        <div className="text-left">
          <p className="font-display text-sm font-bold text-navy">
            Joueurs : {players.length}
          </p>
          <p className="text-xs text-navy/60">
            Min {DC_MIN_PLAYERS} · Max {DC_MAX_PLAYERS}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleChangeCount(-1)}
            disabled={players.length <= DC_MIN_PLAYERS}
            aria-label="Moins un joueur"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-navy hover:border-gold/50 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleChangeCount(1)}
            disabled={players.length >= DC_MAX_PLAYERS}
            aria-label="Un joueur de plus"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-navy hover:border-gold/50 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Roster */}
      <ul className="flex flex-col gap-2">
        {players.map((p, i) => (
          <li
            key={i}
            className="flex flex-col gap-2 rounded-xl border border-border bg-white p-3 sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  p.isBot ? "bg-sky/15 text-sky" : "bg-gold/20 text-gold-warm",
                )}
              >
                {p.isBot ? (
                  <Bot className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Crown className="h-5 w-5" aria-hidden="true" />
                )}
              </div>
              <input
                type="text"
                value={p.pseudo}
                onChange={(e) => handleChangePseudo(i, e.target.value)}
                readOnly={p.isBot}
                maxLength={24}
                placeholder={p.isBot ? "" : `Joueur ${i + 1}`}
                className={cn(
                  "h-10 flex-1 rounded-md border border-border bg-white px-3 text-base text-navy focus:border-gold focus:outline-none",
                  p.isBot && "cursor-not-allowed bg-navy/5",
                )}
              />
              <span className="text-xs uppercase tracking-wider text-navy/40">
                #{i + 1}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {/* Toggle humain/bot pour slots 2+ en mode humains */}
              {i > 0 && adversary === "humans_local" && (
                <button
                  type="button"
                  onClick={() => handleToggleBotOnSlot(i, !p.isBot)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-semibold transition-colors",
                    p.isBot
                      ? "border-sky/40 bg-sky/10 text-sky hover:border-sky"
                      : "border-gold/40 bg-gold/10 text-gold-warm hover:border-gold",
                  )}
                >
                  {p.isBot ? "→ Humain" : "→ Bot"}
                </button>
              )}
              {/* Niveau bot */}
              {p.isBot && (
                <select
                  value={p.botLevel ?? "moyen"}
                  onChange={(e) =>
                    handleChangeBotLevel(
                      i,
                      e.target.value as BotDifficulty,
                    )
                  }
                  className="h-9 rounded-md border border-border bg-white px-2 text-xs font-semibold text-navy focus:border-gold focus:outline-none"
                >
                  <option value="facile">
                    Facile ({Math.round(BOT_PROFILES.facile.correctProbability * 100)} %)
                  </option>
                  <option value="moyen">
                    Moyen ({Math.round(BOT_PROFILES.moyen.correctProbability * 100)} %)
                  </option>
                  <option value="difficile">
                    Difficile ({Math.round(BOT_PROFILES.difficile.correctProbability * 100)} %)
                  </option>
                </select>
              )}
            </div>
          </li>
        ))}
      </ul>

      {validationError && (
        <p
          role="alert"
          className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-center text-sm text-buzz"
        >
          {validationError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            setSubPhase(adversary === "bots" ? "mode" : "humans-subpick")
          }
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-navy/70 hover:border-navy/40"
        >
          Retour
        </button>
        <Button
          variant="gold"
          size="lg"
          disabled={validationError !== null}
          onClick={() =>
            onReady({
              players: players.map((p) => ({
                pseudo: p.pseudo.trim(),
                isBot: p.isBot,
                botLevel: p.botLevel,
              })),
            })
          }
        >
          <Play className="h-4 w-4" aria-hidden="true" fill="currentColor" />
          Lancer la partie
        </Button>
      </div>
    </main>
  );
}

// =============================================================================
// BigChoiceCard
// =============================================================================

function BigChoiceCard({
  label,
  desc,
  icon: Icon,
  onClick,
  disabled = false,
  badge,
}: {
  label: string;
  desc: string;
  icon: typeof Bot;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Disponible prochainement" : undefined}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-2xl border p-6 transition-all",
        disabled
          ? "cursor-not-allowed border-border bg-navy/5 opacity-60"
          : "border-border bg-white hover:border-gold/50 hover:bg-gold/5 hover:scale-[1.02]",
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-xl",
          disabled ? "bg-navy/10 text-navy/40" : "bg-gold/20 text-gold-warm",
        )}
      >
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="font-display text-lg font-bold text-navy">{label}</div>
      <p className="text-xs text-navy/60">{desc}</p>
      {badge && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy/60">
          <Lock className="h-3 w-3" aria-hidden="true" />
          {badge}
        </span>
      )}
    </button>
  );
}
