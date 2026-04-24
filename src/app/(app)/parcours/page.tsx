import { Crown } from "lucide-react";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const metadata = { title: "Parcours complet" };

export default function ParcoursPage() {
  return (
    <ComingSoon
      title="Parcours complet"
      subtitle="L'émission entière enchaînée : Quizz → Étoile → Face-à-Face → Coup de Maître."
      phase="Phase 8"
      icon={Crown}
    />
  );
}
