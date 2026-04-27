"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Camera,
  Check,
  Crown,
  Loader2,
  Lock,
  Minus,
  Play,
  Plus,
  Trophy,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { uploadAvatarClient } from "@/lib/avatar-upload";
import { BOT_PROFILES, type BotDifficulty } from "@/lib/game-logic/faceAFace";
import { DC_MAX_PLAYERS, DC_MIN_PLAYERS } from "@/lib/game-logic/douze-coups";
import type { SavedPlayer } from "@/lib/saved-players/actions";
import { cn } from "@/lib/utils";

type SubPhase = "mode" | "humans-subpick" | "config";
type Adversary = "bots" | "humans_local";

export interface DcSetupResult {
  players: Array<{
    pseudo: string;
    isBot: boolean;
    botLevel?: BotDifficulty;
    avatarUrl?: string | null;
    /** Opt-in pour la sauvegarde BDD à la fin de la partie. */
    saveToBdd?: boolean;
  }>;
}

interface SetupScreenProps {
  userPseudo: string;
  /** Avatar du compte connecté (pré-remplit le slot 0). Modif éphémère possible. */
  userAvatarUrl?: string | null;
  savedPlayers?: SavedPlayer[];
  onReady: (result: DcSetupResult) => void;
}

interface LocalPlayer {
  pseudo: string;
  isBot: boolean;
  botLevel?: BotDifficulty;
  /** Avatar humain (URL Storage). Null si pas de photo choisie. */
  avatarUrl?: string | null;
  /**
   * Si true ET joueur humain (slot ≥ 1), le joueur est sauvegardé en BDD
   * à la fin de la partie (saved_players). Par défaut FALSE — opt-in
   * explicite (cf. Bug #8 du plan post-tests).
   */
  saveToBdd?: boolean;
}

/**
 * Écran de configuration du mode 12 Coups de Midi.
 *  1. Choix Bots / Humains
 *  2. Si Humains : Local (actif) / En ligne (désactivé, bientôt)
 *  3. Roster : 2 à 4 joueurs, avec possibilité de mixer humains + bots
 *     et de régler la difficulté de chaque bot individuellement.
 */
export function DcSetupScreen({
  userPseudo,
  userAvatarUrl = null,
  savedPlayers = [],
  onReady,
}: SetupScreenProps) {
  const [subPhase, setSubPhase] = useState<SubPhase>("mode");
  const [adversary, setAdversary] = useState<Adversary>("bots");
  const [fillWithBots, setFillWithBots] = useState(true);
  const [players, setPlayers] = useState<LocalPlayer[]>(() => [
    { pseudo: userPseudo, isBot: false, avatarUrl: userAvatarUrl },
    { pseudo: "Bot 1", isBot: true, botLevel: "moyen" },
    { pseudo: "Bot 2", isBot: true, botLevel: "moyen" },
    { pseudo: "Bot 3", isBot: true, botLevel: "moyen" },
  ]);
  // Modal "Mes joueurs". DOIT rester au-dessus des early returns
  // (subPhase === "mode" / "humans-subpick") pour respecter les Rules
  // of Hooks : le nombre de hooks doit être identique à chaque render.
  const [showMyPlayers, setShowMyPlayers] = useState(false);

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
          <h1 className="font-display text-4xl font-extrabold text-foreground">
            Prépare la partie
          </h1>
          <p className="text-foreground/70">Tu joues contre qui ?</p>
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
        <h1 className="font-display text-3xl font-extrabold text-foreground">
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
                { pseudo: userPseudo, isBot: false, avatarUrl: userAvatarUrl },
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
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/70 hover:border-navy/40"
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

  /**
   * Quand l'utilisateur sélectionne un joueur déjà sauvegardé via
   * l'autocomplétion, on remplit pseudo + avatar du slot d'un coup.
   */
  function handlePickSavedPlayer(i: number, sp: SavedPlayer) {
    setPlayers((prev) =>
      prev.map((p, idx) =>
        idx === i
          ? { ...p, pseudo: sp.pseudo, avatarUrl: sp.avatarUrl }
          : p,
      ),
    );
  }

  function handleSetAvatar(i: number, url: string | null) {
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, avatarUrl: url } : p)),
    );
  }

  function handleToggleSave(i: number, save: boolean) {
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, saveToBdd: save } : p)),
    );
  }

  /**
   * Ajoute un joueur sauvegardé à un slot HUMAIN vide (sauf slot 0 = user).
   * Si tous les slots humains sont remplis, on n'ajoute pas (no-op).
   */
  function handleAddFromSaved(sp: SavedPlayer) {
    setPlayers((prev) => {
      const targetIdx = prev.findIndex(
        (p, i) => i > 0 && !p.isBot && !p.pseudo.trim(),
      );
      if (targetIdx === -1) return prev;
      return prev.map((p, idx) =>
        idx === targetIdx
          ? {
              ...p,
              pseudo: sp.pseudo,
              avatarUrl: sp.avatarUrl,
              // Pré-coche la case "enregistrer" pour qu'on bump leurs stats
              saveToBdd: true,
            }
          : p,
      );
    });
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
            avatarUrl: null,
          };
        }
        return { pseudo: "", isBot: false, avatarUrl: null };
      }),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
            12 Coups de Midi · Configuration
          </p>
          <h1 className="font-display text-3xl font-extrabold text-foreground">
            Les joueurs
          </h1>
        </div>
        {adversary === "humans_local" && savedPlayers.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMyPlayers(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-bold text-gold-warm hover:border-gold hover:bg-gold/20"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            Mes joueurs
          </button>
        )}
      </div>

      {/* Fill with bots (seulement en humains local) */}
      {adversary === "humans_local" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="text-left">
            <p className="font-display text-sm font-bold text-foreground">
              Compléter avec des bots
            </p>
            <p className="text-xs text-foreground/60">
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
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="text-left">
          <p className="font-display text-sm font-bold text-foreground">
            Joueurs : {players.length}
          </p>
          <p className="text-xs text-foreground/60">
            Min {DC_MIN_PLAYERS} · Max {DC_MAX_PLAYERS}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleChangeCount(-1)}
            disabled={players.length <= DC_MIN_PLAYERS}
            aria-label="Moins un joueur"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:border-gold/50 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleChangeCount(1)}
            disabled={players.length >= DC_MAX_PLAYERS}
            aria-label="Un joueur de plus"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:border-gold/50 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
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
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-3">
              {/* Slot photo : pour humain on peut cliquer pour upload,
                  pour bot on garde l'icône Bot non interactive. */}
              {p.isBot ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky/15 text-sky">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </div>
              ) : (
                // Slot 0 (toi) ET slots 2+ : tous éditables. Le slot 0
                // est pré-rempli depuis Paramètres → Profil mais peut
                // être modifié EPHEMÈREMENT pour cette partie (l'edit
                // ne touche pas au profil).
                <PlayerAvatarSlot
                  avatarUrl={p.avatarUrl}
                  pseudo={p.pseudo}
                  onChange={(url) => handleSetAvatar(i, url)}
                />
              )}
              {/* Pseudo + autocomplete : slot 0 = simple input éditable
                  (pas d'autosuggestion, c'est ton profil), slots 2+ avec
                  autocomplete sur les saved_players. */}
              {!p.isBot && i > 0 ? (
                <PseudoAutocomplete
                  value={p.pseudo}
                  onChange={(v) => handleChangePseudo(i, v)}
                  onPick={(sp) => handlePickSavedPlayer(i, sp)}
                  savedPlayers={savedPlayers}
                  // E1.2 — exclude pseudos already used in d'autres slots
                  // (slot courant inclus dans `players` avec sa propre
                  // valeur, donc on l'exclut explicitement).
                  excludePseudos={
                    new Set(
                      players
                        .filter((_, idx) => idx !== i)
                        .map((pl) => pl.pseudo.trim().toLowerCase())
                        .filter((s) => s.length > 0),
                    )
                  }
                  placeholder={`Joueur ${i + 1}`}
                />
              ) : (
                <input
                  type="text"
                  value={p.pseudo}
                  onChange={(e) => handleChangePseudo(i, e.target.value)}
                  readOnly={p.isBot}
                  maxLength={24}
                  placeholder={p.isBot ? "" : `Joueur ${i + 1}`}
                  className={cn(
                    "h-10 flex-1 rounded-md border border-border bg-card px-3 text-base text-foreground focus:border-gold focus:outline-none",
                    p.isBot && "cursor-not-allowed bg-navy/5",
                  )}
                />
              )}
              <span className="text-xs uppercase tracking-wider text-foreground/40">
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
                  className="h-9 rounded-md border border-border bg-card px-2 text-xs font-semibold text-foreground focus:border-gold focus:outline-none"
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
            {/* Toggle "Enregistrer ce joueur" — visible uniquement pour
                les humains slots ≥ 1 (le slot 0 = compte connecté est
                déjà géré ailleurs). Opt-in : décoché par défaut.
                F4.1 — Si le slot correspond exactement à un saved_player
                existant (pseudo lower-trimmé identique + avatarUrl
                identique), on masque le toggle et on affiche un badge
                "Joueur sauvegardé" en vert. Si l'user modifie quoi que
                ce soit, le toggle réapparaît. */}
            {!p.isBot &&
              i > 0 &&
              p.pseudo.trim().length > 0 &&
              (() => {
                const exactMatch = savedPlayers.find(
                  (sp) =>
                    sp.pseudo.trim().toLowerCase() ===
                      p.pseudo.trim().toLowerCase() &&
                    (sp.avatarUrl ?? null) === (p.avatarUrl ?? null),
                );
                if (exactMatch) {
                  return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-life-green/15 px-2 py-0.5 text-[11px] font-bold text-life-green sm:ml-2">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Joueur sauvegardé
                    </span>
                  );
                }
                return (
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-foreground/70 sm:ml-2">
                    <input
                      type="checkbox"
                      checked={p.saveToBdd ?? false}
                      onChange={(e) => handleToggleSave(i, e.target.checked)}
                      className="h-3.5 w-3.5 accent-gold"
                    />
                    Enregistrer ce joueur
                  </label>
                );
              })()}
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

      {/* Modal "Mes joueurs" : popup avec cards des saved_players,
          clic sur une card → ajout au prochain slot humain vide. */}
      <MyPlayersModal
        open={showMyPlayers}
        onClose={() => setShowMyPlayers(false)}
        savedPlayers={savedPlayers}
        currentPseudos={players.map((p) => p.pseudo.toLowerCase().trim())}
        onPick={(sp) => {
          handleAddFromSaved(sp);
          setShowMyPlayers(false);
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            setSubPhase(adversary === "bots" ? "mode" : "humans-subpick")
          }
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/70 hover:border-navy/40"
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
                avatarUrl: p.avatarUrl ?? null,
                saveToBdd: p.saveToBdd ?? false,
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
// MyPlayersModal — popup d'ajout rapide depuis saved_players
// =============================================================================

function MyPlayersModal({
  open,
  onClose,
  savedPlayers,
  currentPseudos,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  savedPlayers: SavedPlayer[];
  currentPseudos: string[];
  onPick: (sp: SavedPlayer) => void;
}) {
  // Échap = ferme
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-navy/60 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Mes joueurs sauvegardés"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold text-foreground">
                Mes joueurs sauvegardés
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/40 text-foreground/60 hover:border-foreground/30 hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mb-3 text-xs text-foreground/60">
              Clique sur un joueur pour l&apos;ajouter au prochain slot vide.
            </p>

            {savedPlayers.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background/40 p-4 text-center text-sm text-foreground/60">
                Aucun joueur sauvegardé. Coche &laquo;&nbsp;Enregistrer ce
                joueur&nbsp;&raquo; pendant le setup pour les mémoriser.
              </p>
            ) : (
              <ul className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {savedPlayers.map((sp) => {
                  const alreadyAdded = currentPseudos.includes(
                    sp.pseudo.toLowerCase().trim(),
                  );
                  return (
                    <li key={sp.id}>
                      <button
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => onPick(sp)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                          alreadyAdded
                            ? "cursor-not-allowed border-border bg-background/30 opacity-50"
                            : "border-border bg-card hover:border-gold hover:bg-gold/10 hover:scale-[1.01]",
                        )}
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gold/15">
                          {sp.avatarUrl ? (
                            <Image
                              src={sp.avatarUrl}
                              alt=""
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <Crown
                              className="h-5 w-5 text-gold-warm"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <div className="flex-1">
                          <p className="font-display text-sm font-extrabold text-foreground">
                            {sp.pseudo}
                          </p>
                          <p className="text-[11px] text-foreground/60">
                            {sp.gamesPlayed} parties · {sp.gamesWon} victoires
                          </p>
                          {alreadyAdded && (
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gold-warm">
                              Déjà ajouté
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// PlayerAvatarSlot — avatar cliquable + upload
// =============================================================================

function PlayerAvatarSlot({
  avatarUrl,
  pseudo,
  onChange,
  disabled = false,
}: {
  avatarUrl: string | null | undefined;
  pseudo: string;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState(false);

  function openPicker() {
    if (disabled || uploading) return;
    inputRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const res = await uploadAvatarClient(
      file,
      "saved-players-avatars",
      "player",
    );
    setUploading(false);
    // Réinitialise l'input pour pouvoir re-sélectionner le même fichier
    if (inputRef.current) inputRef.current.value = "";
    if (res.status === "ok") onChange(res.url);
    else setError(res.message);
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled || uploading}
        aria-label={
          avatarUrl
            ? `Changer la photo de ${pseudo || "ce joueur"}`
            : `Ajouter une photo pour ${pseudo || "ce joueur"}`
        }
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-gold/10 transition-all",
          !disabled && "hover:border-gold hover:bg-gold/20",
          disabled && "cursor-not-allowed opacity-90",
        )}
        title={
          disabled
            ? "Modifie ton avatar dans Paramètres → Profil"
            : "Ajouter / changer la photo"
        }
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <Crown className="h-5 w-5 text-gold-warm" aria-hidden="true" />
        )}
        {!disabled && !avatarUrl && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-on-color">
            <Camera className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-navy/40">
            <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden="true" />
          </span>
        )}
      </button>
      {/* Croix retirer photo : visible AU HOVER uniquement, et bien
          décalée en haut-droite avec un cercle blanc d'isolement
          (Vague D.9.a). Sur tactile, le hover persiste après le tap
          → utilisable au doigt aussi. */}
      {avatarUrl && !disabled && hover && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          aria-label="Retirer la photo"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-buzz text-white shadow-md transition-transform hover:scale-110"
        >
          <X className="h-2.5 w-2.5" aria-hidden="true" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {error && (
        <p className="absolute left-0 top-full mt-0.5 whitespace-nowrap text-[10px] text-buzz">
          {error}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// PseudoAutocomplete — input pseudo + dropdown saved_players
// =============================================================================

function PseudoAutocomplete({
  value,
  onChange,
  onPick,
  savedPlayers,
  placeholder,
  excludePseudos,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (sp: SavedPlayer) => void;
  savedPlayers: SavedPlayer[];
  placeholder?: string;
  /**
   * E1.2 — Pseudos (lowercase trimmed) déjà utilisés dans d'autres slots
   * du setup. Filtrés de la liste des suggestions pour empêcher le double
   * ajout du même joueur.
   */
  excludePseudos?: Set<string>;
}) {
  const [focused, setFocused] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const filteredByExclusion = excludePseudos
      ? savedPlayers.filter(
          (sp) => !excludePseudos.has(sp.pseudo.trim().toLowerCase()),
        )
      : savedPlayers;
    const list = q
      ? filteredByExclusion.filter((sp) =>
          sp.pseudo.toLowerCase().includes(q),
        )
      : filteredByExclusion;
    return list.slice(0, 5);
  }, [value, savedPlayers, excludePseudos]);

  const hasMore = useMemo(() => {
    const q = value.trim().toLowerCase();
    const filteredByExclusion = excludePseudos
      ? savedPlayers.filter(
          (sp) => !excludePseudos.has(sp.pseudo.trim().toLowerCase()),
        )
      : savedPlayers;
    const totalMatching = q
      ? filteredByExclusion.filter((sp) =>
          sp.pseudo.toLowerCase().includes(q),
        ).length
      : filteredByExclusion.length;
    return totalMatching > 5;
  }, [value, savedPlayers, excludePseudos]);

  // Reset l'index sur changement de suggestions
  useEffect(() => {
    setHighlightedIdx(0);
  }, [value]);

  // Échap ferme la dropdown
  useEffect(() => {
    if (!focused) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFocused(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused]);

  // Clic extérieur = ferme
  useEffect(() => {
    if (!focused) return;
    function onPointer(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [focused]);

  // On affiche le dropdown si focus + il y a au moins une suggestion
  // qui n'est pas un match exact (sinon c'est juste une redite).
  const showDropdown =
    focused &&
    suggestions.length > 0 &&
    !(suggestions.length === 1 && suggestions[0]!.pseudo === value);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const sp = suggestions[highlightedIdx];
      if (sp) {
        e.preventDefault();
        onPick(sp);
        setFocused(false);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        maxLength={24}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-border bg-card px-3 text-base text-foreground focus:border-gold focus:outline-none"
      />
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            role="listbox"
          >
            <p className="border-b border-border bg-background/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground/50">
              Joueurs déjà utilisés
            </p>
            <ul className="max-h-64 overflow-y-auto">
              {suggestions.map((sp, idx) => {
                const isHighlighted = idx === highlightedIdx;
                return (
                  <li key={sp.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onPick(sp);
                        setFocused(false);
                      }}
                      onMouseEnter={() => setHighlightedIdx(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground transition-colors",
                        isHighlighted ? "bg-gold/15" : "hover:bg-gold/10",
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold/15">
                        {sp.avatarUrl ? (
                          <Image
                            src={sp.avatarUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <Crown
                            className="h-4 w-4 text-gold-warm"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="flex-1 truncate font-bold">
                        {sp.pseudo}
                      </span>
                      <span className="hidden items-center gap-2 text-[10px] uppercase tracking-wider text-foreground/50 sm:flex">
                        <span className="inline-flex items-center gap-1">
                          <Play className="h-3 w-3" aria-hidden="true" />
                          {sp.gamesPlayed}
                        </span>
                        <span className="inline-flex items-center gap-1 text-gold-warm">
                          <Trophy className="h-3 w-3" aria-hidden="true" />
                          {sp.gamesWon}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {hasMore && (
                <li>
                  <Link
                    href="/parametres/joueurs"
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-gold-warm hover:bg-gold/5"
                  >
                    <span>Voir tous mes joueurs</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
          : "border-border bg-card hover:border-gold/50 hover:bg-gold/5 hover:scale-[1.02]",
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-xl",
          disabled ? "bg-navy/10 text-foreground/40" : "bg-gold/20 text-gold-warm",
        )}
      >
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="font-display text-lg font-bold text-foreground">{label}</div>
      <p className="text-xs text-foreground/60">{desc}</p>
      {badge && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
          <Lock className="h-3 w-3" aria-hidden="true" />
          {badge}
        </span>
      )}
    </button>
  );
}
