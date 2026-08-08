import type { Metadata } from "next";
import { DecisionRoulette } from "@/components/organisms/mini-apps/DecisionRoulette";

export const metadata: Metadata = {
  title: "Ruleta de decisiones",
  description: "Cargá tus opciones y dejá que la ruleta decida.",
};

/** Mini-app pública: no requiere sesión. */
export default function RuletaDecisionesPage() {
  return <DecisionRoulette />;
}
