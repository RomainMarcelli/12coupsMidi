import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PeriodicElement } from "@/lib/periodic/types";
import { QuizzClient } from "./quizz-client";

export const metadata = { title: "Tableau périodique — Quizz" };
export const dynamic = "force-dynamic";

export default async function QuizzPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("periodic_elements")
    .select("*")
    .order("numero_atomique");

  const elements = (rows ?? []) as unknown as PeriodicElement[];

  return <QuizzClient elements={elements} />;
}
