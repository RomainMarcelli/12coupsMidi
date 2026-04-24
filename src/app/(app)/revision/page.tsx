import { RotateCcw } from "lucide-react";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const metadata = { title: "Mode Révision" };

export default function RevisionPage() {
  return (
    <ComingSoon
      title="Mode Révision"
      subtitle="Refais les questions que tu as ratées jusqu'à les maîtriser."
      phase="Phase 9"
      icon={RotateCcw}
    />
  );
}
