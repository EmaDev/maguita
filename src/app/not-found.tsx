import type { Metadata } from "next";
import { NotFoundScreen } from "./NotFoundScreen";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return <NotFoundScreen />;
}
