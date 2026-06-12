import { NextResponse } from "next/server";
import { verifyUnsubToken } from "@/lib/email/unsubToken";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One-click email unsubscribe (PLAN §15.3).
 *
 * GET  /api/unsubscribe?token=<signed>  — link clicked from the email footer.
 * POST /api/unsubscribe?token=<signed>  — RFC 8058 one-click: mail providers
 *      POST to the `List-Unsubscribe` URL (sent on every digest) without
 *      opening a browser. Same idempotent opt-out.
 *
 * Flow: verify the HMAC-signed token (server secret `SIGHTLAB_UNSUB_SECRET`)
 * → set `profiles.email_opt_in = false` for the token's user (service-role:
 * the link is clicked from an email, with NO logged-in session, so RLS would
 * block a self-update — the admin client writes the single boolean)
 * → render a tiny self-contained BILINGUAL (EN + 中文) confirmation page.
 *
 * The token is signed so it cannot be forged for an arbitrary user id. The
 * action is idempotent and only ever turns the preference OFF (never escalates
 * anything), so a long-lived link is safe.
 */

export const dynamic = "force-dynamic";

/** A bilingual EN/中文 message pair rendered on the one confirmation page. */
interface Copy {
  title: string;
  bodyEn: string;
  bodyZh: string;
}

function page(copy: Copy, status = 200): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${copy.title} · SightLab</title>
  <style>
    :root { color-scheme: light dark; }
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
           font-family: Georgia, 'Times New Roman', 'Noto Serif TC', 'Songti SC', serif;
           background:#F7F4ED; color:#1A1814; }
    @media (prefers-color-scheme: dark) { body { background:#14110D; color:#EFE8DA; } }
    .card { max-width:420px; padding:40px 32px; text-align:center; }
    h1 { font-size:22px; margin:0 0 12px; }
    h1 .dot { color:#D97706; }
    p { font-size:15px; line-height:1.7; color:#8A8074; margin:0 0 16px; }
    /* Amber as TEXT needs the darker AA-passing shade on the light ground;
       the locked #D97706 stays for dark mode + the decorative dot. */
    a { color:#B45309; font-family: monospace; font-size:13px; text-decoration:underline; }
    @media (prefers-color-scheme: dark) { a { color:#D97706; } }
  </style>
</head>
<body>
  <div class="card">
    <h1>SightLab<span class="dot">.</span></h1>
    <p>${copy.bodyEn}</p>
    <p lang="zh">${copy.bodyZh}</p>
    <a href="/">Back to SightLab · 返回 SightLab</a>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function unsubscribe(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get("token");
  const userId = verifyUnsubToken(token);

  if (!userId) {
    return page(
      {
        title: "Invalid link",
        bodyEn:
          "This unsubscribe link is invalid or has been tampered with. If you keep receiving emails, manage your preferences from your account.",
        bodyZh: "此退订链接无效或已被篡改。如果你仍持续收到邮件，请到账户页面管理你的偏好设置。",
      },
      400,
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ email_opt_in: false }).eq("id", userId);

  if (error) {
    return page(
      {
        title: "Something went wrong",
        bodyEn:
          "We could not update your preference right now. Please try again later or change it from your account.",
        bodyZh: "暂时无法更新你的偏好设置。请稍后重试，或到账户页面修改。",
      },
      500,
    );
  }

  return page({
    title: "Unsubscribed",
    bodyEn:
      "You have been unsubscribed from the SightLab daily email. You can turn it back on any time from your account.",
    bodyZh: "你已退订 SightLab 每日邮件。随时可以在账户页面重新开启。",
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  return unsubscribe(req);
}

/** RFC 8058 one-click unsubscribe target (List-Unsubscribe-Post). */
export async function POST(req: Request): Promise<NextResponse> {
  return unsubscribe(req);
}
