import type { Metadata } from "next";
import { TipCalculator } from "@/components/organisms/mini-apps/TipCalculator";

export const metadata: Metadata = {
  title: "Calculadora de propinas",
  description: "Calculá la propina y dividila entre la mesa.",
};

/** Mini-app pública: no requiere sesión. */
export default function CalculadoraPropinasPage() {
  return <TipCalculator />;
}
