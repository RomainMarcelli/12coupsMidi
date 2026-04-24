"use client";

import { useState } from "react";
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
import {
  FREE_MAX_PLAYERS,
  MIN_PLAYERS,
  OFFICIAL_MAX_PLAYERS,
  defaultBotName,
  newPlayerId,
  validateMultiConfig,
  type MultiConfig,
  type MultiMode,
  type PlayerConfig,
} from "@/lib/game-logic/players";
import { cn } from "@/lib/utils";

interface PlayerSetupProps {
  gameLabel: string;
  userPseudo: string;
  onReady: (config: MultiConfig) => void;
  onBack?: () => void;
}

type SetupPhase = "mode" | "humans-subpick" | "roster";

/**
 * Écran de configuration multijoueur partagé entre Coup d'Envoi, Coup par Coup,
 * et futurs jeux multijoueur. Flux :
 *  1. Choix Bots ou Humains
 *  2. (si Humains) Local ou En ligne (En ligne désactivé pour l'instant)
 *  3. Choix règles officielles (4 max) ou libres (jusqu'à FREE_MAX_PLAYERS)
 *  4. Saisie des pseudos / difficulté du bot
 */
export function PlayerSetup({
  gameLabel,
  userPseudo,
  onReady,
  onBack,
}: PlayerSetupProps) {
  const [phase, setPhase] = useState<SetupPhase>("mode");
  const [mode, setMode] = useState<MultiMode>("vs_bots");
  const [isOfficialRules, setIsOfficialRules] = useState(true);
  const [botDifficulty, setBotDifficulty] =
    useState<BotDifficulty>("moyen");
  const [players, setPlayers] = useState<PlayerConfig[]>(() => [
    { pseudo: userPseudo, isBot: false, id: newPlayerId() },
    {
      pseudo: defaultBotName(0, "moyen"),
      isBot: true,
      id: newPlayerId(),
    },
  ]);

  const maxPlayers = isOfficialRules ? OFFICIAL_MAX_PLAYERS : FREE_MAX_PLAYERS;

  // Ajuste dynamiquement la liste selon mode + nombre souhaité
  function rebuildRoster(
    nextMode: MultiMode,
    count: number,
    nextDifficulty: BotDifficulty,
  ): PlayerConfig[] {
    const list: PlayerConfig[] = [];
    for (let i = 0; i < count; i++) {
      const existing = players[i];
      if (nextMode === "vs_bots") {
        // Premier joueur = user humain, le reste = bots
        if (i === 0) {
          list.push({
            pseudo: existing?.isBot ? userPseudo : (existing?.pseudo ?? userPseudo),
            isBot: false,
            id: existing?.id ?? newPlayerId(),
          });
        } else {
          list.push({
            pseudo: existing?.isBot
              ? (existing.pseudo ?? defaultBotName(i - 1, nextDifficulty))
              : defaultBotName(i - 1, nextDifficulty),
            isBot: true,
            id: existing?.id ?? newPlayerId(),
          });
        }
      } else {
        // Humains locaux
        list.push({
          pseudo: existing && !existing.isBot
            ? existing.pseudo
            : i === 0
              ? userPseudo
              : "",
          isBot: false,
          id: existing?.id ?? newPlayerId(),
        });
      }
    }
    return list;
  }

  function handlePickMode(m: MultiMode) {
    setMode(m);
    setPlayers(rebuildRoster(m, players.length, botDifficulty));
    if (m === "vs_bots") setPhase("roster");
    else setPhase("humans-subpick");
  }

  function handlePickDifficulty(d: BotDifficulty) {
    setBotDifficulty(d);
    setPlayers((prev) =>
      prev.map((p, i) =>
        p.isBot ? { ...p, pseudo: defaultBotName(i - 1, d) } : p,
      ),
    );
  }

  function handleChangeCount(delta: 1 | -1) {
    const next = Math.max(
      MIN_PLAYERS,
      Math.min(maxPlayers, players.length + delta),
    );
    setPlayers(rebuildRoster(mode, next, botDifficulty));
  }

  function handleToggleOfficial(nextOfficial: boolean) {
    setIsOfficialRules(nextOfficial);
    const cap = nextOfficial ? OFFICIAL_MAX_PLAYERS : FREE_MAX_PLAYERS;
    if (players.length > cap) {
      setPlayers(rebuildRoster(mode, cap, botDifficulty));
    }
  }

  function handleChangePseudo(index: number, value: string) {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, pseudo: value } : p)),
    );
  }

  function handleSubmit() {
    const config: MultiConfig = {
      mode,
      players: players.map((p) => ({ ...p, pseudo: p.pseudo.trim() })),
      botDifficulty: mode === "vs_bots" ? botDifficulty : undefined,
      isOfficialRules,
    };
    const error = validateMultiConfig(config);
    if (error) {
      // Erreur affichée dans le roster
      return;
    }
    onReady(config);
  }

  const validationError = (() => {
    const config: MultiConfig = {
      mode,
      players: players.map((p) => ({ ...p, pseudo: p.pseudo.trim() })),
      botDifficulty: mode === "vs_bots" ? botDifficulty : undefined,
      isOfficialRules,
    };
    return validateMultiConfig(config);
  })();

  // --- Phase 1 : choix vs Bots / vs Humains ---------------------------------
  if (phase === "mode") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gold/20 text-gold-warm">
          <Users className="h-10 w-10" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold uppercase tracking-widest text-gold-warm">
            Préparation
          </p>
          <h1 className="font-display text-4xl font-extrabold text-navy">
            {gameLabel}
          </h1>
          <p className="text-navy/70">Tu joues contre qui ?</p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2">
          <BigChoiceCard
            label="Contre des Bots"
            desc="Entraîne-toi solo, plusieurs niveaux"
            icon={Bot}
            onClick={() => handlePickMode("vs_bots")}
          />
          <BigChoiceCard
            label="Contre des humains"
            desc="Plusieurs joueurs, même appareil"
            icon={Users}
            onClick={() => handlePickMode("vs_humans_local")}
          />
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-navy/70 hover:border-navy/40"
          >
            Retour
          </button>
        )}
      </main>
    );
  }

  // --- Phase 2 : Humains → Local ou En ligne --------------------------------
  if (phase === "humans-subpick") {
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
            label="En local"
            desc="Un seul appareil, on se le passe"
            icon={Users}
            onClick={() => {
              setMode("vs_humans_local");
              setPlayers(
                rebuildRoster("vs_humans_local", players.length, botDifficulty),
              );
              setPhase("roster");
            }}
          />
          <BigChoiceCard
            label="En ligne"
            desc="Bientôt — sur appareils séparés"
            icon={Wifi}
            disabled
            badge="Bientôt"
          />
        </div>

        <button
          type="button"
          onClick={() => setPhase("mode")}
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-navy/70 hover:border-navy/40"
        >
          Retour
        </button>
      </main>
    );
  }

  // --- Phase 3 : Roster (règles + nombre + noms) ----------------------------
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-1 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
          {gameLabel} · Configuration
        </p>
        <h1 className="font-display text-3xl font-extrabold text-navy">
          Les joueurs
        </h1>
      </div>

      {/* Toggle règles officielles */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
        <div className="text-left">
          <p className="font-display text-sm font-bold text-navy">
            Règles officielles
          </p>
          <p className="text-xs text-navy/60">
            {isOfficialRules
              ? `4 joueurs max (comme à la TV)`
              : `Libre, jusqu'à ${FREE_MAX_PLAYERS} joueurs`}
          </p>
        </div>
        <ToggleSwitch
          checked={isOfficialRules}
          onChange={handleToggleOfficial}
          label="Règles officielles (4 joueurs max)"
        />
      </div>

      {/* Difficulté bot (seulement vs_bots) */}
      {mode === "vs_bots" && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-navy/50">
            Difficulté des bots
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["facile", "moyen", "difficile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handlePickDifficulty(d)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-semibold capitalize transition-all",
                  botDifficulty === d
                    ? "border-gold bg-gold/20 text-navy shadow-[0_2px_0_0_#e89e00]"
                    : "border-border bg-white text-navy/70 hover:border-gold/40 hover:bg-gold/5",
                )}
              >
                {d}
                <span className="ml-1 text-xs opacity-60">
                  ({Math.round(BOT_PROFILES[d].correctProbability * 100)} %)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nombre de joueurs */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
        <div className="text-left">
          <p className="font-display text-sm font-bold text-navy">
            Joueurs : {players.length}
          </p>
          <p className="text-xs text-navy/60">
            Min {MIN_PLAYERS} · Max {maxPlayers}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleChangeCount(-1)}
            disabled={players.length <= MIN_PLAYERS}
            aria-label="Moins un joueur"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-navy hover:border-gold/50 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleChangeCount(1)}
            disabled={players.length >= maxPlayers}
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
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-white p-3"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                p.isBot
                  ? "bg-sky/15 text-sky"
                  : "bg-gold/20 text-gold-warm",
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
          </li>
        ))}
      </ul>

      {validationError && (
        <p
          className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-center text-sm text-buzz"
          role="alert"
        >
          {validationError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            setPhase(mode === "vs_bots" ? "mode" : "humans-subpick")
          }
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-navy/70 hover:border-navy/40"
        >
          Retour
        </button>
        <Button
          variant="gold"
          size="lg"
          disabled={validationError !== null}
          onClick={handleSubmit}
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
