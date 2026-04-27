/**
 * Template HTML simple du mail de rappel quotidien.
 * Pas d'engine de template lourde — string template + escaping basique.
 */

interface EmailContent {
  pseudo: string;
  appUrl: string;
}

export function buildDailyReminderEmail(input: EmailContent): {
  subject: string;
  html: string;
  text: string;
} {
  const { pseudo, appUrl } = input;
  const safePseudo = escapeHtml(pseudo || "champion");
  const subject = "Tu n'as pas joué aujourd'hui sur Mahylan";

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#fff8ec;font-family:Arial,Helvetica,sans-serif;color:#0b1f4d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(11,31,77,0.1);">
    <tr>
      <td style="padding:32px;text-align:center;background:linear-gradient(135deg,#f5b700 0%,#e89e00 100%);color:#0b1f4d;">
        <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;">Mahylan</h1>
        <p style="margin:0;font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Les 12 Coups, à ton rythme</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;">Salut ${safePseudo} !</h2>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
          Tu n&apos;as pas encore joué aujourd&apos;hui — c&apos;est le bon moment pour conserver ton streak et tester quelques questions !
        </p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">
          Le défi du jour t&apos;attend, et 5 questions identiques pour tous tombent à minuit.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${escapeAttr(appUrl)}" style="display:inline-block;padding:14px 32px;background:#f5b700;color:#0b1f4d;text-decoration:none;border-radius:12px;font-weight:800;font-size:16px;letter-spacing:0.05em;text-transform:uppercase;box-shadow:0 4px 0 0 #e89e00;">
            Jouer maintenant
          </a>
        </div>
        <p style="margin:24px 0 0;font-size:13px;color:rgba(11,31,77,0.6);line-height:1.5;text-align:center;">
          Tu peux désactiver cet email à tout moment depuis tes
          <a href="${escapeAttr(appUrl)}/parametres" style="color:#2b8ee6;">paramètres</a>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Salut ${pseudo || "champion"} !

Tu n'as pas encore joué aujourd'hui — c'est le bon moment pour conserver ton streak.

Le défi du jour t'attend : ${appUrl}

Pour désactiver ces mails, va dans Paramètres → Notifications.`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
