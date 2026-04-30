"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Bell,
  Check,
  Info,
  Key,
  Keyboard,
  Loader2,
  Mail,
  Mic,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Shield,
  Sun,
  Trophy,
  Upload,
  User,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTheme } from "next-themes";
import { ShortcutsPanel } from "@/components/parametres/ShortcutsPanel";
import { VoiceInstallHelp } from "@/components/parametres/VoiceInstallHelp";
import { AvatarPicker } from "@/components/avatars/AvatarPicker";
import {
  fetchNotificationSettings,
  saveNotificationSettings,
} from "@/lib/notifications/actions";
import {
  DAY_LABELS,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from "@/lib/notifications/types";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  DEFAULT_SETTINGS,
  useSettingsStore,
  type UserSettings,
} from "@/lib/settings";
import { createClient as createSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { uploadAvatarClient } from "@/lib/avatar-upload";
import {
  frenchVoices,
  isTtsSupported,
  loadVoices,
  ttsSpeak,
  ttsStop,
} from "@/lib/tts";
import { saveProfile, saveUserSettings } from "./actions";
import { BUILD_VERSION } from "@/lib/build-info";
import { PasswordInput } from "@/components/ui/PasswordInput";

export interface ParametresInitial {
  email: string;
  pseudo: string;
  avatarUrl: string | null;
  theme: "light" | "dark" | "system";
  xp: number;
  niveau: number;
  role: "user" | "admin";
  settings: Partial<UserSettings>;
}

type TabId =
  | "apparence"
  | "audio"
  | "profil"
  | "notifs"
  | "raccourcis"
  | "compte";

const TABS: Array<{ id: TabId; label: string; icon: typeof Palette }> = [
  { id: "apparence", label: "Apparence", icon: Palette },
  { id: "audio", label: "Audio & Voix", icon: Volume2 },
  { id: "profil", label: "Profil", icon: User },
  { id: "notifs", label: "Notifications", icon: Bell },
  { id: "raccourcis", label: "Raccourcis", icon: Keyboard },
  { id: "compte", label: "Compte", icon: Trophy },
];

export function ParametresClient({ initial }: { initial: ParametresInitial }) {
  const [tab, setTab] = useState<TabId>("apparence");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
          Paramètres
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-foreground">
          Réglages
        </h1>
        <p className="mt-1 text-foreground/70">
          Personnalise l&apos;app, ton audio et ton profil.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
              tab === id
                ? "border-gold bg-gold/15 text-foreground"
                : "border-border bg-card text-foreground/70 hover:border-gold/50 hover:bg-gold/10",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "apparence" && <AppearancePanel initialTheme={initial.theme} />}
      {tab === "audio" && <AudioVoicePanel initial={initial.settings} />}
      {tab === "profil" && (
        <ProfilePanel
          initialPseudo={initial.pseudo}
          initialAvatarUrl={initial.avatarUrl}
          email={initial.email}
        />
      )}
      {tab === "notifs" && <NotifsPanel initial={initial.settings} />}
      {tab === "raccourcis" && <ShortcutsPanel />}
      {tab === "compte" && (
        <AccountPanel
          email={initial.email}
          pseudo={initial.pseudo}
          xp={initial.xp}
          niveau={initial.niveau}
          role={initial.role}
        />
      )}
    </main>
  );
}

// ===========================================================================
// Apparence (thème)
// ===========================================================================

function AppearancePanel({
  initialTheme,
}: {
  initialTheme: "light" | "dark" | "system";
}) {
  const { theme: current, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const active = (current ?? initialTheme) as "light" | "dark" | "system";

  function pick(next: "light" | "dark" | "system") {
    setTheme(next);
    startTransition(async () => {
      const res = await saveProfile({ theme: next });
      if (res.status === "ok") {
        setFeedback("Thème enregistré.");
      } else {
        setFeedback(`Erreur : ${res.message}`);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 glow-card">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">Thème</h2>
        <p className="text-sm text-foreground/70">
          Choisis l&apos;apparence de l&apos;app.
        </p>
      </div>
      {/* L3.1 — Mode "Système" retiré (enableSystem={false} dans
          ThemeProvider) — l'app est en clair par défaut, le user
          peut basculer en sombre s'il préfère. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ThemeChoiceCard
          label="Clair"
          icon={Sun}
          active={active === "light" || active === "system"}
          onClick={() => pick("light")}
        />
        <ThemeChoiceCard
          label="Sombre"
          icon={Moon}
          active={active === "dark"}
          onClick={() => pick("dark")}
        />
      </div>
      {feedback && (
        <p className="text-xs text-foreground/60">
          {pending ? "…" : feedback}
        </p>
      )}
    </section>
  );
}

function ThemeChoiceCard({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Sun;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all",
        active
          ? "border-gold bg-gold/15 shadow-[0_0_24px_rgba(245,183,0,0.3)]"
          : "border-border bg-card hover:border-gold/40 hover:bg-gold/5",
      )}
    >
      <Icon className="h-7 w-7 text-gold-warm" aria-hidden="true" />
      <span className="font-display text-sm font-bold text-foreground">
        {label}
      </span>
    </button>
  );
}

// ===========================================================================
// Audio & Voix
// ===========================================================================

function AudioVoicePanel({ initial }: { initial: Partial<UserSettings> }) {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function patch(p: Partial<UserSettings>) {
    update(p);
    startTransition(async () => {
      const res = await saveUserSettings(p);
      if (res.status === "ok") {
        setFeedback("Enregistré");
      } else {
        setFeedback(`Erreur : ${res.message}`);
      }
    });
  }

  // Initial-merge fallback (si store pas encore hydraté côté client)
  const ttsAuto = settings.ttsAutoPlay ?? initial.ttsAutoPlay ?? DEFAULT_SETTINGS.ttsAutoPlay;
  const voice =
    settings.voiceRecognition ??
    initial.voiceRecognition ??
    DEFAULT_SETTINGS.voiceRecognition;
  const muted = settings.muted ?? initial.muted ?? DEFAULT_SETTINGS.muted;
  const volume = settings.volume ?? initial.volume ?? DEFAULT_SETTINGS.volume;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 glow-card">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">
          Audio & Voix
        </h2>
        <p className="text-sm text-foreground/70">
          Sons, audition (lecture des questions) et reconnaissance vocale.
        </p>
      </div>

      <Row
        label="Mode TV (lit auto les questions)"
        desc="L'énoncé est lu à voix haute dès qu'une question apparaît."
        icon={Volume2}
        right={
          <ToggleSwitch
            checked={ttsAuto}
            onChange={(v) => patch({ ttsAutoPlay: v })}
            label="Mode TV"
          />
        }
      />
      <Row
        label="Reconnaissance vocale"
        desc="Active le micro pour répondre à la voix."
        icon={Mic}
        right={
          <ToggleSwitch
            checked={voice}
            onChange={(v) => patch({ voiceRecognition: v })}
            label="Reconnaissance vocale"
          />
        }
      />
      <Row
        label="Mute global"
        desc="Coupe sons synthétisés et lecture vocale."
        icon={muted ? VolumeX : Volume2}
        right={
          <ToggleSwitch
            checked={muted}
            onChange={(v) => patch({ muted: v })}
            label="Mute"
          />
        }
      />
      <Row
        label="Volume"
        desc={`${Math.round(volume * 100)} %`}
        icon={Volume2}
        right={
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => patch({ volume: Number(e.target.value) / 100 })}
            className="w-32 accent-gold"
            aria-label="Volume"
          />
        }
      />

      {/* ----- Voix de lecture (TTS) ----- */}
      <VoiceSelector initial={initial} onPatch={patch} />

      {feedback && <p className="text-xs text-foreground/60">{feedback}</p>}
    </section>
  );
}

// ===========================================================================
// Voix de lecture (TTS) — sélecteur + sliders + Tester
// ===========================================================================

const TEST_PHRASE =
  "Bonjour, je suis votre voix pour Les 12 coups de Mahylan. À toi de jouer !";

function VoiceSelector({
  initial,
  onPatch,
}: {
  initial: Partial<UserSettings>;
  onPatch: (p: Partial<UserSettings>) => void;
}) {
  const settings = useSettingsStore((s) => s.settings);
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Toggle pour montrer toutes les voix (français inclus + autres langues).
  // Utile sur Chrome desktop qui propose une dizaine de voix Google neurales
  // dans d'autres langues, certaines très naturelles même pour lire du fr.
  const [showAllLanguages, setShowAllLanguages] = useState(false);

  // Au mount : on charge la liste complète des voix (avec fallback
  // voiceschanged Chrome). On stocke TOUT, le filtre se fait au render.
  useEffect(() => {
    if (!isTtsSupported()) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    loadVoices().then((all) => {
      if (cancelled) return;
      setAllVoices(all);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
      ttsStop();
    };
  }, []);

  const voices = showAllLanguages ? allVoices : frenchVoices(allVoices);

  const selectedUri =
    settings.ttsVoiceUri ?? initial.ttsVoiceUri ?? null;
  const rate = settings.ttsRate ?? initial.ttsRate ?? DEFAULT_SETTINGS.ttsRate;
  const pitch = settings.ttsPitch ?? initial.ttsPitch ?? DEFAULT_SETTINGS.ttsPitch;
  const volume = settings.volume ?? initial.volume ?? DEFAULT_SETTINGS.volume;

  function test() {
    void ttsSpeak(TEST_PHRASE, {
      voiceUri: selectedUri,
      rate,
      pitch,
      volume,
    });
  }

  if (!isTtsSupported()) {
    return (
      <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-foreground/70">
        La synthèse vocale n&apos;est pas supportée par ton navigateur.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky/15 text-sky">
          <Volume2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-sm font-bold text-foreground">
            Voix de lecture
          </p>
          <p className="text-xs text-foreground/60">
            Choix de la voix française, vitesse et hauteur. Test en direct.
          </p>
        </div>
      </div>

      {loaded && voices.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-xs text-buzz">
            Aucune voix française détectée. Tu peux essayer{" "}
            <strong>Toutes les langues</strong> ci-dessous, ou installer une
            voix française dans les paramètres système de ton appareil.
          </p>
          <label className="flex items-center gap-2 text-xs text-foreground/70">
            <input
              type="checkbox"
              checked={showAllLanguages}
              onChange={(e) => setShowAllLanguages(e.target.checked)}
              className="accent-gold"
            />
            Afficher toutes les langues ({allVoices.length} voix)
          </label>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between text-foreground/80">
              <span className="font-semibold">Voix</span>
              <span className="text-[11px] text-foreground/50">
                {voices.length} dispo{voices.length > 1 ? "s" : ""}
                {showAllLanguages ? " (toutes langues)" : " (français)"}
              </span>
            </span>
            <select
              value={selectedUri ?? ""}
              onChange={(e) =>
                onPatch({ ttsVoiceUri: e.target.value || null })
              }
              className="h-10 rounded-md border border-border bg-card px-2 text-sm text-foreground focus:border-gold focus:outline-none"
            >
              <option value="">Voix par défaut du navigateur</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} — {countryFromLang(v.lang)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-foreground/70">
            <input
              type="checkbox"
              checked={showAllLanguages}
              onChange={(e) => setShowAllLanguages(e.target.checked)}
              className="accent-gold"
            />
            Afficher aussi les voix d&apos;autres langues
            <span className="text-[10px] text-foreground/40">
              ({allVoices.length - frenchVoices(allVoices).length} en plus)
            </span>
          </label>

          {/* Notice install voix : proactive si on a très peu de voix FR
              (≤ 2), sinon discrète. Modal avec mini-tuto Win/Mac/Android. */}
          <VoiceInstallHelp
            proactive={frenchVoices(allVoices).length <= 2}
          />

          <SliderRow
            label="Vitesse"
            value={rate}
            min={0.5}
            max={2}
            step={0.05}
            displayed={`${rate.toFixed(2)}×`}
            onChange={(v) => onPatch({ ttsRate: v })}
          />
          <SliderRow
            label="Hauteur"
            value={pitch}
            min={0.5}
            max={2}
            step={0.05}
            displayed={pitch.toFixed(2)}
            onChange={(v) => onPatch({ ttsPitch: v })}
          />

          <div className="flex justify-end">
            <Button variant="gold" size="sm" onClick={test}>
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              Tester
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  displayed,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayed: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 font-semibold text-foreground/80">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-gold"
        aria-label={label}
      />
      <span className="w-14 text-right tabular-nums text-foreground/60">
        {displayed}
      </span>
    </label>
  );
}

/** Tente de mapper "fr-FR", "fr-CA"… vers le pays parlé (mieux que "fr-XX"). */
function countryFromLang(lang: string): string {
  const code = lang.split("-")[1]?.toUpperCase() ?? "";
  const map: Record<string, string> = {
    FR: "France",
    CA: "Canada",
    BE: "Belgique",
    CH: "Suisse",
    LU: "Luxembourg",
  };
  return map[code] ?? lang;
}

// ===========================================================================
// Profil
// ===========================================================================

function ProfilePanel({
  initialPseudo,
  initialAvatarUrl,
  email,
}: {
  initialPseudo: string;
  initialAvatarUrl: string | null;
  email: string;
}) {
  const [pseudo, setPseudo] = useState(initialPseudo);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limite de sécurité côté navigateur (la compression réduira de toute façon).
    if (file.size > 10 * 1024 * 1024) {
      setFeedback("Image trop lourde (10 Mo max avant compression).");
      return;
    }
    setFeedback("Compression et upload…");
    startTransition(async () => {
      // 1. Upload côté client (compression 512×512 WebP + Supabase Storage)
      const upload = await uploadAvatarClient(file);
      if (upload.status === "error") {
        setFeedback(`Erreur upload : ${upload.message}`);
        return;
      }
      // 2. Update profile.avatar_url via server action (payload < 1 KB)
      const save = await saveProfile({ avatarUrl: upload.url });
      if (save.status === "ok") {
        setAvatarUrl(upload.url);
        setFeedback("Photo mise à jour.");
      } else {
        setFeedback(`Erreur enregistrement : ${save.message}`);
      }
    });
  }

  function onSavePseudo() {
    startTransition(async () => {
      const res = await saveProfile({ pseudo });
      if (res.status === "ok") {
        setFeedback("Pseudo enregistré.");
      } else {
        setFeedback(`Erreur : ${res.message}`);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 glow-card">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">Profil</h2>
        <p className="text-sm text-foreground/70">
          Pseudo et photo de profil.
        </p>
      </div>

      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-20 w-20 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gold/20 text-2xl font-extrabold text-gold-warm">
            {(pseudo[0] ?? "?").toUpperCase()}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm font-bold text-foreground hover:border-gold hover:bg-gold/20"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Choisir un avatar
          </button>
          <p className="text-xs text-foreground/50">
            Pack, génération aléatoire, ou import.
          </p>
        </div>
      </div>

      <AvatarPicker
        open={showPicker}
        currentUrl={avatarUrl}
        onClose={() => setShowPicker(false)}
        onPick={(url) => {
          startTransition(async () => {
            const save = await saveProfile({ avatarUrl: url });
            if (save.status === "ok") {
              setAvatarUrl(url);
              setFeedback("Avatar mis à jour.");
            } else setFeedback(`Erreur : ${save.message}`);
          });
        }}
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-foreground">
          Pseudo
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            maxLength={24}
            className="h-10 flex-1 rounded-md border border-border bg-card px-3 text-base text-foreground focus:border-gold focus:outline-none"
          />
          <Button
            variant="gold"
            size="default"
            onClick={onSavePseudo}
            disabled={pending || pseudo.trim() === initialPseudo}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            Enregistrer
          </Button>
        </div>
      </div>

      {feedback && <p className="text-sm text-foreground/70">{feedback}</p>}

      {/* ----- Sécurité du compte ----- */}
      <SecuritySection email={email} />
    </section>
  );
}

// ===========================================================================
// Sécurité (email + mot de passe)
// ===========================================================================

function SecuritySection({ email }: { email: string }) {
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-buzz/15 text-buzz">
          <Shield className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-sm font-bold text-foreground">
            Sécurité du compte
          </p>
          <p className="text-xs text-foreground/60">
            Email & mot de passe — actions sensibles, requièrent ton mot de
            passe actuel.
          </p>
        </div>
      </div>
      <ChangeEmailRow currentEmail={email} />
      <ChangePasswordRow />
    </div>
  );
}

function ChangeEmailRow({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  async function submit() {
    setMsg(null);
    if (!newEmail.includes("@")) {
      setMsg({ kind: "err", text: "Email invalide." });
      return;
    }
    if (newEmail === currentEmail) {
      setMsg({ kind: "err", text: "C'est déjà ton email actuel." });
      return;
    }
    setPending(true);
    const supabase = createSupabaseBrowser();
    // 1. Re-authentifie pour vérifier le mot de passe actuel
    const reauth = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    });
    if (reauth.error) {
      setPending(false);
      setMsg({ kind: "err", text: "Mot de passe actuel incorrect." });
      return;
    }
    // 2. Met à jour l'email — Supabase envoie un mail de confirmation
    const upd = await supabase.auth.updateUser({ email: newEmail });
    setPending(false);
    if (upd.error) {
      setMsg({ kind: "err", text: upd.error.message });
      return;
    }
    setMsg({
      kind: "ok",
      text: "Mail de confirmation envoyé à " +
        newEmail +
        ". Clique le lien pour valider.",
    });
    setNewEmail("");
    setCurrentPassword("");
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Mail
            className="h-4 w-4 text-foreground/60"
            aria-hidden="true"
          />
          <span className="font-mono text-foreground/80">{currentEmail}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground/70 hover:border-gold/50 hover:bg-gold/10"
        >
          {open ? "Annuler" : "Modifier"}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Nouvel email"
            autoComplete="email"
            className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          <PasswordInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Mot de passe actuel"
            autoComplete="current-password"
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          <div className="flex justify-end">
            <Button
              variant="gold"
              size="sm"
              onClick={submit}
              disabled={pending || !newEmail || !currentPassword}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              Confirmer
            </Button>
          </div>
        </div>
      )}
      {msg && (
        <p
          className={cn(
            "mt-2 text-xs",
            msg.kind === "ok" ? "text-life-green" : "text-buzz",
          )}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

function ChangePasswordRow() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function validate(): string | null {
    if (next.length < 8) return "8 caractères minimum.";
    if (!/[0-9]/.test(next)) return "Au moins 1 chiffre.";
    if (next !== confirm) return "Les deux nouveaux mots de passe diffèrent.";
    if (next === current) return "Le nouveau doit être différent de l'actuel.";
    return null;
  }

  async function submit() {
    setMsg(null);
    const v = validate();
    if (v) {
      setMsg({ kind: "err", text: v });
      return;
    }
    setPending(true);
    const supabase = createSupabaseBrowser();
    // 1. Re-auth avec le mot de passe actuel
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setPending(false);
      setMsg({ kind: "err", text: "Session invalide." });
      return;
    }
    const reauth = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (reauth.error) {
      setPending(false);
      setMsg({ kind: "err", text: "Mot de passe actuel incorrect." });
      return;
    }
    // 2. Update password
    const upd = await supabase.auth.updateUser({ password: next });
    setPending(false);
    if (upd.error) {
      setMsg({ kind: "err", text: upd.error.message });
      return;
    }
    setMsg({ kind: "ok", text: "Mot de passe modifié." });
    setCurrent("");
    setNext("");
    setConfirm("");
    setOpen(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Key className="h-4 w-4 text-foreground/60" aria-hidden="true" />
          <span className="text-foreground/80">Mot de passe</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground/70 hover:border-gold/50 hover:bg-gold/10"
        >
          {open ? "Annuler" : "Modifier"}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <PasswordInput
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Mot de passe actuel"
            autoComplete="current-password"
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          <PasswordInput
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Nouveau mot de passe (8 car. min, 1 chiffre)"
            autoComplete="new-password"
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          <PasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirme le nouveau mot de passe"
            autoComplete="new-password"
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          <div className="flex justify-end">
            <Button
              variant="gold"
              size="sm"
              onClick={submit}
              disabled={pending || !current || !next || !confirm}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              Changer
            </Button>
          </div>
        </div>
      )}
      {msg && (
        <p
          className={cn(
            "mt-2 text-xs",
            msg.kind === "ok" ? "text-life-green" : "text-buzz",
          )}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

// ===========================================================================
// Notifications
// ===========================================================================

function NotifsPanel({ initial }: { initial: Partial<UserSettings> }) {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [loadingNotif, setLoadingNotif] = useState(true);

  const pushEnabled = settings.dailyNotif ?? initial.dailyNotif ?? false;

  // Charge les préférences notifs côté serveur (E4.2/E4.3)
  useEffect(() => {
    let alive = true;
    void fetchNotificationSettings().then((s) => {
      if (!alive) return;
      setNotifSettings(s);
      setLoadingNotif(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  function patch(p: Partial<UserSettings>) {
    update(p);
    startTransition(async () => {
      const res = await saveUserSettings(p);
      if (res.status === "ok") {
        setFeedback("Enregistré");
      } else {
        setFeedback(`Erreur : ${res.message}`);
      }
    });
  }

  function patchNotif(p: Partial<NotificationSettings>) {
    const next = { ...notifSettings, ...p };
    setNotifSettings(next);
    startTransition(async () => {
      const res = await saveNotificationSettings(next);
      if (res.status === "ok") {
        setFeedback("Enregistré");
      } else {
        setFeedback(`Erreur : ${res.message}`);
      }
    });
  }

  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setFeedback("Notifications non supportées par ce navigateur.");
      return;
    }
    const result = await Notification.requestPermission();
    if (result === "granted") {
      patch({ dailyNotif: true });
    } else {
      setFeedback("Permission refusée.");
      patch({ dailyNotif: false });
    }
  }

  function toggleDay(day: number) {
    const cur = notifSettings.email_days;
    const has = cur.includes(day);
    const next = has ? cur.filter((d) => d !== day) : [...cur, day];
    patchNotif({ email_days: next.sort() });
  }

  const noneActive = !pushEnabled && !notifSettings.email_daily;

  return (
    <section className="flex flex-col gap-4">
      {/* Bandeau d'invitation si rien d'activé */}
      {noneActive && !loadingNotif && (
        <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/10 to-sky/10 p-4">
          <Bell
            className="h-6 w-6 shrink-0 text-gold-warm"
            aria-hidden="true"
          />
          <p className="text-sm text-foreground">
            <strong>Active au moins une notification</strong> pour ne pas
            perdre ton streak !
          </p>
        </div>
      )}

      {/* Récap visuel */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 text-sm",
            pushEnabled
              ? "border-life-green/40 bg-life-green/5 text-foreground"
              : "border-border bg-card text-foreground/55",
          )}
        >
          <Bell
            className={cn(
              "h-5 w-5",
              pushEnabled ? "text-life-green" : "text-foreground/40",
            )}
            aria-hidden="true"
          />
          <span className="flex-1">
            <strong className="font-bold">Push :</strong>{" "}
            {pushEnabled ? "Activées" : "Désactivées"}
          </span>
        </div>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 text-sm",
            notifSettings.email_daily
              ? "border-life-green/40 bg-life-green/5 text-foreground"
              : "border-border bg-card text-foreground/55",
          )}
        >
          <Mail
            className={cn(
              "h-5 w-5",
              notifSettings.email_daily
                ? "text-life-green"
                : "text-foreground/40",
            )}
            aria-hidden="true"
          />
          <span className="flex-1">
            <strong className="font-bold">Email quotidien :</strong>{" "}
            {notifSettings.email_daily ? "Activé" : "Désactivé"}
          </span>
        </div>
      </div>

      {/* Push browser */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 glow-card">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Notifications navigateur
          </h2>
          <p className="text-sm text-foreground/70">
            Un rappel push quand tu n&apos;as pas joué.
          </p>
        </div>

        <Row
          label="Rappel quotidien"
          desc="Une notification par jour si tu n'as pas joué."
          icon={Bell}
          right={
            <ToggleSwitch
              checked={pushEnabled}
              onChange={(v) => {
                if (v) {
                  void requestPermission();
                } else {
                  patch({ dailyNotif: false });
                }
              }}
              label="Rappel quotidien"
            />
          }
        />
      </section>

      {/* Mail quotidien (E4.2) */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 glow-card">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Email quotidien
          </h2>
          <p className="text-sm text-foreground/70">
            Reçois un mail à l&apos;heure et aux jours de ton choix si tu
            n&apos;as pas joué.
          </p>
        </div>

        <Row
          label="Recevoir un email quotidien"
          desc="Tu peux le couper à tout moment."
          icon={Mail}
          right={
            <ToggleSwitch
              checked={notifSettings.email_daily}
              onChange={(v) => patchNotif({ email_daily: v })}
              label="Email quotidien"
            />
          }
        />

        {notifSettings.email_daily && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="email-time"
                className="flex flex-col text-sm font-bold text-foreground"
              >
                Heure d&apos;envoi
                <span className="text-xs font-normal text-foreground/55">
                  Heure locale
                </span>
              </label>
              <input
                id="email-time"
                type="time"
                value={notifSettings.email_time}
                onChange={(e) =>
                  patchNotif({ email_time: e.target.value || "18:00" })
                }
                className="h-10 rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>

            <div>
              <p className="text-sm font-bold text-foreground">
                Jours de la semaine
              </p>
              <p className="mb-2 text-xs text-foreground/55">
                Coche les jours où tu veux recevoir le mail.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map(({ id, label }) => {
                  const active = notifSettings.email_days.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleDay(id)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm font-bold transition-colors",
                        active
                          ? "border-gold bg-gold/15 text-foreground"
                          : "border-border bg-card text-foreground/55 hover:border-gold/40",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-foreground/55">
              Aperçu : tu recevras un mail à{" "}
              <strong className="font-mono text-foreground">
                {notifSettings.email_time}
              </strong>{" "}
              les{" "}
              <strong className="text-foreground">
                {notifSettings.email_days.length === 7
                  ? "tous les jours"
                  : DAY_LABELS.filter((d) =>
                      notifSettings.email_days.includes(d.id),
                    )
                      .map((d) => d.label.toLowerCase())
                      .join(", ")}
              </strong>{" "}
              te rappelant de jouer.
            </p>
          </div>
        )}
      </section>

      {feedback && <p className="text-xs text-foreground/60">{feedback}</p>}
    </section>
  );
}

// ===========================================================================
// Compte (lecture seule pour l'instant)
// ===========================================================================

function AccountPanel({
  email,
  pseudo,
  niveau,
  role,
}: {
  email: string;
  pseudo: string;
  /** Conservé en prop pour signature stable, non affiché (XP visible dans /stats). */
  xp: number;
  niveau: number;
  role: "user" | "admin";
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 glow-card">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">Compte</h2>
        <p className="text-sm text-foreground/70">
          Informations de ton compte Mahylan.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        <Cell label="Email" value={email} />
        <Cell label="Pseudo" value={pseudo} />
        <Cell label="Niveau" value={`${niveau}`} />
        <Cell label="Rôle" value={role === "admin" ? "Admin" : "Joueur"} />
      </ul>
      <a
        href="/parametres/joueurs"
        className="mt-2 inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-4 py-3 transition-colors hover:border-gold/50 hover:bg-gold/5"
      >
        <span className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-gold-warm">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="font-display text-sm font-bold text-foreground">
              Mes joueurs sauvegardés
            </span>
            <span className="text-xs text-foreground/60">
              Gérer pseudos & photos pour les parties locales
            </span>
          </span>
        </span>
        <span className="text-xl text-foreground/40">›</span>
      </a>

      <AboutSection />
    </section>
  );
}

/**
 * M3.2 — Bloc "À propos" affiché en bas du panel Compte. Remplace
 * l'ancien affichage discret de la build version dans la Navbar.
 *
 * Affiche :
 *   - Version du build (timestamp injecté au build par next.config.ts)
 *   - Environnement (development / production)
 *   - Bouton "Recharger l'app" qui force `window.location.reload()`
 *     pour forcer le SW à pull les derniers assets
 */
function AboutSection() {
  const env =
    process.env.NODE_ENV === "production" ? "production" : "development";
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10 text-foreground/70">
          <Info className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="font-display text-sm font-bold text-foreground">
          À propos
        </h3>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-wider text-foreground/50">
            Version
          </dt>
          <dd className="font-mono text-xs text-foreground/80">
            v.{BUILD_VERSION}
          </dd>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-wider text-foreground/50">
            Build
          </dt>
          <dd className="font-mono text-xs text-foreground/80">{env}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-foreground"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Recharger l&apos;app
      </button>
      <p className="text-xs text-foreground/50">
        Mahylan Quiz — Application personnelle
      </p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
      <span className="text-xs uppercase tracking-wider text-foreground/50">
        {label}
      </span>
      <span className="font-display text-sm font-bold text-foreground">
        {value}
      </span>
    </li>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function Row({
  label,
  desc,
  icon: Icon,
  right,
}: {
  label: string;
  desc: string;
  icon: typeof Volume2;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-warm">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-sm font-bold text-foreground">
            {label}
          </p>
          <p className="text-xs text-foreground/60">{desc}</p>
        </div>
      </div>
      <div>{right}</div>
    </div>
  );
}

// Suppress unused import warning when feature flags are off
void Check;
