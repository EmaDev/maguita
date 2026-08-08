import type { Metadata } from "next";
import { RaffleGenerator } from "@/components/organisms/mini-apps/RaffleGenerator";

export const metadata: Metadata = {
  title: "Sorteo exprés",
  description: "Sorteá uno o varios ganadores entre tus participantes.",
};

/** Mini-app pública: no requiere sesión. */
export default function SorteoExpresPage() {
  return <RaffleGenerator />;
}
