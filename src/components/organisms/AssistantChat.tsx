"use client";

import { useRef, useState } from "react";
import { Chatbot, type ChatMessage } from "lib-kit-components";
import { BrandMark } from "@/components/atoms/icons";

const STARTERS = [
  "¿Cómo instalo Maguita en el celular?",
  "¿Funciona sin conexión?",
];

/**
 * Respuestas locales: la app todavía no tiene backend de asistente. Son sólo
 * ayuda sobre cómo funciona la app — nada que invente datos del usuario, que
 * no existen hasta que haya de dónde traerlos.
 */
const CANNED: { match: RegExp; reply: string; quickReplies?: string[] }[] = [
  {
    match: /instal/i,
    reply:
      "En Android o Chrome de escritorio te aparece el botón «Instalar» en el banner, o lo tenés siempre disponible en Ajustes. En iPhone es manual: Compartir → «Agregar a inicio».",
    quickReplies: ["Ir a Ajustes"],
  },
  {
    match: /sin conexi|offline/i,
    reply:
      "Sí. El service worker guarda la app y las pantallas que ya visitaste, así que podés abrirla sin datos. Los cambios que hagas se sincronizan cuando volvés a tener señal.",
  },
];

function replyFor(text: string): Pick<ChatMessage, "text" | "quickReplies"> {
  const hit = CANNED.find((entry) => entry.match.test(text));
  if (hit) return { text: hit.reply, quickReplies: hit.quickReplies };
  return {
    text: "Todavía estoy aprendiendo esa parte. Probá con una de estas preguntas:",
    quickReplies: STARTERS.slice(0, 2),
  };
}

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Contador propio en vez de Math.random(): los ids quedan estables y no
  // rompen la hidratación.
  const nextId = useRef(0);
  const id = (prefix: string) => `${prefix}-${nextId.current++}`;

  async function handleSend(text: string) {
    const at = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: id("user"), role: "user", text, at, status: "sent" },
    ]);

    // La promesa pendiente es lo que hace que Chatbot muestre "escribiendo…".
    await new Promise((resolve) => setTimeout(resolve, 700));

    setMessages((prev) => [
      ...prev,
      { id: id("bot"), role: "bot", at: Date.now(), ...replyFor(text) },
    ]);
  }

  return (
    <Chatbot
      variant="inline"
      messages={messages}
      onSend={handleSend}
      botName="Asistente Maguita"
      botStatus="En línea"
      avatar={<BrandMark className="w-8 h-8" />}
      starters={STARTERS}
      placeholder="Preguntame algo…"
      footnote="Respuestas automáticas de demostración."
      className="h-[calc(var(--app-height,100dvh)-16rem)] min-h-96"
    />
  );
}
