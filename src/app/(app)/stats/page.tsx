import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const metadata = { title: "Statistiques" };

export default function StatsPage() {
  return (
    <ComingSoon
      title="Statistiques"
      subtitle="Ton XP, tes badges et ta progression — bientôt disponibles."
      phase="Phase 10"
      icon={BarChart3}
    />
  );
}
