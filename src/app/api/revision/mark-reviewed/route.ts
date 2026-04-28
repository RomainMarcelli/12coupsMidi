import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * I1.3 — Endpoint pour `navigator.sendBeacon`.
 *
 * sendBeacon ne peut pas appeler une server action (il pose un POST
 * brut avec un body Blob/FormData). On expose donc un Route Handler
 * qui reçoit la liste des `questionIds` à supprimer et appelle
 * directement Supabase.
 *
 * Robustesse :
 *   - sendBeacon ne garantit PAS la livraison sur mobile (quand l'app
 *     passe en background, certains navigateurs avortent la requête).
 *     C'est pour ça qu'on a aussi le fallback "fin de quizz" et
 *     "Suivant" qui font le même DELETE en mode normal.
 *   - On accepte du JSON ET du text/plain (sendBeacon utilise
 *     parfois text/plain selon les navigateurs).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let questionIds: string[] = [];
  try {
    const text = await req.text();
    if (!text) {
      return NextResponse.json({ status: "ok", deleted: 0 });
    }
    const parsed = JSON.parse(text) as { questionIds?: unknown };
    if (Array.isArray(parsed.questionIds)) {
      questionIds = parsed.questionIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      );
    }
  } catch {
    return NextResponse.json(
      { status: "error", message: "invalid body" },
      { status: 400 },
    );
  }

  if (questionIds.length === 0) {
    return NextResponse.json({ status: "ok", deleted: 0 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "unauthorized" },
      { status: 401 },
    );
  }

  const { count, error } = await supabase
    .from("wrong_answers")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .in("question_id", questionIds);

  if (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 },
    );
  }
  revalidatePath("/revision");
  return NextResponse.json({ status: "ok", deleted: count ?? 0 });
}
