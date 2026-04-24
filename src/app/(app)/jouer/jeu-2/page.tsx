import { Star } from "lucide-react";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const metadata = { title: "Étoile Mystérieuse" };

export default function Jeu2Page() {
  return (
    <ComingSoon
      title="Étoile Mystérieuse"
      subtitle="Devine la personnalité à partir d'indices progressifs."
      phase="Phase 5"
      icon={Star}
    />
  );
}
