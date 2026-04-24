import { Trophy } from "lucide-react";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const metadata = { title: "Coup de Maître" };

export default function CoupDeMaitrePage() {
  return (
    <ComingSoon
      title="Coup de Maître"
      subtitle="4 célébrités à identifier en 45 secondes — pour devenir Maître de Midi."
      phase="Phase 7"
      icon={Trophy}
    />
  );
}
