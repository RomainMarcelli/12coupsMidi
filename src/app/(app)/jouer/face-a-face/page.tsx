import { Sword } from "lucide-react";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const metadata = { title: "Face-à-Face" };

export default function FaceAFacePage() {
  return (
    <ComingSoon
      title="Face-à-Face"
      subtitle="60 secondes par joueur, vs bot ou ami — buzzer prêt."
      phase="Phase 6"
      icon={Sword}
    />
  );
}
