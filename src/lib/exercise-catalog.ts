/**
 * Catálogo de ejercicios de la mini-app de entrenamiento.
 *
 * Es un módulo **puro y estático**, no una colección de Firestore: el
 * catálogo base es el mismo para todas las cuentas y no cambia salvo que se
 * edite este archivo, así que copiarlo a la base costaría ~100 documentos por
 * usuario y una lectura en cada carga de la pantalla, para devolver siempre
 * lo mismo. Mismo criterio que `DEFAULT_EXPENSE_CATEGORIES`, sólo que acá el
 * set fijo no es un punto de partida editable: los ejercicios propios del
 * usuario viven aparte, en `customExercises` (ver `lib/data/exercises.ts`),
 * y se mezclan con éstos al mostrarlos.
 *
 * Sin `"use client"` ni `"server-only"`: lo leen el picker del composer (en
 * el cliente) y la validación de las Server Actions (en el server).
 */

export type MuscleGroup =
  | "pecho"
  | "espalda"
  | "hombros"
  | "brazos"
  | "piernas"
  | "gluteos"
  | "core"
  | "cardio"
  | "full-body"
  | "movilidad";

export type ExerciseEquipment =
  | "barra"
  | "mancuernas"
  | "maquina"
  | "polea"
  | "kettlebell"
  | "banda"
  | "peso-corporal"
  | "otro";

export interface ExerciseInfo {
  /** Slug estable. Es lo que guarda `WorkoutExerciseDoc.exerciseId`, así que no se renombra. */
  id: string;
  name: string;
  group: MuscleGroup;
  equipment: ExerciseEquipment;
  /** Qué es y para qué sirve, en una o dos frases. */
  description: string;
  /** Consejos de ejecución: los errores que más se ven y cómo evitarlos. */
  tips: string[];
  /** `true` en los ejercicios propios del usuario (ver `mergeExercises`). */
  custom?: boolean;
}

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string; emoji: string }[] = [
  { id: "pecho", label: "Pecho", emoji: "🫀" },
  { id: "espalda", label: "Espalda", emoji: "🔙" },
  { id: "hombros", label: "Hombros", emoji: "🏔️" },
  { id: "brazos", label: "Brazos", emoji: "💪" },
  { id: "piernas", label: "Piernas", emoji: "🦵" },
  { id: "gluteos", label: "Glúteos", emoji: "🍑" },
  { id: "core", label: "Core", emoji: "🎯" },
  { id: "cardio", label: "Cardio", emoji: "❤️" },
  { id: "full-body", label: "Full body", emoji: "🔥" },
  { id: "movilidad", label: "Movilidad", emoji: "🧘" },
];

export const EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  barra: "Barra",
  mancuernas: "Mancuernas",
  maquina: "Máquina",
  polea: "Polea",
  kettlebell: "Kettlebell",
  banda: "Banda elástica",
  "peso-corporal": "Peso corporal",
  otro: "Otro",
};

export function muscleGroupLabel(group: MuscleGroup): string {
  return MUSCLE_GROUPS.find((entry) => entry.id === group)?.label ?? "Otro";
}

export function isMuscleGroup(value: unknown): value is MuscleGroup {
  return typeof value === "string" && MUSCLE_GROUPS.some((group) => group.id === value);
}

export function isEquipment(value: unknown): value is ExerciseEquipment {
  return typeof value === "string" && value in EQUIPMENT_LABELS;
}

export const DEFAULT_MUSCLE_GROUP: MuscleGroup = "pecho";
export const DEFAULT_EQUIPMENT: ExerciseEquipment = "peso-corporal";

/* ------------------------------------------------------------------ *
 * Catálogo
 * ------------------------------------------------------------------ */

export const EXERCISE_CATALOG: ExerciseInfo[] = [
  /* --- Pecho --- */
  {
    id: "banco-plano",
    name: "Banco plano",
    group: "pecho",
    equipment: "barra",
    description:
      "El press horizontal clásico con barra. Es el ejercicio de referencia para la fuerza de empuje del tren superior: trabaja pectoral, tríceps y deltoides anterior.",
    tips: [
      "Apoyá bien los pies en el piso y mantené los omóplatos juntos y hundidos contra el banco.",
      "Bajá la barra controlado hasta rozar la mitad del pecho, sin rebotarla.",
      "Los codos van a unos 45° del torso, no abiertos en cruz: así el hombro no queda expuesto.",
      "Si entrenás pesado o sin ayuda, usá los seguros del rack.",
    ],
  },
  {
    id: "banco-inclinado-mancuernas",
    name: "Banco inclinado con mancuernas",
    group: "pecho",
    equipment: "mancuernas",
    description:
      "Press en un banco a 30–45° que carga más la porción clavicular (parte alta) del pectoral. Las mancuernas permiten más recorrido que la barra.",
    tips: [
      "Más de 45° de inclinación pasa el trabajo al hombro: quedate entre 30 y 45.",
      "Bajá hasta sentir el estiramiento del pecho, sin que los codos caigan muy por debajo del torso.",
      "Subí las mancuernas juntándolas apenas, sin golpearlas arriba.",
      "Para arrancar, subí las mancuernas apoyadas en los muslos y acostate empujando con las piernas.",
    ],
  },
  {
    id: "banco-declinado",
    name: "Banco declinado",
    group: "pecho",
    equipment: "barra",
    description:
      "Press con el banco inclinado hacia abajo, que enfatiza la parte baja del pectoral y suele permitir más carga que el plano.",
    tips: [
      "Trabá bien las piernas antes de descolgar la barra.",
      "El recorrido es más corto que en plano: no fuerces bajar más de lo que da el hombro.",
      "Pedí ayuda para sacar y guardar la barra: la posición invertida complica hacerlo solo.",
    ],
  },
  {
    id: "aperturas-mancuernas",
    name: "Aperturas con mancuernas",
    group: "pecho",
    equipment: "mancuernas",
    description:
      "Movimiento de aislamiento: los brazos se abren y cierran en arco con el codo semiflexionado fijo. Trabaja el pectoral en estiramiento.",
    tips: [
      "Mantené el codo con una flexión leve y constante durante todo el recorrido.",
      "Es un ejercicio de rango, no de carga: bajá el peso y priorizá el estiramiento.",
      "No bajes más allá de la línea del banco si sentís tirón en el hombro.",
    ],
  },
  {
    id: "cruce-poleas",
    name: "Cruce de poleas",
    group: "pecho",
    equipment: "polea",
    description:
      "Aperturas en poleas altas que cruzan las manos por delante del cuerpo. La tensión se mantiene constante en todo el recorrido, algo que las mancuernas no dan.",
    tips: [
      "Inclinate apenas hacia adelante y dejá un pie adelantado para no perder el equilibrio.",
      "Cruzá las manos al final del movimiento para cerrar bien el pectoral.",
      "Volvé lento a la posición inicial: la fase de vuelta es la mitad del trabajo.",
    ],
  },
  {
    id: "press-pecho-maquina",
    name: "Press de pecho en máquina",
    group: "pecho",
    equipment: "maquina",
    description:
      "Versión guiada del press horizontal. Al no tener que estabilizar la carga, permite llevar el pectoral cerca del fallo con menos riesgo.",
    tips: [
      "Regulá el asiento para que las manijas queden a la altura media del pecho.",
      "No trabes los codos del todo arriba: perdés tensión y cargás la articulación.",
      "Buena opción para las últimas series del día, cuando ya estás cansado.",
    ],
  },
  {
    id: "flexiones",
    name: "Flexiones de brazos",
    group: "pecho",
    equipment: "peso-corporal",
    description:
      "El empuje horizontal sin ningún equipo. Trabaja pecho, tríceps y hombro, y exige core para sostener la línea del cuerpo.",
    tips: [
      "El cuerpo va en una sola línea de la cabeza a los talones: nada de cadera hundida ni cola alta.",
      "Manos apenas más anchas que los hombros, codos hacia atrás y no en cruz.",
      "Si te cuestan, apoyá las manos en un banco antes de hacerlas de rodillas.",
      "Para hacerlas más difíciles, subí los pies a un cajón.",
    ],
  },
  {
    id: "flexiones-diamante",
    name: "Flexiones diamante",
    group: "pecho",
    equipment: "peso-corporal",
    description:
      "Flexiones con las manos juntas formando un triángulo bajo el pecho. Pasa buena parte del trabajo al tríceps.",
    tips: [
      "Mantené los codos pegados al cuerpo durante la bajada.",
      "Si te molestan las muñecas, hacelas sobre puños o agarres paralelos.",
      "Bajá hasta tocar las manos con el pecho, no con la pera.",
    ],
  },
  {
    id: "fondos-paralelas",
    name: "Fondos en paralelas",
    group: "pecho",
    equipment: "peso-corporal",
    description:
      "Empuje vertical hacia abajo en barras paralelas. Según la inclinación del torso carga más pecho (inclinado adelante) o más tríceps (torso vertical).",
    tips: [
      "Bajá hasta que el brazo quede paralelo al piso; más abajo castiga el hombro sin sumar nada.",
      "Mantené los hombros lejos de las orejas: nada de encogerte al bajar.",
      "Si no llegás, usá banda elástica o la máquina asistida.",
    ],
  },
  {
    id: "pullover-mancuerna",
    name: "Pullover con mancuerna",
    group: "pecho",
    equipment: "mancuernas",
    description:
      "Acostado, se lleva una mancuerna desde atrás de la cabeza hasta encima del pecho. Trabaja pectoral y dorsal a la vez, con mucho estiramiento de la caja torácica.",
    tips: [
      "Sostené la mancuerna con las dos manos por el disco superior.",
      "Bajá sólo hasta donde el hombro te lo permita sin dolor.",
      "Mantené la cadera baja: si se levanta, estás compensando con la espalda.",
    ],
  },

  /* --- Espalda --- */
  {
    id: "dominadas",
    name: "Dominadas",
    group: "espalda",
    equipment: "peso-corporal",
    description:
      "Tracción vertical con agarre prono. Es el mejor indicador de fuerza relativa del tren superior y el ejercicio central para el dorsal ancho.",
    tips: [
      "Arrancá con los omóplatos: bajalos y juntalos antes de flexionar los codos.",
      "Subí hasta pasar la pera de la barra, sin dar pataditas.",
      "Bajá controlado hasta estirar los brazos: la negativa es lo que más te va a hacer progresar.",
      "Si todavía no salen, hacé negativas lentas o usá banda elástica.",
    ],
  },
  {
    id: "dominadas-supinas",
    name: "Dominadas supinas",
    group: "espalda",
    equipment: "peso-corporal",
    description:
      "Dominadas con las palmas hacia vos. El bíceps participa mucho más, así que en general salen más repeticiones que en la versión prona.",
    tips: [
      "Agarre al ancho de los hombros, ni más abierto ni más cerrado.",
      "Mantené el core firme para no balancearte.",
      "Si te molestan los codos, probá con agarre neutro en barras paralelas.",
    ],
  },
  {
    id: "remo-barra",
    name: "Remo con barra",
    group: "espalda",
    equipment: "barra",
    description:
      "Tracción horizontal con el torso inclinado. Construye grosor en la espalda media y trabaja fuerte los erectores para sostener la posición.",
    tips: [
      "Torso a unos 45° o menos, espalda neutra y mirada al piso adelante.",
      "Llevá la barra al ombligo, no al pecho, y apretá los omóplatos arriba.",
      "Nada de tirón con la cadera: si necesitás impulso, bajá el peso.",
    ],
  },
  {
    id: "remo-mancuerna",
    name: "Remo con mancuerna a una mano",
    group: "espalda",
    equipment: "mancuernas",
    description:
      "Remo unilateral con una rodilla y una mano apoyadas en el banco. Permite mucho rango y corregir diferencias entre los dos lados.",
    tips: [
      "La espalda queda paralela al piso y quieta: no rotes el torso para subir más.",
      "Llevá el codo hacia la cadera, pegado al cuerpo.",
      "Estirá completo abajo para que el dorsal trabaje en todo el recorrido.",
    ],
  },
  {
    id: "remo-t",
    name: "Remo en punta (T-bar)",
    group: "espalda",
    equipment: "barra",
    description:
      "Remo con la barra anclada de un extremo y agarre neutro cerrado. Muy estable, permite cargar fuerte la espalda media.",
    tips: [
      "Mantené el pecho apoyado o la espalda bien neutra si es la versión libre.",
      "Cargá discos chicos si usás barra en el piso: los grandes cortan el recorrido.",
      "Pausá un instante arriba, con los omóplatos juntos.",
    ],
  },
  {
    id: "jalon-pecho",
    name: "Jalón al pecho",
    group: "espalda",
    equipment: "polea",
    description:
      "Tracción vertical en polea alta. Es la alternativa a las dominadas cuando todavía no salen, o para sumar volumen con carga graduable.",
    tips: [
      "Sentate con el pecho alto y una inclinación leve hacia atrás, que no aumente durante la serie.",
      "Llevá la barra a la clavícula, nunca por detrás de la nuca.",
      "Pensá en empujar los codos hacia el piso en vez de tirar con las manos.",
    ],
  },
  {
    id: "jalon-neutro",
    name: "Jalón con agarre neutro",
    group: "espalda",
    equipment: "polea",
    description:
      "Jalón con las palmas enfrentadas. El agarre neutro es más amable con el hombro y suele sentirse más en el dorsal bajo.",
    tips: [
      "Codos pegados al cuerpo durante toda la bajada.",
      "Evitá encogerte de hombros al inicio del tirón.",
      "Controlá la subida: soltar de golpe desperdicia media repetición.",
    ],
  },
  {
    id: "remo-polea-baja",
    name: "Remo en polea baja",
    group: "espalda",
    equipment: "polea",
    description:
      "Remo sentado con tensión constante. Ideal para trabajar la espalda media sin cargar la zona lumbar como el remo con barra.",
    tips: [
      "Rodillas apenas flexionadas y torso vertical: no uses la espalda como palanca.",
      "Llevá el agarre al abdomen y apretá un segundo.",
      "Dejá que los omóplatos se separen al estirar, sin redondear la espalda baja.",
    ],
  },
  {
    id: "remo-maquina",
    name: "Remo en máquina",
    group: "espalda",
    equipment: "maquina",
    description:
      "Remo con pecho apoyado y recorrido guiado. Saca de la ecuación a la espalda baja, así que sirve para acumular volumen sin fatiga extra.",
    tips: [
      "Ajustá el apoyo para que las manijas queden a la altura del pecho.",
      "No despegues el pecho del respaldo para mover más peso.",
      "Buen ejercicio para terminar la espalda cuando los erectores ya están cansados.",
    ],
  },
  {
    id: "peso-muerto",
    name: "Peso muerto convencional",
    group: "espalda",
    equipment: "barra",
    description:
      "Levantar la barra del piso hasta quedar de pie. Es el ejercicio que más masa muscular involucra: cadena posterior completa, espalda, glúteo y femoral.",
    tips: [
      "La barra arranca pegada a la mitad del pie y sube rozando las piernas.",
      "Espalda neutra de punta a punta: si se redondea, el peso es demasiado.",
      "Terminá parado con el glúteo apretado, sin hiperextender la espalda hacia atrás.",
      "Es un ejercicio muy demandante: no lo pongas todos los días de la semana.",
    ],
  },
  {
    id: "hiperextensiones",
    name: "Hiperextensiones",
    group: "espalda",
    equipment: "maquina",
    description:
      "Extensión de cadera en el banco romano. Fortalece erectores espinales, glúteo y femoral, y es un buen accesorio para cuidar la espalda baja.",
    tips: [
      "Bajá flexionando desde la cadera, no redondeando la espalda.",
      "Subí hasta la línea del cuerpo y frená ahí: no te arquees de más.",
      "Si querés más carga, abrazá un disco contra el pecho.",
    ],
  },

  /* --- Hombros --- */
  {
    id: "press-militar",
    name: "Press militar",
    group: "hombros",
    equipment: "barra",
    description:
      "Empuje vertical con barra, de pie. El ejercicio base de hombro: deltoides anterior y lateral, tríceps y mucho core para sostener la postura.",
    tips: [
      "Apretá glúteos y abdomen para no arquear la espalda baja.",
      "Pasá la cabeza apenas hacia adelante cuando la barra la supera.",
      "Bajá hasta la clavícula, controlado.",
      "Si te molesta el hombro, probá la versión sentado o con mancuernas.",
    ],
  },
  {
    id: "press-arnold",
    name: "Press Arnold",
    group: "hombros",
    equipment: "mancuernas",
    description:
      "Press de hombro con rotación: se arranca con las palmas hacia vos y se gira mientras se sube. Suma trabajo del deltoides anterior en todo el giro.",
    tips: [
      "Hacé la rotación de forma progresiva, no de golpe al final.",
      "Usá menos peso del que usarías en un press común.",
      "Mantené el codo debajo de la muñeca en todo el recorrido.",
    ],
  },
  {
    id: "elevaciones-laterales",
    name: "Elevaciones laterales",
    group: "hombros",
    equipment: "mancuernas",
    description:
      "Aislamiento del deltoides lateral, que es el que da amplitud a los hombros. Es un ejercicio de poco peso y mucha técnica.",
    tips: [
      "Subí hasta la altura del hombro, no más.",
      "Codo levemente flexionado y liderando el movimiento, no la mano.",
      "Si tenés que balancear el torso, el peso te queda grande.",
      "Bajá lento: casi todo el estímulo está en la fase negativa.",
    ],
  },
  {
    id: "elevaciones-frontales",
    name: "Elevaciones frontales",
    group: "hombros",
    equipment: "mancuernas",
    description:
      "Elevación de los brazos al frente para el deltoides anterior. Suele necesitar poco volumen extra: ya trabaja mucho en todos los press.",
    tips: [
      "Frená a la altura de los ojos, no más arriba.",
      "No uses impulso de cadera para arrancar.",
      "Alterná brazos si te cuesta mantener el torso quieto.",
    ],
  },
  {
    id: "pajaros",
    name: "Pájaros (elevaciones posteriores)",
    group: "hombros",
    equipment: "mancuernas",
    description:
      "Con el torso inclinado, se abren los brazos hacia los costados. Trabaja el deltoides posterior, que casi siempre es la parte más floja del hombro.",
    tips: [
      "Torso casi paralelo al piso y espalda neutra.",
      "Pensá en abrir con los codos, no en levantar con las manos.",
      "Peso liviano y repeticiones altas: acá la carga sirve de poco.",
    ],
  },
  {
    id: "face-pull",
    name: "Face pull",
    group: "hombros",
    equipment: "polea",
    description:
      "Tirón de la cuerda hacia la cara con los codos altos. Es el mejor accesorio para el deltoides posterior y los rotadores, y compensa todo el trabajo de empuje.",
    tips: [
      "Polea a la altura de la cara o apenas por encima.",
      "Llevá las manos hacia las orejas separando la cuerda al final.",
      "Poco peso, mucha calidad: es un ejercicio de salud del hombro.",
    ],
  },
  {
    id: "press-hombro-maquina",
    name: "Press de hombro en máquina",
    group: "hombros",
    equipment: "maquina",
    description:
      "Empuje vertical guiado. Permite llevar el hombro cerca del fallo sin preocuparse por la estabilidad ni por la espalda baja.",
    tips: [
      "Ajustá el asiento para que las manijas queden a la altura de los hombros.",
      "No trabes los codos arriba.",
      "Mantené la espalda apoyada en el respaldo todo el tiempo.",
    ],
  },
  {
    id: "encogimientos",
    name: "Encogimientos de hombros",
    group: "hombros",
    equipment: "mancuernas",
    description:
      "Elevación de los hombros hacia las orejas para el trapecio superior. Movimiento corto y simple que admite bastante carga.",
    tips: [
      "Subí en línea recta: rotar los hombros no agrega nada y castiga la articulación.",
      "Pausá arriba un segundo antes de bajar.",
      "Si el agarre falla antes que el trapecio, usá straps.",
    ],
  },

  /* --- Brazos --- */
  {
    id: "curl-barra",
    name: "Curl con barra",
    group: "brazos",
    equipment: "barra",
    description:
      "El ejercicio base de bíceps. Con barra recta se carga más, con barra Z se descargan las muñecas.",
    tips: [
      "Codos pegados al costado del cuerpo y quietos.",
      "Nada de balanceo de cadera para subir la barra.",
      "Bajá completo hasta estirar el brazo en cada repetición.",
    ],
  },
  {
    id: "curl-mancuernas",
    name: "Curl con mancuernas alternado",
    group: "brazos",
    equipment: "mancuernas",
    description:
      "Curl brazo por brazo con supinación (girando la palma hacia arriba). El giro suma trabajo del bíceps en su función de rotación.",
    tips: [
      "Arrancá con la palma neutra y girá mientras subís.",
      "Apretá arriba un instante antes de bajar.",
      "Alternar te deja concentrarte en un brazo por vez y corregir diferencias.",
    ],
  },
  {
    id: "curl-martillo",
    name: "Curl martillo",
    group: "brazos",
    equipment: "mancuernas",
    description:
      "Curl con agarre neutro (palmas enfrentadas). Trabaja el braquial y el braquiorradial, que son los que empujan el bíceps hacia arriba y engrosan el antebrazo.",
    tips: [
      "Mantené la palma mirando al cuerpo todo el recorrido.",
      "Codos fijos: el único que se mueve es el antebrazo.",
      "Se puede hacer cruzando la mancuerna hacia el hombro opuesto para más braquial.",
    ],
  },
  {
    id: "curl-scott",
    name: "Curl en banco Scott",
    group: "brazos",
    equipment: "barra",
    description:
      "Curl con los brazos apoyados en un banco inclinado. El apoyo elimina cualquier impulso y castiga la parte baja del bíceps.",
    tips: [
      "Apoyá bien las axilas contra el respaldo.",
      "No estires del todo el codo abajo si sentís tirón en el tendón.",
      "Subí y bajá lento: acá el impulso directamente no existe.",
    ],
  },
  {
    id: "curl-polea",
    name: "Curl en polea",
    group: "brazos",
    equipment: "polea",
    description:
      "Curl con tensión constante de punta a punta, algo que las mancuernas pierden arriba del recorrido.",
    tips: [
      "Parate a un paso de la polea para que el cable tire en ángulo.",
      "Mantené el torso quieto y los codos al costado.",
      "Ideal como último ejercicio de bíceps, con repeticiones altas.",
    ],
  },
  {
    id: "press-frances",
    name: "Press francés",
    group: "brazos",
    equipment: "barra",
    description:
      "Extensión de tríceps acostado, bajando la barra hacia la frente. Trabaja la cabeza larga del tríceps en estiramiento.",
    tips: [
      "Los codos apuntan al techo y no se abren hacia los costados.",
      "Bajá hasta la frente o apenas por detrás de la cabeza.",
      "Si te molestan los codos, usá barra Z o pasá a la versión en polea.",
    ],
  },
  {
    id: "extension-triceps-polea",
    name: "Extensión de tríceps en polea",
    group: "brazos",
    equipment: "polea",
    description:
      "Empuje hacia abajo con barra o cuerda en polea alta. Es el ejercicio de tríceps más simple de ejecutar bien y el más fácil de progresar.",
    tips: [
      "Codos pegados al cuerpo y fijos: sólo se mueve el antebrazo.",
      "Con cuerda, separá las manos al final del recorrido.",
      "No te inclines sobre la barra para empujar con el peso del cuerpo.",
    ],
  },
  {
    id: "fondos-banco",
    name: "Fondos en banco",
    group: "brazos",
    equipment: "peso-corporal",
    description:
      "Con las manos apoyadas en un banco por detrás, se baja y sube el cuerpo. Trabaja tríceps sin necesidad de equipamiento.",
    tips: [
      "Mantené la espalda cerca del banco: alejarte carga el hombro.",
      "Bajá hasta que el codo quede a 90°, no más.",
      "Para sumar dificultad, estirá las piernas o apoyá un disco en los muslos.",
    ],
  },
  {
    id: "patada-triceps",
    name: "Patada de tríceps",
    group: "brazos",
    equipment: "mancuernas",
    description:
      "Con el torso inclinado y el codo alto, se extiende el brazo hacia atrás. Aislamiento puro con máxima contracción al final.",
    tips: [
      "El brazo queda paralelo al torso y el codo no se mueve.",
      "Poco peso: es un ejercicio de contracción, no de carga.",
      "Pausá un segundo con el brazo estirado.",
    ],
  },
  {
    id: "press-cerrado",
    name: "Press cerrado",
    group: "brazos",
    equipment: "barra",
    description:
      "Press de banca con las manos al ancho de los hombros. Es el ejercicio de tríceps que más carga admite, y de paso trabaja pecho.",
    tips: [
      "Agarre al ancho de los hombros: más cerrado castiga las muñecas.",
      "Codos pegados al torso durante toda la bajada.",
      "Bajá a la parte baja del pecho, no al cuello.",
    ],
  },

  /* --- Piernas --- */
  {
    id: "sentadilla",
    name: "Sentadilla libre",
    group: "piernas",
    equipment: "barra",
    description:
      "Con la barra en la espalda, se baja hasta al menos paralelo y se sube. Es el ejercicio central del tren inferior: cuádriceps, glúteo, aductores y core.",
    tips: [
      "Pies al ancho de los hombros con las puntas apenas hacia afuera.",
      "Bajá empujando la cadera hacia atrás y abriendo las rodillas hacia afuera.",
      "Pecho arriba y espalda neutra: si la cadera se enrolla abajo, acortá el rango.",
      "Empujá con todo el pie, no sólo con la punta.",
    ],
  },
  {
    id: "sentadilla-frontal",
    name: "Sentadilla frontal",
    group: "piernas",
    equipment: "barra",
    description:
      "Sentadilla con la barra apoyada adelante, sobre los deltoides. Obliga a mantener el torso más vertical y carga mucho más el cuádriceps.",
    tips: [
      "Codos bien altos durante todo el movimiento: si caen, la barra se va adelante.",
      "El agarre puede ser cruzado si no te da la movilidad de muñeca.",
      "Usá menos peso que en la sentadilla trasera, no es una comparación válida.",
    ],
  },
  {
    id: "sentadilla-bulgara",
    name: "Sentadilla búlgara",
    group: "piernas",
    equipment: "mancuernas",
    description:
      "Sentadilla a una pierna con el pie de atrás apoyado en un banco. Brutal para cuádriceps y glúteo, y expone cualquier diferencia entre piernas.",
    tips: [
      "Separá el pie de adelante lo suficiente para que la rodilla no se vaya muy por delante del pie.",
      "Inclinarte apenas hacia adelante carga más glúteo; vertical carga más cuádriceps.",
      "Apoyate en algo la primera vez hasta agarrar el equilibrio.",
    ],
  },
  {
    id: "prensa",
    name: "Prensa 45°",
    group: "piernas",
    equipment: "maquina",
    description:
      "Empuje de piernas en máquina inclinada. Permite cargar mucho el cuádriceps sin exigirle nada a la espalda baja ni al equilibrio.",
    tips: [
      "No dejes que la cadera se despegue del respaldo al bajar: ahí se lastima la lumbar.",
      "No trabes las rodillas arriba.",
      "Pies más altos en la plataforma carga más glúteo y femoral; más bajos, más cuádriceps.",
    ],
  },
  {
    id: "extensiones-cuadriceps",
    name: "Extensiones de cuádriceps",
    group: "piernas",
    equipment: "maquina",
    description:
      "Aislamiento del cuádriceps sentado en máquina. Muy útil para pre-activar antes de sentadillas o para acumular volumen al final.",
    tips: [
      "Ajustá el respaldo para que la rodilla quede alineada con el eje de giro.",
      "Pausá arriba un segundo con la pierna estirada.",
      "Bajá controlado en vez de dejar caer el peso.",
    ],
  },
  {
    id: "curl-femoral",
    name: "Curl femoral tumbado",
    group: "piernas",
    equipment: "maquina",
    description:
      "Flexión de rodilla contra resistencia. Trabaja los isquiotibiales en su función de flexionar, que la sentadilla y el peso muerto casi no cubren.",
    tips: [
      "Cadera pegada al banco: si se levanta, bajá el peso.",
      "Llevá los talones lo más cerca posible de los glúteos.",
      "La bajada lenta es clave para prevenir lesiones de isquiotibiales.",
    ],
  },
  {
    id: "peso-muerto-rumano",
    name: "Peso muerto rumano",
    group: "piernas",
    equipment: "barra",
    description:
      "Peso muerto con piernas casi estiradas que arranca de pie y baja hasta media pierna. Es el mejor ejercicio para isquiotibiales y glúteo en estiramiento.",
    tips: [
      "Empujá la cadera hacia atrás en vez de flexionar las rodillas.",
      "Bajá hasta sentir el estiramiento del femoral, no hasta el piso.",
      "La barra va rozando las piernas todo el recorrido.",
      "Espalda neutra: en cuanto se redondea, frenaste tarde.",
    ],
  },
  {
    id: "zancadas",
    name: "Zancadas",
    group: "piernas",
    equipment: "mancuernas",
    description:
      "Pasos largos bajando la rodilla de atrás hacia el piso. Trabajan pierna por pierna y suman equilibrio y control.",
    tips: [
      "Bajá en vertical: la rodilla de atrás va al piso, no hacia adelante.",
      "Torso erguido y mirada al frente.",
      "Se pueden hacer caminando, en el lugar o hacia atrás (más amables con la rodilla).",
    ],
  },
  {
    id: "sentadilla-goblet",
    name: "Sentadilla goblet",
    group: "piernas",
    equipment: "kettlebell",
    description:
      "Sentadilla sosteniendo una pesa contra el pecho. El contrapeso adelante ayuda a mantener el torso vertical, así que es la mejor forma de aprender a sentadillear.",
    tips: [
      "Sostené la pesa pegada al pecho, con los codos hacia abajo.",
      "Usá los codos para empujar las rodillas hacia afuera abajo.",
      "Excelente para entrar en calor antes de la sentadilla con barra.",
    ],
  },
  {
    id: "sentadilla-hack",
    name: "Sentadilla hack",
    group: "piernas",
    equipment: "maquina",
    description:
      "Sentadilla guiada en máquina con la espalda apoyada. Aísla el cuádriceps y saca de la ecuación el equilibrio.",
    tips: [
      "Apoyá toda la espalda en el respaldo y no despegues la cadera abajo.",
      "Pies a media plataforma para no sobrecargar la rodilla.",
      "Bajá al menos hasta paralelo si la movilidad te lo permite.",
    ],
  },
  {
    id: "step-up",
    name: "Step-up al cajón",
    group: "piernas",
    equipment: "mancuernas",
    description:
      "Subir a un cajón con una pierna y bajar controlado. Muy funcional y bastante amable con las articulaciones.",
    tips: [
      "Apoyá el pie entero arriba del cajón y empujá con el talón.",
      "No te impulses con la pierna de abajo: que suba la de arriba.",
      "Bajá lento en vez de dejarte caer.",
    ],
  },
  {
    id: "gemelos-pie",
    name: "Elevación de gemelos de pie",
    group: "piernas",
    equipment: "maquina",
    description:
      "Elevación de talones con la rodilla estirada. Trabaja principalmente el gastrocnemio, que es el gemelo visible.",
    tips: [
      "Rango completo: bajá el talón por debajo del escalón y subí lo más alto que puedas.",
      "Pausá arriba un segundo: rebotar no sirve de nada.",
      "Los gemelos toleran mucho volumen, no tengas miedo de las repeticiones altas.",
    ],
  },
  {
    id: "gemelos-sentado",
    name: "Elevación de gemelos sentado",
    group: "piernas",
    equipment: "maquina",
    description:
      "Elevación de talones con la rodilla flexionada, que pasa el trabajo al sóleo, el músculo profundo de la pantorrilla.",
    tips: [
      "Rodilla a 90° y peso apoyado sobre los muslos, no sobre las rodillas.",
      "Movimiento lento en las dos direcciones.",
      "Complementa al de pie, no lo reemplaza.",
    ],
  },

  /* --- Glúteos --- */
  {
    id: "hip-thrust",
    name: "Hip thrust",
    group: "gluteos",
    equipment: "barra",
    description:
      "Con la espalda apoyada en un banco y la barra sobre la cadera, se extiende la cadera hasta la línea del cuerpo. Es el ejercicio de glúteo con más carga y contracción directa.",
    tips: [
      "El banco va a la altura de los omóplatos, no de los hombros.",
      "Terminá con la cadera a la altura de las rodillas, sin arquear la espalda baja.",
      "Pera hacia el pecho durante todo el movimiento: mirar al techo hiperextiende el cuello.",
      "Usá una colchoneta o barra acolchada, la barra sobre la cadera duele.",
    ],
  },
  {
    id: "puente-gluteos",
    name: "Puente de glúteos",
    group: "gluteos",
    equipment: "peso-corporal",
    description:
      "Versión desde el piso del hip thrust. Perfecto para activar el glúteo antes de entrenar piernas o para entrenar en casa.",
    tips: [
      "Apretá el glúteo arriba y sostené dos segundos.",
      "Talones cerca de la cola y presión en los talones, no en las puntas.",
      "Se puede hacer a una pierna para subir la dificultad sin peso.",
    ],
  },
  {
    id: "patada-gluteo-polea",
    name: "Patada de glúteo en polea",
    group: "gluteos",
    equipment: "polea",
    description:
      "Extensión de cadera a una pierna contra la resistencia de la polea baja. Aislamiento con tensión constante.",
    tips: [
      "Mantené el torso firme: el movimiento sale de la cadera, no de la espalda.",
      "No hiperextiendas: frená cuando la pierna llega a la línea del cuerpo.",
      "Apretá arriba un segundo en cada repetición.",
    ],
  },
  {
    id: "abduccion-cadera",
    name: "Abducción de cadera",
    group: "gluteos",
    equipment: "maquina",
    description:
      "Apertura de piernas contra resistencia. Trabaja el glúteo medio, que es el que estabiliza la pelvis al caminar y correr.",
    tips: [
      "Inclinarte apenas hacia adelante enfatiza más el glúteo medio.",
      "Volvé controlado en vez de dejar cerrar las piernas de golpe.",
      "También se puede hacer con banda elástica arriba de las rodillas.",
    ],
  },
  {
    id: "peso-muerto-sumo",
    name: "Peso muerto sumo",
    group: "gluteos",
    equipment: "barra",
    description:
      "Peso muerto con los pies bien abiertos y las manos por dentro de las piernas. Recorrido más corto y más participación de glúteo y aductores.",
    tips: [
      "Puntas de los pies bien abiertas y rodillas siguiendo esa línea.",
      "Pecho alto y cadera más baja que en el convencional.",
      "Empujá el piso con los pies en vez de pensar en tirar de la barra.",
    ],
  },

  /* --- Core --- */
  {
    id: "plancha",
    name: "Plancha frontal",
    group: "core",
    equipment: "peso-corporal",
    description:
      "Isométrico en apoyo de antebrazos y puntas de pie. Entrena al core en su función real: resistir el movimiento, no generarlo.",
    tips: [
      "Cuerpo en línea recta: ni cadera hundida ni cola levantada.",
      "Apretá glúteos y abdomen todo el tiempo, y respirá.",
      "Mejor 3 series de 30 segundos bien hechas que 2 minutos con la cadera caída.",
    ],
  },
  {
    id: "plancha-lateral",
    name: "Plancha lateral",
    group: "core",
    equipment: "peso-corporal",
    description:
      "Isométrico de costado apoyando un antebrazo. Trabaja los oblicuos y el cuadrado lumbar, claves para la estabilidad de la columna.",
    tips: [
      "Codo justo debajo del hombro.",
      "Levantá bien la cadera y mantené el cuerpo en una línea.",
      "Hacé los dos lados el mismo tiempo, aunque uno cueste más.",
    ],
  },
  {
    id: "crunch",
    name: "Crunch abdominal",
    group: "core",
    equipment: "peso-corporal",
    description:
      "Flexión corta del tronco desde el piso. Trabaja el recto abdominal en su función de acercar el esternón a la pelvis.",
    tips: [
      "No tires del cuello con las manos: apoyalas en el pecho o al costado de la cabeza.",
      "Es un movimiento corto: despegar los omóplatos alcanza.",
      "Exhalá al subir y apretá el abdomen arriba.",
    ],
  },
  {
    id: "elevacion-piernas-colgado",
    name: "Elevación de piernas colgado",
    group: "core",
    equipment: "peso-corporal",
    description:
      "Colgado de una barra, se suben las piernas al frente. Uno de los ejercicios más duros para la parte baja del abdomen.",
    tips: [
      "Arrancá con rodillas flexionadas y pasá a piernas estiradas cuando lo domines.",
      "Nada de balancearte: si te hamacás, el abdomen dejó de trabajar.",
      "Enrollá la pelvis al final del movimiento para que trabaje el abdomen y no sólo el flexor de cadera.",
    ],
  },
  {
    id: "rueda-abdominal",
    name: "Rueda abdominal",
    group: "core",
    equipment: "otro",
    description:
      "Rodar hacia adelante y volver resistiendo la extensión del cuerpo. Es probablemente el ejercicio de core más exigente que existe.",
    tips: [
      "Arrancá de rodillas y con recorrido corto.",
      "La espalda baja no se puede arquear: en cuanto se arquea, frenaste tarde.",
      "Mantené los brazos casi estirados y el abdomen apretado todo el rodado.",
    ],
  },
  {
    id: "russian-twist",
    name: "Russian twist",
    group: "core",
    equipment: "peso-corporal",
    description:
      "Sentado y con el torso inclinado, se rota de lado a lado. Trabaja los oblicuos en rotación.",
    tips: [
      "Mantené el pecho alto y la espalda recta, no encorvada.",
      "Rotá desde el torso, no moviendo sólo los brazos.",
      "Sumá un disco o pelota cuando el peso corporal ya no alcance.",
    ],
  },
  {
    id: "dead-bug",
    name: "Dead bug",
    group: "core",
    equipment: "peso-corporal",
    description:
      "Boca arriba, se estiran brazo y pierna contrarios sin despegar la espalda baja del piso. Enseña a estabilizar el core mientras se mueven las extremidades.",
    tips: [
      "La espalda baja tiene que quedar pegada al piso: si se despega, acortá el rango.",
      "Movimiento lento y coordinado con la respiración.",
      "Excelente para entrar en calor antes de sentadillas o peso muerto.",
    ],
  },
  {
    id: "bird-dog",
    name: "Bird dog",
    group: "core",
    equipment: "peso-corporal",
    description:
      "En cuadrupedia, se estiran brazo y pierna opuestos manteniendo la espalda quieta. Trabaja core y erectores con carga muy baja.",
    tips: [
      "La cadera no debe rotar: imaginate un vaso de agua apoyado en la espalda baja.",
      "Estirá hasta la línea del cuerpo, sin levantar más la pierna.",
      "Sostené dos segundos arriba antes de cambiar de lado.",
    ],
  },
  {
    id: "hollow-hold",
    name: "Hollow hold",
    group: "core",
    equipment: "peso-corporal",
    description:
      "Isométrico boca arriba con brazos y piernas levantados y la espalda baja pegada al piso. Es la base del control de core en gimnasia y CrossFit.",
    tips: [
      "La espalda baja pegada al piso es innegociable: si se despega, subí los brazos y las piernas.",
      "Empezá con las rodillas flexionadas.",
      "Respirá corto pero no aguantes la respiración.",
    ],
  },
  {
    id: "mountain-climbers",
    name: "Mountain climbers",
    group: "core",
    equipment: "peso-corporal",
    description:
      "Desde posición de plancha, se llevan las rodillas al pecho de forma alternada y rápida. Mezcla core con trabajo cardiovascular.",
    tips: [
      "La cadera se mantiene baja, a la altura de los hombros.",
      "Apoyá la punta del pie sin golpear el piso.",
      "Priorizá mantener la posición antes que la velocidad.",
    ],
  },

  /* --- Cardio --- */
  {
    id: "trote",
    name: "Trote continuo",
    group: "cardio",
    equipment: "peso-corporal",
    description:
      "Correr a ritmo sostenido y conversable. Es la base del acondicionamiento aeróbico y lo más simple de sumar a cualquier rutina.",
    tips: [
      "Deberías poder mantener una conversación: si no, vas demasiado rápido.",
      "Subí el volumen semanal de a poco (no más de un 10% por semana).",
      "Pisá con el pie debajo del cuerpo, no muy por delante.",
    ],
  },
  {
    id: "hiit-sprints",
    name: "Sprints / HIIT",
    group: "cardio",
    equipment: "peso-corporal",
    description:
      "Intervalos cortos a máxima intensidad con pausas de recuperación. Mejora la capacidad anaeróbica en mucho menos tiempo que el cardio continuo.",
    tips: [
      "Entrá en calor bien antes del primer sprint: es donde más se lesiona la gente.",
      "Empezá con relaciones tipo 15 segundos fuerte / 45 suave.",
      "Máximo dos o tres sesiones por semana: es muy demandante.",
    ],
  },
  {
    id: "bicicleta-fija",
    name: "Bicicleta fija",
    group: "cardio",
    equipment: "maquina",
    description:
      "Cardio de bajo impacto. Ideal si te molestan las rodillas al correr o para recuperación activa después de piernas.",
    tips: [
      "Regulá el asiento: con el pedal abajo, la rodilla queda casi estirada.",
      "Poné resistencia suficiente para no pedalear en el aire.",
      "Sirve tanto para intervalos como para sesiones largas y suaves.",
    ],
  },
  {
    id: "eliptico",
    name: "Elíptico",
    group: "cardio",
    equipment: "maquina",
    description:
      "Cardio sin impacto que involucra brazos y piernas a la vez. Buena opción para volúmenes altos sin castigar articulaciones.",
    tips: [
      "Usá los brazos activamente en vez de colgarte de las manijas.",
      "Mantené el torso erguido, no apoyado en la consola.",
      "Variá la resistencia para que no se vuelva un movimiento pasivo.",
    ],
  },
  {
    id: "remo-ergometro",
    name: "Remo en ergómetro",
    group: "cardio",
    equipment: "maquina",
    description:
      "Cardio de cuerpo completo con mucha participación de espalda y piernas. Es el estándar en CrossFit para acondicionamiento.",
    tips: [
      "El orden es piernas, cadera, brazos al tirar; y brazos, cadera, piernas al volver.",
      "El 60% del trabajo lo hacen las piernas, no la espalda.",
      "Mirá la potencia por remada, no sólo los metros.",
    ],
  },
  {
    id: "cinta-pendiente",
    name: "Caminata en pendiente",
    group: "cardio",
    equipment: "maquina",
    description:
      "Caminar en cinta con inclinación alta. Quema muchas calorías con muy poco impacto y no interfiere con el entrenamiento de fuerza.",
    tips: [
      "No te agarres de las manijas: le saca todo el sentido al ejercicio.",
      "Empezá con 8–10% de inclinación y ajustá desde ahí.",
      "Ideal para los días de descanso activo.",
    ],
  },
  {
    id: "saltar-soga",
    name: "Saltar la soga",
    group: "cardio",
    equipment: "otro",
    description:
      "Cardio portátil e intenso que además mejora la coordinación y la rigidez del tobillo.",
    tips: [
      "Saltos bajos: alcanza con despegar unos centímetros.",
      "El giro sale de las muñecas, no de los hombros.",
      "Empezá con series de 30 segundos y andá sumando.",
    ],
  },
  {
    id: "burpees",
    name: "Burpees",
    group: "cardio",
    equipment: "peso-corporal",
    description:
      "Bajar al piso, hacer una flexión, volver de pie y saltar. Sube las pulsaciones más rápido que casi cualquier otra cosa sin equipamiento.",
    tips: [
      "Mantené la cadera controlada al llegar a la plancha, no la dejes caer.",
      "Si te agotan muy rápido, sacá el salto y hacelos escalonados.",
      "Marcá un ritmo sostenible desde la primera repetición.",
    ],
  },

  /* --- Full body / CrossFit --- */
  {
    id: "thruster",
    name: "Thruster",
    group: "full-body",
    equipment: "barra",
    description:
      "Sentadilla frontal encadenada con un press de hombro. Uno de los movimientos más completos y más exigentes del CrossFit.",
    tips: [
      "Usá el impulso de las piernas para arrancar el press: es un solo movimiento fluido.",
      "Codos altos abajo, y arriba terminá con la barra sobre la mitad del pie.",
      "Empezá con la barra vacía hasta tener el patrón: la fatiga rompe la técnica rápido.",
    ],
  },
  {
    id: "clean",
    name: "Cargada (clean)",
    group: "full-body",
    equipment: "barra",
    description:
      "Levantamiento olímpico: la barra va del piso a los hombros en un solo movimiento explosivo. Desarrolla potencia como pocos ejercicios.",
    tips: [
      "Es un movimiento técnico: aprendelo con barra vacía y, si podés, con un entrenador.",
      "La primera parte es un peso muerto controlado; la explosión viene recién cuando la barra pasa la rodilla.",
      "Terminá con los codos bien altos y la barra apoyada en los deltoides.",
    ],
  },
  {
    id: "snatch",
    name: "Arranque (snatch)",
    group: "full-body",
    equipment: "barra",
    description:
      "El otro levantamiento olímpico: del piso a por encima de la cabeza en un solo tiempo, con agarre ancho. El movimiento más técnico del gimnasio.",
    tips: [
      "Nunca lo cargues sin haber trabajado la técnica y la movilidad de hombro.",
      "Agarre ancho, con la barra en el pliegue de la cadera al pararte.",
      "Practicalo al principio de la sesión, con el sistema nervioso fresco.",
    ],
  },
  {
    id: "kettlebell-swing",
    name: "Swing con kettlebell",
    group: "full-body",
    equipment: "kettlebell",
    description:
      "Balanceo de la pesa rusa impulsado por la cadera. Entrena la bisagra de cadera, la potencia del glúteo y el acondicionamiento a la vez.",
    tips: [
      "Es una bisagra de cadera, no una sentadilla: la pesa pasa alto entre las piernas.",
      "La altura la da el envión de la cadera, no los brazos.",
      "Terminá parado con glúteos y abdomen apretados en cada repetición.",
    ],
  },
  {
    id: "wall-ball",
    name: "Wall ball",
    group: "full-body",
    equipment: "otro",
    description:
      "Sentadilla con pelota medicinal seguida de un lanzamiento a un blanco en la pared. Combina fuerza de piernas con mucha demanda cardiovascular.",
    tips: [
      "Bajá a paralelo en cada repetición, no hagas medias sentadillas.",
      "Lanzá aprovechando la extensión de las piernas.",
      "Recibí la pelota amortiguando con los brazos y encadená la próxima sentadilla.",
    ],
  },
  {
    id: "box-jump",
    name: "Box jump",
    group: "full-body",
    equipment: "otro",
    description:
      "Salto a un cajón con las dos piernas. Entrena potencia y aterrizaje, que es una habilidad en sí misma.",
    tips: [
      "Bajá del cajón caminando, no saltando: así se lesionan los tendones.",
      "Elegí una altura que puedas hacer sin arrastrar las canillas.",
      "Aterrizá con las rodillas apenas flexionadas y suave.",
    ],
  },
  {
    id: "turkish-get-up",
    name: "Turkish get-up",
    group: "full-body",
    equipment: "kettlebell",
    description:
      "Pasar de estar acostado a estar de pie sosteniendo una pesa sobre la cabeza. Trabaja estabilidad de hombro, core y movilidad en un solo movimiento.",
    tips: [
      "Aprendelo por partes y sin peso, o con un zapato apoyado en el puño.",
      "El brazo que sostiene la pesa queda vertical y la vista, en la pesa.",
      "Es lento a propósito: no lo hagas por tiempo.",
    ],
  },
  {
    id: "devil-press",
    name: "Devil press",
    group: "full-body",
    equipment: "mancuernas",
    description:
      "Burpee con mancuernas que termina llevándolas por encima de la cabeza. Combina todo: empuje, bisagra de cadera y acondicionamiento.",
    tips: [
      "Usá mancuernas más livianas de las que creés: la técnica se rompe rápido.",
      "El envión sale de la cadera, las mancuernas suben en arco.",
      "Mantené la espalda neutra al levantar del piso.",
    ],
  },
  {
    id: "bear-crawl",
    name: "Bear crawl",
    group: "full-body",
    equipment: "peso-corporal",
    description:
      "Desplazarse en cuadrupedia con las rodillas apenas despegadas del piso. Trabaja core, hombros y coordinación cruzada.",
    tips: [
      "Rodillas a un par de centímetros del piso, sin apoyarlas.",
      "Mové brazo y pierna contrarios a la vez.",
      "La cadera se mantiene baja y estable, no oscilando de lado a lado.",
    ],
  },

  /* --- Movilidad --- */
  {
    id: "gato-camello",
    name: "Gato-camello",
    group: "movilidad",
    equipment: "peso-corporal",
    description:
      "En cuadrupedia, se alterna entre redondear y arquear la columna. Moviliza toda la espalda y es un buen inicio de cualquier entrada en calor.",
    tips: [
      "Movete vértebra por vértebra, sin apurarte.",
      "Coordiná con la respiración: exhalá al redondear, inhalá al arquear.",
      "Buscá rango cómodo, no el máximo posible.",
    ],
  },
  {
    id: "movilidad-90-90",
    name: "Movilidad de cadera 90/90",
    group: "movilidad",
    equipment: "peso-corporal",
    description:
      "Sentado con las dos piernas a 90°, se rota de un lado al otro. Mejora la rotación interna y externa de cadera, que es lo que más suele faltar para sentadillear bien.",
    tips: [
      "Mantené el pecho alto y la espalda recta.",
      "Podés apoyar las manos atrás al principio.",
      "Trabajá los dos lados aunque uno esté claramente más duro.",
    ],
  },
  {
    id: "estiramiento-psoas",
    name: "Estiramiento de psoas",
    group: "movilidad",
    equipment: "peso-corporal",
    description:
      "En posición de caballero (una rodilla en el piso), se lleva la cadera hacia adelante. Compensa las horas sentado y mejora la extensión de cadera.",
    tips: [
      "Apretá el glúteo del lado que estirás: es lo que realmente abre la cadera.",
      "No arquees la espalda baja para avanzar más.",
      "Sostené 30 segundos por lado, respirando.",
    ],
  },
  {
    id: "rotaciones-toracicas",
    name: "Rotaciones torácicas",
    group: "movilidad",
    equipment: "peso-corporal",
    description:
      "Desde cuadrupedia o de costado, se abre el brazo rotando la parte alta de la espalda. Mejora la movilidad torácica, clave para press y sentadilla.",
    tips: [
      "La rotación sale de la parte alta de la espalda, no de la lumbar.",
      "Seguí la mano con la mirada.",
      "Movimiento lento y controlado, sin rebotes.",
    ],
  },
  {
    id: "perro-boca-abajo",
    name: "Perro boca abajo",
    group: "movilidad",
    equipment: "peso-corporal",
    description:
      "Posición en V invertida que estira cadena posterior completa: gemelos, isquiotibiales y espalda, y abre los hombros.",
    tips: [
      "Podés flexionar las rodillas para priorizar el estiramiento de la espalda.",
      "Empujá el piso con las manos y llevá el pecho hacia los muslos.",
      "Pedaleá con los talones para estirar los gemelos de a uno.",
    ],
  },
  {
    id: "estiramiento-pecho-puerta",
    name: "Estiramiento de pecho en puerta",
    group: "movilidad",
    equipment: "peso-corporal",
    description:
      "Con el antebrazo apoyado en el marco de una puerta, se gira el torso hacia afuera. Compensa la postura cerrada de hombros.",
    tips: [
      "Codo a la altura del hombro para estirar el pectoral mayor.",
      "Girá con el cuerpo entero, no empujando con el hombro.",
      "30 segundos por lado, sin llegar a sentir dolor.",
    ],
  },
  {
    id: "foam-roller-espalda",
    name: "Foam roller",
    group: "movilidad",
    equipment: "otro",
    description:
      "Auto-masaje con rodillo de espuma sobre cuádriceps, espalda alta o glúteos. Ayuda a bajar la sensación de rigidez antes o después de entrenar.",
    tips: [
      "Rodá lento y frená unos segundos en los puntos más sensibles.",
      "Nunca lo pases por la zona lumbar ni por articulaciones.",
      "Molestia sí, dolor no: si te hace saltar, aflojá la presión.",
    ],
  },
  {
    id: "circulos-hombro-banda",
    name: "Dislocaciones de hombro con banda",
    group: "movilidad",
    equipment: "banda",
    description:
      "Con una banda o palo agarrado ancho, se pasa de adelante hacia atrás por encima de la cabeza. Es la entrada en calor estándar antes de trabajo de hombro.",
    tips: [
      "Arrancá con un agarre bien ancho y andá cerrándolo de a poco.",
      "Brazos estirados durante todo el recorrido.",
      "Si tenés que doblar los codos, el agarre te quedó corto.",
    ],
  },
];

/** Índice por id, para resolver el `exerciseId` de una rutina sin recorrer el array. */
const CATALOG_BY_ID = new Map(EXERCISE_CATALOG.map((exercise) => [exercise.id, exercise]));

export function catalogExercise(id: string): ExerciseInfo | null {
  return CATALOG_BY_ID.get(id) ?? null;
}

/**
 * Catálogo base + ejercicios propios del usuario, ordenados por nombre. Los
 * propios van marcados con `custom: true`: es lo único que los distingue en
 * la UI (sólo ellos se pueden editar y borrar).
 */
export function mergeExercises(custom: ExerciseInfo[]): ExerciseInfo[] {
  return [...EXERCISE_CATALOG, ...custom.map((exercise) => ({ ...exercise, custom: true }))].sort(
    (a, b) => a.name.localeCompare(b.name, "es")
  );
}

/**
 * Filtra por texto libre y grupo muscular. El texto matchea nombre, grupo y
 * descripción: buscar "pecho" tiene que traer el banco plano aunque la
 * palabra no esté en su nombre.
 */
export function filterExercises(
  exercises: ExerciseInfo[],
  term: string,
  group: MuscleGroup | "todos"
): ExerciseInfo[] {
  const query = term.trim().toLowerCase();
  return exercises.filter((exercise) => {
    if (group !== "todos" && exercise.group !== group) return false;
    if (!query) return true;
    return [exercise.name, muscleGroupLabel(exercise.group), exercise.description]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}
