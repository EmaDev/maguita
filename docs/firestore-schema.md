# Arquitectura de datos — Firestore

Registro vivo del diseño de colecciones de Firestore: qué documentos existen,
su forma, quién los lee/escribe, y las reglas de seguridad que necesitan.

**Regla del repo**: cada vez que se cree o modifique una colección, se cambie
la forma de un documento, o se toque la arquitectura de auth/datos, hay que
agregar una entrada al [Changelog](#changelog) de este archivo — qué cambió,
por qué, un diagrama si ayuda a entenderlo, y el bloque de reglas de
`firestore.rules` que haya que agregar o actualizar (el bloque en sí, no sólo
una descripción). Ver también la nota en `AGENTS.md`.

## Colecciones actuales

| Colección | Doc id | Definido en |
|---|---|---|
| `users` | `uid` de Firebase Auth | `src/lib/firebase/collections.ts` → `UserDoc` |
| `favorites` | `uid` de Firebase Auth | `src/lib/firebase/collections.ts` → `FavoritesDoc` |
| `passwordResetCodes` | `sha256(email:código)` | `src/lib/firebase/collections.ts` → `PasswordResetCodeDoc` |
| `expenseCycles` | autogenerado | `src/lib/firebase/collections.ts` → `ExpenseCycleDoc` |
| `expenseMovements` | autogenerado | `src/lib/firebase/collections.ts` → `ExpenseMovementDoc` |
| `expenseCategories` | `uid` de Firebase Auth | `src/lib/firebase/collections.ts` → `ExpenseCategoriesDoc` |
| `notes` | autogenerado | `src/lib/firebase/collections.ts` → `NoteDoc` |
| `links` | autogenerado | `src/lib/firebase/collections.ts` → `LinkDoc` |
| `habits` | autogenerado | `src/lib/firebase/collections.ts` → `HabitDoc` |

```mermaid
erDiagram
    USERS {
        string email
        string name
        string alias "nullable, apodo libre sin unicidad"
        string avatarUrl "nullable, URL de descarga de Firebase Storage"
        object preferences "theme, haptics, reduceData"
        timestamp createdAt
        timestamp updatedAt
    }
    FAVORITES {
        string_array miniAppIds "ids de MiniApp, orden de alta"
        timestamp updatedAt
    }
    PASSWORD_RESET_CODES {
        string uid
        string email
        timestamp expiresAt "TTL 15 min"
        timestamp createdAt
    }
    EXPENSE_CYCLES {
        string ownerId
        string title "nullable, ej. Gastos vacaciones Ushuaia"
        string startDate "yyyy-mm-dd"
        string endDate "yyyy-mm-dd"
        number initialBalance
        number expenseLimit
        string status "active | closed"
        timestamp createdAt
        timestamp updatedAt
        timestamp closedAt "nullable, sólo se llena al cerrar"
    }
    EXPENSE_MOVEMENTS {
        string cycleId
        string ownerId "duplicado del ciclo, evita un get() extra para validar dueño"
        string title
        string category "nombre de la categoría al momento del alta"
        string categoryEmoji "emoji de la categoría al momento del alta"
        number amount "negativo: esta alta sólo carga gastos"
        string date "yyyy-mm-dd"
        timestamp createdAt
    }
    EXPENSE_CATEGORIES {
        object_array categories "id, name, emoji — ABM del usuario"
        timestamp updatedAt
    }
    NOTES {
        string ownerId
        string text
        string date "yyyy-mm-dd, día de creación — no editable"
        string priority "low | medium | high"
        boolean hasAlert
        string alertDate "yyyy-mm-dd, nullable — sólo si hasAlert"
        string alertTime "HH:mm, nullable — sólo si hasAlert"
        timestamp createdAt
        timestamp updatedAt
    }
    LINKS {
        string ownerId
        string url "URL completa, ya normalizada con protocolo"
        string title "nullable, og:title o <title> del sitio"
        string description "nullable, og:description o meta description"
        string image "nullable, URL absoluta de og:image/twitter:image"
        string siteName "nullable, og:site_name"
        string domain "host sin www., ej. github.com"
        timestamp createdAt
        timestamp updatedAt
    }
    HABITS {
        string ownerId
        string name "ej. Leer 20 minutos"
        string emoji "de una paleta fija, no input libre"
        number goalPerWeek "1 a 7, informativa: no afecta la racha"
        string_array doneDates "yyyy-mm-dd, sin duplicados ni orden garantizado"
        timestamp createdAt
        timestamp updatedAt
    }
    USERS ||--o| FAVORITES : "mismo uid, colecciones separadas a propósito"
    USERS ||--o{ PASSWORD_RESET_CODES : "por email, de un solo uso"
    USERS ||--o{ EXPENSE_CYCLES : "ownerId, sólo uno active a la vez"
    USERS ||--o| EXPENSE_CATEGORIES : "mismo uid"
    EXPENSE_CYCLES ||--o{ EXPENSE_MOVEMENTS : "cycleId"
    EXPENSE_CATEGORIES ||--o{ EXPENSE_MOVEMENTS : "category/categoryEmoji copiados al alta, sin FK"
    USERS ||--o{ NOTES : "ownerId"
    USERS ||--o{ LINKS : "ownerId"
    USERS ||--o{ HABITS : "ownerId"
```

`users` y `favorites` **se mantienen separadas** aunque ambas cuelgan del
mismo `uid`: los favoritos se leen/escriben con una transacción propia
(`toggleFavorite`, ver más abajo) y mezclarlos en un solo documento
obligaría a que cualquier cambio de perfil pase por esa misma transacción.

### `users/{uid}`

Perfil de cuenta. La identidad (email, password, uid) vive en **Firebase
Auth**; este documento es todo lo que Auth no sabe.

| Campo | Tipo | Se escribe en | Notas |
|---|---|---|---|
| `email` | `string` | alta | normalizado (`trim().toLowerCase()`) |
| `name` | `string` | alta, `updateProfileAction` | del form de alta, o del claim `name` de Google |
| `alias` | `string \| null` | alta (`null`), `updateProfileAction` | apodo libre, **sin unicidad** |
| `avatarUrl` | `string \| null` | alta (`null` o claim `picture` de Google), `updateProfileAction` | URL de descarga de Firebase Storage (`avatars/{uid}/avatar.jpg`, ver `uploadAvatar`) |
| `preferences` | `UserPreferences` | alta (defaults), `updatePreferencesAction` | ver tabla abajo |
| `createdAt` / `updatedAt` | `Timestamp` | siempre | `now()` = `serverTimestamp()`, nunca el reloj del cliente |

`UserPreferences`:

| Campo | Tipo | Default | Hoy vive también en |
|---|---|---|---|
| `theme` | `"light" \| "dark" \| "system"` | `"system"` | `localStorage["maguita:theme"]` |
| `haptics` | `boolean` | `true` | `localStorage["maguita:haptics"]` |
| `reduceData` | `boolean` | `false` | `localStorage["maguita:reduce-data"]` |

> Los defaults del server están alineados a propósito con los de
> `localStorage` para que, cuando se conecte la UI, un usuario nuevo vea lo
> mismo en ambos lados. **La UI todavía no lee/escribe estos campos** — hoy
> sigue funcionando 100% con `localStorage` (`ThemeProvider`,
> `SettingsPanel`). Los accesores están listos para cuando se conecte.

Accesores: `getProfile` (`src/lib/data/profile.ts`, sólo Server Components),
`updateProfileAction` / `updatePreferencesAction`
(`src/lib/data/profile-actions.ts`, Server Actions — re-verifican la sesión).
`updateProfileAction` sigue el patrón `useActionState` (recibe
`prevState, FormData`, ver `EditProfileForm`) y, si el form manda una foto,
la sube con `uploadAvatar` (`src/lib/firebase/storage.ts`) antes de escribir
`avatarUrl`. Alta: `createAccount` / `findOrCreateGoogleAccount`
(`src/lib/auth/users.ts`).

### `favorites/{uid}`

| Campo | Tipo | Notas |
|---|---|---|
| `miniAppIds` | `string[]` | ids de `MiniApp` (`src/lib/data/mini-apps.ts`), en orden de alta |
| `updatedAt` | `Timestamp` | — |

Un solo documento por cuenta con el array entero: pocos favoritos, así que
una lectura gana contra N lecturas de una subcolección. `toggleFavorite`
(`src/lib/data/favorites.ts`) usa una transacción porque es
read-modify-write — sin ella, dos toques casi simultáneos (celular + compu)
pisarían el cambio del otro.

### `expenseCycles/{cycleId}` y `expenseMovements/{movementId}`

Gestor de gastos por período: hoy vive sólo en la tab **Movimientos** de
Inicio, pero las dos colecciones están pensadas para que una mini-app de
gastos aparte, más adelante, las lea/escriba igual — por eso son colecciones
propias en vez de un array adentro de `users/{uid}`.

`expenseCycles/{cycleId}` (id autogenerado):

| Campo | Tipo | Notas |
|---|---|---|
| `ownerId` | `string` | uid del dueño |
| `title` | `string \| null` | libre, ej. "Gastos vacaciones Ushuaia". `null` = la UI muestra el lapso de fechas (`expenseCycleTitle`, `src/lib/home-model.ts`) |
| `startDate` / `endDate` | `string` | día del período, `yyyy-mm-dd` |
| `initialBalance` | `number` | saldo inicial, pesos enteros |
| `expenseLimit` | `number` | tope de gastos, pesos enteros |
| `status` | `"active" \| "closed"` | sólo un `active` por usuario a la vez |
| `createdAt` / `updatedAt` | `Timestamp` | — |
| `closedAt` | `Timestamp \| null` | `null` mientras está `active` |

`expenseMovements/{movementId}` (id autogenerado):

| Campo | Tipo | Notas |
|---|---|---|
| `cycleId` | `string` | referencia a `expenseCycles/{cycleId}` |
| `ownerId` | `string` | duplicado del `ownerId` del ciclo (ver abajo) |
| `title` | `string` | concepto |
| `category` / `categoryEmoji` | `string` | nombre y emoji de la categoría **copiados al momento del alta** desde `expenseCategories/{uid}` (ver esa sección abajo) — no es una referencia viva. Los ingresos usan la categoría fija `"Ingreso"` / `💰`, sin pasar por el ABM |
| `amount` | `number` | negativo = gasto (`addExpenseMovementAction`), positivo = ingreso (`addExpenseIncomeAction`) |
| `date` | `string` | día del movimiento, `yyyy-mm-dd` |
| `createdAt` | `Timestamp` | — |

Accesores: `getActiveExpenseCycle` / `getExpenseMovements`
(`src/lib/data/expenses.ts`, sólo Server Components); `startExpenseCycleAction`
(alta/reinicio), `updateExpenseCycleAction` (edita tope y fechas de un ciclo
en curso, sin cerrarlo), `addExpenseMovementAction` (gasto),
`addExpenseIncomeAction` (ingreso) — todas en `src/lib/data/expenses-actions.ts`.

Decisiones de diseño:

- **Un solo `active` por usuario, garantizado por transacción.**
  `startExpenseCycleAction` cierra (`status: "closed"`) el ciclo activo del
  usuario y crea el nuevo dentro de la misma `runTransaction`: así nunca hay
  una ventana en la que un doble tap cree dos ciclos activos. El ciclo cerrado
  no se borra — queda como historial, tal cual pidió el dueño del producto
  ("cuando finalice se podrá reiniciar, dejando el anterior como historial").
  Verlo todavía no tiene UI (fuera de alcance de esta entrada).
- **`ownerId` duplicado en `expenseMovements`.** Sin él, para saber si un
  movimiento es de la cuenta que lo pide habría que ir a buscar su ciclo
  (`get()` extra) tanto en las reglas de Firestore como en
  `addExpenseMovementAction`. Con el campo repetido, las reglas leen
  `resource.data.ownerId` directo y la Server Action valida dueño y
  `status === "active"` con el mismo documento que ya trae (`cycleRef.get()`),
  sin una consulta aparte — importa porque el Admin SDK saltea las reglas, así
  que esa validación en la Server Action es la única barrera real contra que
  una sesión válida le cargue gastos al ciclo de otra cuenta pasando su
  `cycleId`.
- **Sin `orderBy` en las consultas.** `getExpenseMovements` filtra sólo por
  `cycleId` (`==`) y ordena en memoria con `byDayDesc` (`src/lib/home-model.ts`,
  ya usado por notas y hábitos). Sumar un `orderBy` en un campo distinto al
  filtro le pediría a Firestore un índice compuesto que hoy no hace falta —
  los movimientos de un período son pocos.

```mermaid
sequenceDiagram
    participant B as Browser (MovementsPanel)
    participant SA as Server Action
    participant AD as Admin SDK
    participant FS as Firestore

    B->>SA: startExpenseCycleAction({startDate, endDate, initialBalance, expenseLimit})
    SA->>AD: runTransaction
    AD->>FS: get expenseCycles where ownerId==uid and status==active
    AD->>FS: update(s) status: closed (si había uno)
    AD->>FS: set expenseCycles/{nuevo} status: active
    SA-->>B: revalidatePath(/inicio)

    B->>SA: addExpenseMovementAction({cycleId, title, categoryId, amount, date})
    SA->>FS: get expenseCycles/{cycleId} + get expenseCategories/{uid}
    alt ownerId != uid o status != active o categoryId no existe
        SA-->>B: throw (rechazado)
    else válido
        SA->>FS: add expenseMovements {cycleId, ownerId, category: name, categoryEmoji: emoji, amount: -amount, ...}
        SA-->>B: revalidatePath(/inicio)
    end
```

### `expenseCategories/{uid}`

ABM de categorías del gestor de gastos (nombre + emoji). Un solo documento
por cuenta con el array entero, igual que `favorites/{uid}`: son pocas
categorías, así que una lectura gana contra N de una subcolección.

| Campo | Tipo | Notas |
|---|---|---|
| `categories` | `{ id, name, emoji }[]` | orden de alta; `id` es un `randomUUID()` del server |
| `updatedAt` | `Timestamp` | — |

Accesores: `getExpenseCategories` (`src/lib/data/expense-categories.ts`, sólo
Server Components), `upsertExpenseCategoryAction` / `deleteExpenseCategoryAction`
(`src/lib/data/expense-categories-actions.ts`, Server Actions — devuelven el
array completo ya actualizado, no sólo el item tocado).

Decisiones de diseño:

- **Sin documento todavía = `DEFAULT_EXPENSE_CATEGORIES`.** Un usuario nuevo
  no tiene `expenseCategories/{uid}` hasta su primer alta/edición/borrado; en
  ese hueco, `getExpenseCategories` devuelve un set fijo en código (7
  categorías con emoji) para que el selector del alta de gastos no arranque
  vacío. En cuanto el usuario toca el ABM por primera vez, ese set pasa a ser
  la base sobre la que se aplica el cambio (mismo patrón que
  `DEFAULT_PREFERENCES` en `users/{uid}`).
- **`category`/`categoryEmoji` se copian al movimiento, no se referencian.**
  Si el usuario renombra o borra una categoría después, los gastos ya
  cargados con ella siguen mostrando el nombre/emoji que tenían al momento
  del alta — evita que borrar una categoría deje movimientos "rotos" o que
  editarla reescriba silenciosamente el historial. `addExpenseMovementAction`
  resuelve `category`/`categoryEmoji` del lado del server a partir del
  `categoryId` recibido (nunca confía en un nombre/emoji que mande el
  cliente).
- **Las Server Actions devuelven el array completo.** El sheet del ABM
  (`ExpenseCategoriesSheet`) guarda las categorías en estado local para
  poder editar sin depender de que el sheet — que no se vuelve a montar
  solo mientras está abierto — reciba props nuevas; devolver el array ya
  actualizado evita un segundo viaje a Firestore sólo para refrescar la
  lista en pantalla.

### `notes/{noteId}`

Notas de la tab **Notas** de Inicio: alta libre con prioridad y, opcionalmente,
una alerta con fecha/hora propias (distinta de `date`, que es el día al que
corresponde la nota). Id autogenerado, mismo criterio de dueño por campo que
`expenseCycles`/`expenseMovements` — muchas notas por usuario, no un array
único como `favorites`/`expenseCategories`.

| Campo | Tipo | Notas |
|---|---|---|
| `ownerId` | `string` | uid del dueño |
| `text` | `string` | cuerpo de la nota |
| `date` | `string` | `yyyy-mm-dd`, el día en que se creó — sin selector en el composer ni en la edición |
| `priority` | `"low" \| "medium" \| "high"` | ordena el filtro de la grilla de notas |
| `hasAlert` | `boolean` | si además de nota es un recordatorio |
| `alertDate` / `alertTime` | `string \| null` | `yyyy-mm-dd` / `HH:mm`, ambos `null` si `hasAlert` es `false` |
| `createdAt` / `updatedAt` | `Timestamp` | — |

Accesores: `getNotes` (`src/lib/data/notes.ts`, sólo Server Components);
`addNoteAction`, `updateNoteAction`, `deleteNoteAction`
(`src/lib/data/notes-actions.ts`, Server Actions — re-verifican la sesión).
`updateNoteAction`/`deleteNoteAction` comparten `getOwnedNoteRef` (trae la
nota y valida `ownerId`) y `assertValidNoteFields` (mismas validaciones que
`addNoteAction`), igual criterio que `getOwnedActiveCycle` en
`expenses-actions.ts`.

Decisiones de diseño:

- **`date` no es un campo del formulario.** El composer no tiene selector de
  fecha (se sacó a pedido: sólo prioridad y alerta) — `addNoteAction` recibe
  el `today` que ya resuelve el server y lo guarda tal cual. `updateNoteAction`
  tampoco lo deja editar: reenvía el `note.date` original sin tocarlo. Sigue
  siendo su propio campo (no `createdAt` recortado a día) porque `createdAt`
  es un `Timestamp` de bookkeeping — sirve para auditoría, no para agrupar
  "Hoy"/"Ayer" en la UI sin parsear un Timestamp en cada render.
- **`hasAlert` + `alertDate`/`alertTime` en vez de un solo campo de
  fecha-hora.** Guardar dos strings planos (mismo criterio que `date` en
  todo el resto del archivo: nunca un `Date`/`Timestamp` para lo que el
  cliente sólo necesita mostrar o comparar como texto) evita tener que
  parsear un ISO combinado en la UI sólo para separar el `DatePicker` de la
  hora. `hasAlert` queda de todos modos como campo propio (no "alertDate no
  nulo") porque es más barato de leer en la UI (`note.hasAlert` directo, sin
  inferir un booleano de dos nullables) y dominios futuros (ej. desactivar
  una alerta sin borrar la fecha) no obligan a tocar el resto de la forma.
- **Sin `orderBy` en la consulta.** `getNotes` filtra sólo por `ownerId`
  (`==`) y ordena en memoria con `byDayDesc` — mismo criterio que
  `getExpenseMovements`, evita un índice compuesto que hoy no hace falta. El
  orden y los filtros de la tab (campo + dirección asc/desc, prioridad, con o
  sin alerta) son sólo de UI: `sortNotes` (`src/lib/home-model.ts`) y un
  `filter` se aplican sobre la lista ya traída, sin volver a pedirle nada a
  Firestore. La colección entera del usuario ya viaja en `data.notes`, así que
  filtrar del lado del server no ahorraría ninguna lectura.
- **Editar y borrar no piden campos nuevos.** `updateNoteAction` reemplaza
  todos los campos editables a la vez (no hay `PATCH` parcial) y no toca
  `createdAt`; `deleteNoteAction` borra el documento entero, sin soft-delete
  — no hay pantalla de "notas borradas" que lo necesite.
- **El borrado masivo saltea lo ajeno en vez de cortar.** `deleteNotesAction`
  valida dueño documento por documento y descarta en silencio lo que no sea
  del usuario: los ids los manda el cliente, y fallar distinto según "no
  existe" o "no es tuyo" delataría qué ids existen. Si al final no quedó
  ninguna propia sí tira error, para que un borrado que no borró nada no se
  vea como exitoso. Va en un `WriteBatch` (atómico) con un tope de 500, que
  es el límite de Firestore — por UI es imposible llegar, pero el largo del
  array lo decide el cliente.

### `links/{linkId}`

Links guardados de la mini-app privada **Links guardados**
(`/mini-apps/links`): alta libre por URL, con preview (título, descripción,
imagen) resuelto una sola vez al guardar. Id autogenerado, mismo criterio de
dueño por campo que `notes`/`expenseCycles` — muchos links por usuario.

| Campo | Tipo | Notas |
|---|---|---|
| `ownerId` | `string` | uid del dueño |
| `url` | `string` | URL completa, ya normalizada (siempre con protocolo — `addLinkAction` le agrega `https://` si el usuario no lo tipeó) |
| `title` | `string \| null` | `og:title` o, si no hay, el `<title>` del sitio. `null` si el fetch falló o el sitio no tiene ninguno |
| `description` | `string \| null` | `og:description` o `meta[name=description]` |
| `image` | `string \| null` | URL absoluta de `og:image`/`twitter:image` (resuelta contra la URL final tras redirects) |
| `siteName` | `string \| null` | `og:site_name` |
| `domain` | `string` | host de `url` sin `www.` — evita parsear la URL en el cliente sólo para mostrarlo |
| `createdAt` / `updatedAt` | `Timestamp` | — |

Accesores: `getLinks` (`src/lib/data/links.ts`, sólo Server Components),
`addLinkAction` / `deleteLinkAction` (`src/lib/data/links-actions.ts`, Server
Actions — re-verifican la sesión y, en el borrado, el dueño del documento).

Decisiones de diseño:

- **El preview se resuelve una sola vez, en el alta, no en cada lectura.**
  `addLinkAction` llama a `fetchLinkMetadata`
  (`src/lib/data/link-metadata.ts`) y guarda `title`/`description`/`image`/
  `siteName` ya resueltos en el documento — `getLinks` sólo lee Firestore, no
  vuelve a pedirle nada al sitio de terceros. Evita repetir un fetch externo
  (lento, y puede fallar) cada vez que el usuario abre la mini-app; el
  costo es que si el sitio cambia su preview después, el link guardado no se
  actualiza solo (no hay refresco automático, ver "Fuera de alcance" abajo).
- **Sin librería de parsing HTML.** `fetchLinkMetadata` recorta `<head>` del
  HTML descargado y extrae metatags con regex en vez de sumar una dependencia
  (`cheerio` u similar) — alcanza porque sólo le interesan metatags Open
  Graph, que siempre vienen bien formados por los sitios que los publican; no
  necesita un parser DOM completo.
- **Protecciones porque la URL la manda el usuario y el fetch corre en el
  server (riesgo de SSRF).** Antes de pedir cada URL (la original y cada
  redirect, hasta 3), `fetchLinkMetadata` resuelve el hostname y descarta
  cualquier IP privada/loopback/link-local/CGNAT (rangos `10.0.0.0/8`,
  `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`,
  `100.64.0.0/10`, sus equivalentes IPv6, y hostnames `localhost`/`*.local`)
  — sin esto, la mini-app se podría usar para sondear la red interna del
  servidor pasándole una URL que apunte para adentro. Los redirects se siguen
  a mano (`redirect: "manual"` + loop propio) en vez de dejar que `fetch` los
  siga solo, precisamente para poder validar cada salto — si no, un sitio
  público podría redirigir a una IP interna y saltearse el chequeo del primer
  hop. Además: sólo `http`/`https`, timeout de 6s, sólo `content-type:
  text/html`, y tope de 500KB leídos del body (alcanza para `<head>`, evita
  bajar una página entera). Cualquier fallo en cualquiera de estos pasos
  devuelve metadata vacía — no rechaza el alta, el link se guarda igual sólo
  que sin preview.
- **`domain` se calcula y guarda en el alta, no se deriva de `url` en la
  UI.** Mismo criterio que `category`/`categoryEmoji` en `expenseMovements`:
  un campo denormalizado barato de leer en la card en vez de parsear la URL
  con `new URL()` en cada render del cliente.
- **Sin edición.** Sólo alta + listado + borrado — no hay forma de corregir a
  mano un preview que salió mal (ej. un sitio sin metatags), sólo borrar y
  volver a guardar.

### `habits/{habitId}`

Hábitos de la tab **Hábitos** de Inicio: el check del día, la racha de cada
uno y la grilla de constancia. Id autogenerado, mismo criterio de dueño por
campo que `notes`/`links` — muchos hábitos por usuario, con un tope de 50
(ver abajo).

| Campo | Tipo | Notas |
|---|---|---|
| `ownerId` | `string` | uid del dueño |
| `name` | `string` | nombre libre, ej. "Leer 20 minutos". Máx. 60 caracteres |
| `emoji` | `string` | de la paleta fija de `habit-options.ts`, no un input libre |
| `goalPerWeek` | `number` | meta de días por semana, 1 a 7. **Informativa**: no entra en el cálculo de la racha, sólo en la barra de progreso semanal |
| `doneDates` | `string[]` | días cumplidos, `yyyy-mm-dd`. Sólo se escribe con `arrayUnion`/`arrayRemove`: sin duplicados, pero **sin orden garantizado** |
| `createdAt` / `updatedAt` | `Timestamp` | — |

Accesores: `getHabits` (`src/lib/data/habits.ts`, sólo Server Components),
`addHabitAction` / `toggleHabitDayAction` / `updateHabitAction` /
`deleteHabitAction` (`src/lib/data/habits-actions.ts`, Server Actions — todas
re-verifican la sesión y el dueño del documento).

Decisiones de diseño:

- **El historial va en un array adentro del hábito, no en una colección
  aparte.** `doneDates` es un `string[]` en el mismo documento, igual que
  `favorites.miniAppIds` y `expenseCategories.categories`. La alternativa
  (una colección `habitLogs` con un documento por día cumplido) obligaría a
  una query por hábito —o a un índice compuesto— cada vez que se abre Inicio,
  para pintar una grilla de constancia que necesita *todos* los días juntos
  de una. Con el array, leer un hábito ya trae su historial completo. El
  costo es el límite de 1MB por documento, que en la práctica no se toca: a
  ~11 bytes por fecha son décadas de días cumplidos.
- **`arrayUnion`/`arrayRemove` en vez de leer, modificar y reescribir el
  array.** `toggleHabitDayAction` no hace read-modify-write: son operaciones
  atómicas del lado de Firestore, así que dos toques rápidos (o la misma
  cuenta en dos dispositivos) no se pisan. Además `arrayUnion` es
  idempotente, que es justo lo que necesita la UI optimista de `HabitsPanel`
  — marcar dos veces el mismo día no lo duplica.
- **El día lo manda el cliente y el server sólo valida su forma.** El día
  cumplido es el día *local del usuario*, y el server no conoce su huso, así
  que no puede verificarlo contra su propio reloj. `assertValidDay` chequea
  que sea una fecha real (`yyyy-mm-dd` que exista en el calendario) para no
  ensuciar `doneDates` con strings que después rompan la grilla; qué día es
  "hoy" queda del lado del cliente. Como el dato es sólo del propio usuario,
  el peor caso es que alguien se infle su propia racha.
- **Orden de lectura ascendente por `createdAt`**, al revés que `notes` y
  `links`: la lista es una checklist que se marca todos los días, y que un
  hábito nuevo se meta arriba movería de lugar los que el usuario ya tiene
  memorizados.
- **Tope de 50 hábitos por cuenta.** La tab los muestra todos juntos sin
  paginar y el `doneDates` de cada uno viaja entero en cada carga de Inicio
  — que es una pantalla compartida con movimientos y notas, no sólo de
  hábitos.
- **La racha no se guarda, se deriva.** `streakOf`/`longestStreakOf`/
  `weekCountOf` (`src/lib/home-model.ts`) la calculan a partir de
  `doneDates` en cada render. Guardarla como campo obligaría a mantenerla
  sincronizada en cada toggle y a recalcularla igual cuando pasa la
  medianoche sin que nadie escriba nada.

### `passwordResetCodes/{hash}`

| Campo | Tipo | Notas |
|---|---|---|
| `uid` | `string` | cuenta dueña del código |
| `email` | `string` | — |
| `expiresAt` | `Timestamp` | TTL de 15 min |
| `createdAt` | `Timestamp` | — |

El id del documento es `sha256(email:código)`, nunca el código en claro —
alguien con acceso de lectura ve que hay un pedido pendiente, pero no puede
usarlo. Se borra al canjearse, exista o no (un intento fallido no deja el
código vivo para seguir probando).

## Reglas de Firestore

**Estado actual del proyecto real (Firebase Console), pegado por el
usuario el 2026-08-01 — deniega todo:**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Reglas objetivo, ya escritas en `firestore.rules` en el repo, pendientes
de publicar** (`firebase deploy --only firestore:rules --project maguita-7832c`):

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    match /users/{uid} {
      allow read: if isOwner(uid);
      allow write: if false;
    }

    match /favorites/{uid} {
      allow read: if isOwner(uid);
      allow write: if false;
    }

    match /passwordResetCodes/{code} {
      allow read, write: if false;
    }

    match /expenseCycles/{cycleId} {
      allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
      allow write: if false;
    }

    match /expenseMovements/{movementId} {
      allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
      allow write: if false;
    }

    match /expenseCategories/{uid} {
      allow read: if isOwner(uid);
      allow write: if false;
    }

    match /notes/{noteId} {
      allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
      allow write: if false;
    }

    match /links/{linkId} {
      allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

⚠️ **Acción pendiente**: publicar estas reglas contra el proyecto real —
todavía no están activas ahí, sólo en el repo. Sin esto, el cliente no puede
leer ni `users/{uid}` ni `favorites/{uid}` (aunque las escrituras del server
con el Admin SDK funcionan igual, porque ese SDK saltea las reglas).

**Ningún cambio de reglas hizo falta** para agregar `alias`, `avatarUrl` y
`preferences` a `users/{uid}`: la colección ya tenía `allow write: if false`
(todo pasa por el Admin SDK) y `allow read: if isOwner(uid)` cubre el
documento entero, campos nuevos incluidos — Firestore no tiene reglas a
nivel de campo para lectura.

## Changelog

### 2026-08-03 — Nueva colección `habits`: la tab Hábitos deja de ser local

**Qué cambió.** Se agregó la colección `habits` (`HabitDoc`) y con ella el
backend real del módulo de hábitos: alta, edición, borrado y marcado del día
(`src/lib/data/habits.ts` + `habits-actions.ts`). `getHomeData` ya no
devuelve `habits: []` — ahora los trae de Firestore junto con notas y
movimientos. El tipo `Habit` sumó `emoji`.

**Por qué.** La tab Hábitos existía pero no tenía dónde guardar: `getHomeData`
devolvía la colección vacía y `HomeBoard` guardaba los días marcados en
`localStorage` (`maguita:habitos`) con `usePersistentState`. Como la lista de
hábitos siempre venía vacía, no había forma de crear uno y ese log local no
llegaba a mostrarse nunca: la tab quedaba permanentemente en su estado vacío.
Además, atado al `localStorage` la racha se perdía al cambiar de dispositivo o
al limpiar el navegador, que es justo lo que un sistema de rachas no puede
darse el lujo de perder. Ese estado local se eliminó por completo.

```mermaid
erDiagram
    USERS ||--o{ HABITS : "ownerId"
    HABITS {
        string ownerId
        string name
        string emoji
        number goalPerWeek "1 a 7, informativa"
        string_array doneDates "yyyy-mm-dd, arrayUnion/arrayRemove"
        timestamp createdAt
        timestamp updatedAt
    }
```

**Decisión de diseño principal**: el historial de días cumplidos va como
`string[]` adentro del propio hábito y no en una colección `habitLogs`
aparte. La grilla de constancia necesita todos los días juntos de una, así
que una colección aparte costaría una query por hábito (o un índice
compuesto) en cada carga de Inicio; con el array, leer el hábito ya trae su
historial. Ver la sección [`habits/{habitId}`](#habitshabitid) para el resto
de las decisiones (idempotencia del toggle, validación del día, tope de 50).

**Reglas.** `habits` necesita su propio `match`: sin él caía en el
`match /{document=**}` final y quedaba cerrada. Mismo criterio por campo que
`notes`/`links` — el cliente lee lo suyo y no escribe nada, todas las
escrituras pasan por Server Actions. Bloque agregado a `firestore.rules`:

```
    // Hábitos de la tab Hábitos. Id autogenerado, mismo criterio por campo
    // que notes/links: el historial de días cumplidos (`doneDates`) vive
    // adentro del mismo documento, así que no necesita un match aparte.
    match /habits/{habitId} {
      allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
      allow write: if false;
    }
```

**Índices.** Ninguno nuevo: `getHabits` filtra sólo por `ownerId` (equality) y
ordena en memoria, mismo criterio que `getNotes`/`getLinks`.

### 2026-08-02 — Nueva mini-app privada "Links guardados"

- Nueva colección **`links/{linkId}`** (ver sección de arriba para la forma
  completa y las decisiones de diseño, en particular las protecciones contra
  SSRF del fetch de metadata). Guarda enlaces por URL con preview (título,
  descripción, imagen) sacado de sus metatags Open Graph al momento del alta.
  Nuevo `getLinks` (`src/lib/data/links.ts`, sólo Server Components) y
  `addLinkAction` / `deleteLinkAction` (`src/lib/data/links-actions.ts`,
  Server Actions), mismo patrón lectura/escritura que `notes.ts`/
  `notes-actions.ts`. Sin `orderBy`: filtra sólo por `ownerId` y ordena en
  memoria por `createdAt`, mismo criterio que el resto del archivo.
- Nuevo `fetchLinkMetadata` (`src/lib/data/link-metadata.ts`): recorta
  `<head>` del HTML descargado y extrae `og:title`/`og:description`/
  `og:image`/`og:site_name` (con fallback a `<title>`/meta description/
  `twitter:image`) con regex, sin sumar una dependencia de parsing HTML.
  Sigue redirects a mano (hasta 3 saltos) validando cada uno, en vez de
  dejarle el seguimiento a `fetch` — necesario para que el chequeo de IPs
  privadas no se salte con un redirect. Si el fetch falla por lo que sea
  (timeout, host privado, no-HTML, red), `addLinkAction` igual guarda el link
  con la URL y el dominio como único dato, sin bloquear el alta.
- Nueva pantalla `/mini-apps/links`
  (`src/app/(app)/mini-apps/links/page.tsx` + `SavedLinks`,
  `src/components/organisms/mini-apps/SavedLinks.tsx`): un `Input` para
  pegar la URL arriba, y abajo una grilla de `MediaCard` (de
  `lib-kit-components`) con la imagen de preview, título y descripción de
  cada link — tocar la card la abre en una pestaña nueva
  (`window.open(url, "_blank", "noopener,noreferrer")`), un botón de borrar
  con `TrashIcon` corta la propagación del click para no abrir el link de
  paso. Nueva entrada en el catálogo de mini-apps
  (`src/lib/data/mini-apps.ts`, id `links-guardados`, categoría
  Productividad, `requiresAuth: true`) y nuevos `LinkIcon`/`ExternalLinkIcon`
  en `src/components/atoms/icons.tsx` (`LinkIcon` se suma también al mapeo de
  `MiniAppIcon`, que ganó la clave `"link"` en el tipo `MiniApp["icon"]`).
  `ROUTES.miniAppLinks` nueva en `src/lib/app-config.ts`, sumada a
  `PROTECTED_ROUTES`; header propio (`back: true`) en
  `src/components/shell/nav-config.tsx`.
- **Nuevo bloque de reglas en `firestore.rules`** (pegado también en la
  sección de arriba, "Reglas objetivo"):
  ```
  match /links/{linkId} {
    allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
    allow write: if false;
  }
  ```
  Mismo criterio que `notes`/`expenseCycles`: id autogenerado, así que el
  dueño se valida por campo (`ownerId`) en vez de por id de documento.
  Pendiente de publicar contra el proyecto real, igual que el resto de
  `firestore.rules` (ver ⚠️ arriba).
- **Fuera de alcance a propósito**: no hay edición de un link ya guardado (si
  el preview salió mal, hay que borrar y volver a cargarlo); el preview no se
  refresca solo si el sitio cambia sus metatags después del alta; no hay
  carpetas, tags ni orden manual — la grilla siempre es más reciente
  primero; no hay import/export masivo de enlaces.

### 2026-08-01 — Tab Notas con backend real: prioridad, alerta, edición/borrado y grilla animada

- Nueva colección **`notes/{noteId}`** (ver sección de arriba para la forma
  completa y las decisiones de diseño). Antes las notas del FAB
  (`useNoteDrafts`, `lib/data/local-drafts.ts`) sólo quedaban en
  `localStorage`, marcadas `local: true` y mezcladas en el cliente con
  `data.notes` (que `getHomeData` siempre devolvía vacío) — un holdover de
  antes de que existiera backend, mismo estado en el que hoy sigue
  `useExpenseDrafts` para gastos hasta que se migró (ver "El FAB de Inicio
  guarda 'Nuevo gasto' en el gestor de gastos", más abajo). Ahora las notas
  se guardan en Firestore igual que el resto de la app.
- `Note` (`src/lib/data/home.ts`) gana `priority: "low" | "medium" |
  "high"`, `hasAlert: boolean`, `alertDate: string | null` y `alertTime:
  string | null`; pierde `local?: boolean` (ya no hay nada que marcar como
  "todavía no llegó al servidor"). Sin título: se evaluó agregarlo pero se
  sacó del alcance antes de terminar la entrada — una nota es sólo texto +
  metadata, sin campo libre adicional. Nuevo `getNotes`
  (`src/lib/data/notes.ts`, sólo Server Components) y `addNoteAction`
  (`src/lib/data/notes-actions.ts`, Server Action) siguiendo el mismo patrón
  lectura/escritura que `expenses.ts`/`expenses-actions.ts`. `getHomeData`
  pasa a pedir `getNotes(userId)` en el mismo `Promise.all` que el gestor de
  gastos, en vez de devolver `notes: []` fijo.
- **El composer se mudó del FAB al header de la tab Notas.** Antes "Nueva
  nota" abría un sheet chico (sólo texto) desde el FAB global de Inicio;
  ahora `NoteComposer`
  (`src/components/organisms/home/NoteComposer.tsx`) vive siempre visible
  arriba de `NotesPanel`: un `Textarea` grande arriba y, debajo, los dos
  controles que quedan en vez de todos los campos apilados de una. La
  **prioridad** es un chip que abre un `Popover` con las tres opciones y se
  cierra al elegir. La **alerta** es un `Switch` al lado, que al prenderse
  despliega `DatePicker` + `TimePicker` debajo. Pasó por dos iteraciones
  antes de llegar ahí: primero era un chip que abría un popover con un
  `Switch` adentro (dos toques para un booleano), después el chip mismo hacía
  de toggle (un toque, pero un chip no se lee como interruptor), y terminó
  siendo el `Switch` a secas. Prenderlo
  preselecciona hoy como fecha: si quedara vacía, el formulario queda
  inválido sin que se vea por qué (el botón de guardar se apaga y la fecha
  recién aparece más abajo). Sin chip de fecha de la nota a pedido: se guarda
  con el `today` del server, sin selector — ver la decisión de diseño de
  `date` en la sección de arriba. Se sacó del FAB porque cargar
  una nota completa (con alerta) no entra en un sheet chico sin quedar
  apretado, y porque es la acción principal de esa tab — no tiene sentido
  esconderla atrás de un botón flotante que además hay que abrir desde otra
  tab. `quick-actions.tsx` perdió `NewNoteSheet` (sólo le queda
  `ShareAppSheet`) y `local-drafts.ts` se borró entero: sin notas, no le
  quedaba nada adentro. Nuevos `CalendarIcon` / `FlagIcon` en
  `src/components/atoms/icons.tsx`; label/tono de cada prioridad se comparten
  entre el chip del composer y el badge de la grilla desde
  `src/components/organisms/home/note-priority.ts`.
- **"Nueva nota" volvió al FAB, pero sin sheet propio.** La acción
  (`HomeBoard.tsx`) cambia a la tab Notas y enfoca el composer que ya vive
  arriba, en vez de abrir otro formulario: duplicarlo en un sheet
  significaría mantener dos composers con el mismo estado. El puente es un
  **contador** (`focusSignal`, de `HomeBoard` a `NotesPanel` a
  `NoteComposer`) y no un booleano — estando ya parado en la tab Notas, un
  flag que ya vale `true` no volvería a disparar el foco. El composer lo mira
  en un efecto y hace `focus()` + `scrollIntoView()`; arranca en 0, así que
  no se roba el foco al montarse la pantalla.
- `NotesPanel` (`src/components/organisms/home/NotesPanel.tsx`) reemplaza la
  lista vertical por una grilla de post-it (ver más abajo) con una
  **`ProductFilterBar`** arriba: campo de orden (Fecha / Prioridad) con
  toggle asc/desc, panel de filtros por prioridad y por con/sin alerta, y el
  contador de resultados. Es controlada y **no filtra ni ordena por vos** —
  eso lo hace `NotesPanel` con un `filter` + `sortNotes`
  (`src/lib/home-model.ts`, reemplaza a la vieja `byPriorityDesc`: ahora hay
  que poder ordenar en las dos direcciones, no sólo descendente). Los `count`
  de cada faceta se cuentan sobre la lista completa y no sobre la ya
  filtrada: si se descontaran solos al tildarlos, el panel dejaría de servir
  para saber qué más hay.
- **Nuevo bloque de reglas en `firestore.rules`** (pegado también en la
  sección de arriba, "Reglas objetivo"):
  ```
  match /notes/{noteId} {
    allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
    allow write: if false;
  }
  ```
  Mismo criterio que `expenseCycles`/`expenseMovements`: id autogenerado, así
  que el dueño se valida por campo (`ownerId`) en vez de por id de documento.
  Pendiente de publicar contra el proyecto real, igual que el resto de
  `firestore.rules` (ver ⚠️ arriba).
- **El detalle es el mismo post-it, en grande.** Cada card de la grilla abre
  `NoteDetailModal` (`src/components/organisms/home/NoteDetailModal.tsx`):
  papel del color de su prioridad, esquina doblada y todo, centrado sobre un
  backdrop. **No usa el `Modal` de la librería** — ese trae su propia
  superficie (`surface`, header y footer con bordes) y no hay forma de que se
  lea como papel. El overlay se arma a mano con el mismo patrón que
  `shell/notification-drawer.tsx` (backdrop `z-[140]` + panel `z-[150]`,
  bloqueo del scroll del body, foco al abrir, cierre con Escape o tocando
  afuera), que es lo que ya hace la app cuando la librería no tiene el
  contenedor que hace falta.
- **Editar y borrar salieron de la botonera a un menú de tres puntitos**
  (`MoreIcon`, nuevo en `icons.tsx`, sobre el `Dropdown` de la librería con
  "Eliminar" en `destructive`): el papel queda limpio y las dos acciones
  aparecen sólo cuando se las busca. El menú se renderiza en la cabecera,
  fuera del área scrolleable del panel — adentro, el `overflow-y-auto` le
  recortaría el desplegable. Borrar sigue confirmando en el mismo panel, sin
  apilar otro encima: las tres caras (ver / editar / confirmar) son un único
  estado `mode` y se cruzan con `AnimatePresence mode="wait"`.
- **Animaciones del detalle**: el papel entra como si se apoyara (baja, se
  agranda y se endereza desde −2°, con spring) y sale girando apenas para el
  otro lado; el backdrop hace fade con blur; el contenido cruza con un fade +
  desplazamiento corto al cambiar de cara. Se evaluó una transición de
  elemento compartido (`layoutId`) para que el post-it de la grilla se
  expandiera en el del detalle, pero la card ya combina `layout` con `rotate`
  en capas separadas justamente porque no conviven, y sumarle un tercer nodo
  compartido rotado era la receta para que se deformara en el medio: no valía
  el riesgo contra una entrada con spring que se ve bien y no puede romperse.
- Volver el panel a "ver" al cerrarse se hace en la función `close()` que
  usan todos los caminos de cierre, no en un efecto sobre `note`: un
  `setState` dentro de un efecto dispara renders en cascada y el eslint del
  repo lo rechaza. Con el backdrop puesto no se puede abrir otra nota sin
  cerrar la actual, así que no hace falta más que eso.
- `note` se recibe como prop derivada de la lista (`notes.find(...)` en
  `NotesPanel`), no copiada aparte: al guardar una edición o al borrar, el
  `revalidatePath` de la Server Action refresca `data.notes` y el modal
  muestra el texto nuevo (o se cierra solo, si ya no está) sin lógica extra
  de sincronización. Nuevos `updateNoteAction` / `deleteNoteAction`
  (`src/lib/data/notes-actions.ts`), con un `getOwnedNoteRef` que centraliza
  "traer + validar dueño" — mismo criterio que `getOwnedActiveCycle` en
  `expenses-actions.ts` — y `assertValidNoteFields` factoreado de
  `addNoteAction` para no duplicar las validaciones entre alta y edición.
  Nuevo `NoteEditor` (`src/components/organisms/home/NoteEditor.tsx`): los
  mismos campos que `NoteComposer` pero en un form apilado — mismo criterio
  de "cada uno con su propio estado, sin compartir un hook" que ya usan
  `ExpenseCycleForm`/`ExpenseCycleEditor`. Se edita sobre el papel de color:
  los inputs traen su propio fondo `surface`, así que se leen como campos
  apoyados sobre la nota y no hace falta cambiarle el color al panel para
  entrar en modo edición.
- **Grilla animada de post-it, en una o dos columnas.** Las notas dejaron de
  ser `Card` de la librería: son papel: fondo de color según prioridad,
  `rounded-sm`, `shadow-lg`, esquina doblada (un triángulo `foreground/10`
  recortado con `clip-path`) y una inclinación de ±0.8°. La inclinación sale
  del id de la nota (`tiltOf`), no del índice — atada a la posición, cambiar
  el orden o borrar una nota le movería el ángulo a todas las demás. Sobre el
  papel de color no van los chips de `NOTE_PRIORITY_TONE` (están pensados
  para `surface`): la meta se escribe en `foreground/65`, que se invierte
  solo con el tema igual que el papel.
- **Tres tokens nuevos en `globals.css`** (`--color-note-high` / `-medium` /
  `-low`), con su variante en `.dark`: en claro son pasteles y en oscuro los
  mismos hues apagados — un pastel claro sobre el fondo casi negro encandila
  y encima invertiría el texto, que sigue siendo `foreground`. El mapa
  prioridad → clase vive en `note-priority.ts` (`NOTE_PRIORITY_PAPER`) con
  las clases escritas enteras: Tailwind escanea el fuente como texto, así que
  un `bg-note-${x}` armado en runtime no generaría ninguna de las tres.
  `NoteDetailModal` usa el mismo papel para el cuerpo de la nota, así abrirla
  no le hace perder la identidad con la que se la venía viendo en la grilla.
- **El color no es el único portador de la prioridad**: la card sigue
  escribiendo "Alta"/"Media"/"Baja" al pie. Es lo que la mantiene legible con
  daltonismo — y de paso hace que el papel se pueda leer de un vistazo sin
  tener que recordar qué significaba cada color.
- La animación (`framer-motion`, ya dependencia directa — mismo patrón que
  `shell/notification-drawer.tsx`) va en **dos capas anidadas a propósito**:
  la de afuera lleva `layout` + entrada/salida (fade y slide-up escalonado
  por índice, fade al borrar), la de adentro el `rotate` y el hover (se
  endereza y se levanta). `layout` y `rotate` en el mismo nodo no conviven:
  framer deforma el contenido al interpolar la posición de algo rotado.
- **Selección múltiple para borrar de a varias.** Un botón de tilde al lado
  del selector de columnas entra en modo selección: los post-it dejan de
  abrir el detalle y pasan a marcarse (anillo `primary` + tilde en la
  esquina, los no marcados atenuados), y aparece una barra con el conteo,
  "Todas"/"Ninguna", "Cancelar" y "Eliminar". Borrar confirma en la misma
  barra antes de ejecutar — es la acción más destructiva de la pantalla y es
  fácil llegar a ella con muchas notas marcadas. Nueva Server Action
  `deleteNotesAction` (ver arriba).
- Lo que se borra es la **intersección de lo seleccionado con lo visible**
  (`selectedVisible`), no el set crudo: sin eso, marcar tres notas, cambiar
  el filtro y tocar "Eliminar" se llevaría notas que no están en pantalla. Y
  como se calcula en cada render, no hace falta ningún efecto que limpie la
  selección cuando cambian los filtros.
- Nuevo selector de **1 o 2 columnas** (`ColumnOneIcon` / `ColumnTwoIcon` en
  `icons.tsx`), al lado de la `ProductFilterBar`, con la elección persistida
  en `localStorage` (`usePersistentState`, clave `maguita:notas-columnas`,
  SSR-safe) — es una preferencia de lectura, no algo para volver a elegir en
  cada visita. La grilla pasó de `grid-cols-1 sm:grid-cols-2` fijo a
  `gridTemplateColumns` inline, y como las cards tienen `layout`, cambiar de
  columnas las reacomoda animadas en vez de saltar. Va afuera de la barra
  porque `ProductFilterBar` no expone ningún slot para sumarle un control
  propio, y porque la densidad de la grilla no es un filtro: no cambia qué
  notas se ven, sólo cómo. Se evaluó `CardGrid` de la librería (hace
  exactamente esto, con persistencia incluida) pero su chrome de controles —
  label "Columnas" + caja −/+ **y** pills numeradas — es demasiado para una
  elección binaria que acá entra en dos íconos.
- **El panel del `TimePicker` se abre hacia arriba** en el composer y en el
  editor. El componente no expone hacia qué lado abrirlo: lo posiciona
  `absolute` sin `top` ni `bottom`, así que siempre cae debajo del input — y
  en las dos pantallas es el último campo del formulario, con lo cual el
  panel se abre contra el borde de abajo. `TIME_PICKER_UPWARD`
  (`note-priority.ts`) lo da vuelta desde el `className` del propio
  componente, con variantes arbitrarias que apuntan a su único hijo directo
  `absolute` (el panel; label, input y hint no lo son). Es un parche sobre
  markup ajeno, así que queda en una constante compartida y comentada: si la
  librería suma un prop de posición, se borra de un lugar solo.
- **`lib-kit-components` actualizado** (`37b64c3` → `23eae87`): `TimePicker` y
  `ProductFilterBar` ya existían upstream pero el checkout de `node_modules`
  estaba viejo, así que la primera versión de esta pantalla los había suplido
  con un `Input type="time"` y un `Select`. De paso el paquete cambió de
  forma: ya no publica `components/` con el fuente, sólo `dist/` — el
  `@source "…/lib-kit-components/dist"` de `globals.css` sigue apuntando bien
  (verificado: las clases que sólo usa la librería, como el `z-[95]` del
  `Popover`, siguen apareciendo en el CSS compilado).
- **Fuera de alcance a propósito**: la alerta se guarda pero no dispara
  ninguna notificación todavía (no hay integración con push/notificaciones
  del navegador) — es sólo el dato, para cuando exista ese mecanismo; y las
  referencias a `NewNoteSheet`/`useNoteDrafts` en entradas de este changelog
  anteriores a esta quedan tal cual estaban al escribirse, como registro
  histórico.

### 2026-08-01 — Fix: "Nuevo gasto" del FAB no cerraba el sheet ni avisaba al guardar

- Sin cambios de datos. Dos fixes en el flujo de alta de un gasto:
  1. `NewExpenseMovementSheet`/`NewExpenseIncomeSheet`
     (`src/components/organisms/home/`) no tenían try/catch alrededor de la
     Server Action: si `addExpenseMovementAction`/`addExpenseIncomeAction`
     rechazaba (categoría borrada entre que se abrió el sheet y se guardó,
     período recién finalizado, etc.), el rechazo se perdía en silencio —
     ni el snack de éxito ni `onSaved()`/`closeSheet()` corrían, y tampoco
     había un snack de error. Ahora atrapan el error y muestran un snack
     `variant="error"` con el mensaje de la excepción; el sheet queda
     abierto para reintentar.
  2. El FAB de Inicio (`HomeBoard.tsx`) dejó de usar `FabActionSheets` de
     `lib-kit-components` — monta sus tres `BottomSheet` propios sin
     exponer ninguna forma de cerrarlos desde adentro de su `content`, así
     que "Nuevo gasto" desde el FAB **nunca** podía cerrarse solo (a
     diferencia de abrirlo desde Movimientos, que sí usa el sheet propio de
     la app). Ahora las tres acciones del FAB (`quickActions`) usan
     `FloatingButton` directo + `useAppSheet()` — el mismo sheet global que
     ya usan Movimientos y Notas —, así que "Nuevo gasto" le pasa
     `onSaved={closeSheet}` a `NewExpenseMovementSheet` igual que desde
     Movimientos, y se cierra solo al guardar sin importar desde dónde se
     abrió.
- **Fuera de alcance a propósito**: "Nueva nota" y "Compartir" del FAB
  siguen sin cerrarse solos (no se les pasó `onSaved`/`closeSheet`) — no
  era el bug reportado, y una nota no tiene la misma necesidad de
  confirmación visual inmediata que cargar un gasto.

### 2026-08-01 — Ítems de movimientos con elevación

- Sin cambios de datos. Nuevo `MovementsList`
  (`src/components/organisms/home/MovementsList.tsx`), que reemplaza a
  `TransactionList` de `lib-kit-components` en las tres pantallas donde se
  listan movimientos (`MovementsPanel`, `SummaryPanel`, `PeriodDetailScreen`):
  agrupa por día igual que antes, pero cada movimiento es su propia `Card
  variant="elevated"` (borde + `shadow-lg`) en vez de una fila plana dentro
  de una lista con `divide-y`. `TransactionList` no tiene forma de darle
  elevación a sus filas (son `<li>` fijos del componente), así que no había
  manera de pedir esto sin dejar de usarlo.
- De paso se resolvió una fuente de mismatch de hidratación que ya tenía
  `TransactionList`: agrupaba "Hoy"/"Ayer" con `new Date()` real adentro del
  componente, en vez del `today` que ya resuelve una sola vez el server.
  `MovementsList` agrupa con `formatDay` (con `today`) o, si no se lo pasan
  (`PeriodDetailScreen`, un período ya cerrado donde "Hoy"/"Ayer" no
  aplica), con `formatShortDate` — fecha absoluta.
- **Fuera de alcance a propósito**: `TransactionList` traía chips de filtro
  por categoría; `MovementsList` no los tiene. No se pidieron y agregarlos
  hubiera significado reconstruir esa lógica a mano.

### 2026-08-01 — Pantalla de detalle de un período anterior

- Sin colecciones ni campos nuevos: nueva forma de leer `expenseCycles` /
  `expenseMovements` que ya existían.
- Nueva `getExpenseCycleById(userId, cycleId)`
  (`src/lib/data/expenses.ts`): trae un ciclo puntual por id (cualquier
  `status`, no sólo `active`) y devuelve `null` tanto si no existe como si
  es de otra cuenta — la Server Action del Admin SDK saltea las reglas, así
  que esta verificación de dueño es la barrera real. La página nueva trata
  los dos casos igual (`notFound()`), para no delatar cuál de los dos pasó.
- Nueva ruta dinámica `/inicio/periodos/{cycleId}`
  (`src/app/(app)/inicio/periodos/[cycleId]/page.tsx`), a la que se llega
  tocando una card del carrusel de "Períodos anteriores"
  (`PastExpenseCyclesSection`, ahora envuelve cada card en un `Link`). Ya
  cubierta por sesión en dos capas: el prefijo `/inicio` de
  `PROTECTED_ROUTES` matchea por `startsWith` (sin agregar nada al array) y
  `(app)/layout.tsx` llama `requireSession()` en todo lo que cuelga de él.
  `headerFor` (`src/components/shell/nav-config.tsx`) le agrega un `if`
  de prefijo — es la única ruta dinámica hoy, así que no encaja en el mapa
  fijo de `SCREEN_HEADERS`.
- `PeriodDetailScreen`
  (`src/components/organisms/home/PeriodDetailScreen.tsx`): resumen del
  ciclo (saldo inicial/ingresos/saldo final + barra de tope), categorías
  con más gasto y días con más consumo (las dos como barras de un solo
  color — ver nota de diseño abajo), y el listado completo de operaciones
  con `TransactionList`. Nuevas funciones puras en `home-model.ts`:
  `categoryBreakdown` y `dailyBreakdown` (agrupan y suman gastos por
  categoría/día), y `shortDate` pasa a exportarse como `formatShortDate`
  (la necesitan también estas dos gráficas).
- **Nota de diseño (paleta de las gráficas)**: categorías y días son listas
  de "magnitud, ¿cuál es más alto?", no series a diferenciar por identidad
  — así que llevan un solo hue (`primary`) en vez de una paleta categórica.
  Evita además un problema real: las categorías son libres/ilimitadas (el
  ABM del usuario), así que una paleta categórica se quedaría sin colores
  distinguibles por CVD tarde o temprano; la etiqueta + emoji de cada fila
  ya cargan la identidad, el color sólo carga la magnitud. Días con más
  consumo usa el patrón "emphasis": todas las barras en `primary/35`
  (contexto) y el día pico en `accent` (el punto de la historia) — one hue
  + gray, no un color por barra.
- **Sin cambios de reglas**: la lectura va por el Admin SDK (Server
  Component/Action), que ya saltea `firestore.rules`.

### 2026-08-01 — Fix: "Balance del mes" del tab Resumen no coincidía con Movimientos

- Sin cambios de datos. Bug en `SummaryPanel`
  (`src/components/organisms/home/SummaryPanel.tsx`): calculaba el balance
  con la vieja `monthBalance` (`income - expense` de los movimientos cuya
  `date` cae en el mes calendario de `today`), que quedó pisada por el
  gestor de gastos sin actualizarse. Dos problemas: (1) `movements` ya son
  sólo los del ciclo activo (`getHomeData`), y un período no tiene por qué
  coincidir con un mes calendario (ej. "Gastos vacaciones Ushuaia" del
  15/08 al 15/09) — filtrar por mes de nuevo descartaba movimientos del
  ciclo o mezclaba con el mes siguiente; (2) ni sumaba el saldo inicial, así
  que el número no coincidía con "Saldo disponible" de `MovementsPanel`
  para lo que es el mismo período.
- Ahora usa `expenseCycleProgress` (`src/lib/home-model.ts`), la misma
  función que ya usa `MovementsPanel` — mismo cálculo, mismo número. La
  card pasa a llamarse "Saldo disponible" (antes "Balance del mes", que ya
  no describía lo que mostraba) y `SummaryPanel` gana el prop
  `expenseCycle: ExpenseCycle | null`; sin ciclo activo muestra "Sin
  período activo" en vez de calcular sobre una lista vacía.
- `monthBalance`/`MonthBalance` se borraron de `home-model.ts`: sin este
  último uso, quedaban muertos.

### 2026-08-01 — Carrusel de "Períodos anteriores" en Movimientos

- Sin colecciones ni campos nuevos: lee `expenseCycles`/`expenseMovements`
  tal como ya existían, sólo con un filtro (`status: "closed"`) que antes
  nadie usaba — los ciclos cerrados existían desde "Finalizar", pero no
  había ninguna pantalla que los mostrara.
- Nueva `getClosedExpenseCycles` (`src/lib/data/expenses.ts`): trae hasta
  10 ciclos `closed` del usuario (`ownerId` + `status`, sin `orderBy` —
  ordena en memoria, mismo criterio que `getExpenseMovements`) y, en una
  sola consulta aparte con `where("cycleId", "in", [...])` sobre
  `expenseMovements`, el gastado/ingresado de esos mismos ciclos — evita
  N+1 consultas (una por ciclo) a costa de un único `in` con como máximo 10
  valores, bien por debajo del límite de 30 que acepta Firestore.
- Nueva Server Action de sólo lectura `getPastExpenseCyclesAction`
  (`src/lib/data/expenses-actions.ts`): existe porque
  `getClosedExpenseCycles` vive en un módulo `server-only`, y el nuevo
  `PastExpenseCyclesSection` (dropdown + carrusel) la llama bajo demanda
  desde el cliente, no en el fetch inicial de `getHomeData()` — la mayoría
  de las visitas a Movimientos no llegan a abrir el historial, así que no
  tiene sentido pagar esa consulta siempre.
- `PastExpenseCyclesSection`
  (`src/components/organisms/home/PastExpenseCyclesSection.tsx`): un
  dropdown ("Períodos anteriores") que al desplegarse por primera vez pide
  los períodos cerrados y los cachea en estado local (cerrar/reabrir no
  repite la consulta) mientras muestra un skeleton; con datos, una fila de
  cards con scroll horizontal (título o lapso de fechas, barra de progreso
  del tope y gastado/tope/saldo final). Se monta en `MovementsPanel`, con o
  sin ciclo activo — el historial no depende de que haya uno en curso.
- **Sin cambios de reglas**: la lectura va por el Admin SDK (Server
  Action), que ya saltea `firestore.rules`; no se agregó ningún campo a
  documentos existentes.

### 2026-08-01 — Selector de emoji en vez de input de texto libre en categorías

- Sin cambios de datos: `ExpenseCategoryItem.emoji` sigue siendo un
  `string`, sólo cambia cómo se lo carga en la UI.
- Nuevo `EmojiPicker` (`src/components/molecules/EmojiPicker.tsx`): botón
  con el emoji elegido (o un `+` si no hay ninguno) que abre una grilla de
  un set curado de ~32 emojis relevantes para categorías de gasto. Mismo
  patrón de popover + cierre por click afuera que ya usa `DatePicker` de
  `lib-kit-components`.
- `ExpenseCategoriesEditor` (`src/components/organisms/home/ExpenseCategoriesEditor.tsx`)
  reemplaza el `Input` de texto libre del emoji, tanto en el alta como en la
  edición de una categoría, por `EmojiPicker`. El nombre sigue siendo un
  `Input` normal — es el único campo de texto que le queda al editor.

### 2026-08-01 — Título de período y "Finalizar" en vez de "Reiniciar"

- `ExpenseCycleDoc` (`src/lib/firebase/collections.ts`) gana `title: string
  | null`; `ExpenseCycle` (`src/lib/data/expenses.ts`) idem. `null` = el
  usuario no le puso título, y la UI cae al lapso de fechas.
- `startExpenseCycleAction` / `updateExpenseCycleAction`
  (`src/lib/data/expenses-actions.ts`) ganan `title?: string`, opcional;
  vacío o ausente se guarda como `null` (`input.title?.trim() || null`).
- Nuevas funciones puras en `src/lib/home-model.ts`: `formatDateRangeShort`
  (`"01/08 al 31/08"`, recorta el string de la day key directo — no pasa
  por `Date`, así que no hay huso que corra el día) y `expenseCycleTitle`,
  que devuelve `cycle.title` si está o cae a `formatDateRangeShort`. La
  usan `MovementsPanel` (título de la card) y sirve de referencia para lo
  que va a mostrar la futura mini-app.
- `ExpenseCycleForm` (alta) y `ExpenseCycleEditor` (sección "Período" del
  panel de ajustes) ganan un `Input` "Título (opcional)".
- **Renombre de "Reiniciar" a "Finalizar"**: el botón de la card y el modo
  `"reset"` de `ExpenseCycleForm` (ahora `"finish"`) no reiniciaban nada —
  cierran el ciclo actual (que queda como historial) y arrancan uno nuevo
  desde cero, con sus propios título/fechas/saldo/tope. "Reiniciar" sugería
  volver a poner en cero el mismo período; "Finalizar" describe lo que
  realmente pasa. Sin cambio de comportamiento, sólo de texto (label del
  botón, título/descripción del sheet, texto del botón de submit y el
  snack de éxito).
- **Sin cambios de reglas**: `title` es un campo más de un documento que
  `firestore.rules` ya cubre entero (`expenseCycles/{cycleId}`, lectura por
  `ownerId`, escritura sólo por Admin SDK) — Firestore no tiene reglas a
  nivel de campo para lectura, mismo caso que `alias`/`avatarUrl` en
  `users/{uid}` (ver esa entrada más abajo).

### 2026-08-01 — Inputs de monto con separador de miles en vivo

- Sin cambios de datos: es sólo el input de "Saldo inicial" y "Tope de
  gastos" (`ExpenseCycleForm`, `ExpenseCycleEditor`). Antes eran un `Input`
  de texto plano de `lib-kit-components`, con el número crudo tal cual lo
  tipeaba el usuario.
- Nuevo `AmountInput` (`src/components/molecules/AmountInput.tsx`): `type="text"`
  + `inputMode="numeric"` (no `type="number"`, que no acepta un valor con
  puntos de miles) que formatea con `toLocaleString("es-AR")` en cada
  tecleo — escribir "150000" muestra "150.000" a medida que se escribe.
  Guarda/expone el valor como `number`, no como string; los dos forms
  dejaron de parsear con `Number(x.replace(",", "."))`.
  Más grande que el `Input` de la librería (`py-3.5 text-lg` vs. su
  `h-12 text-sm` fijo, que no es overrideable por `className` porque esas
  clases están en el `<input>` interno, no en el wrapper) — a propósito,
  para que el monto se lea más parecido a como se lo ve en
  `NewExpenseMovementSheet`/`NewExpenseIncomeSheet` (que ya mostraban el
  monto grande y formateado, pero con `Keypad` en vez de un input real).

### 2026-08-01 — El FAB de Inicio guarda "Nuevo gasto" en el gestor de gastos

- Sin cambios de datos ni de reglas: `expenseMovements` ya tenía todo lo que
  hace falta. El cambio es de dónde y cómo se dispara el alta.
- El "Nuevo gasto" del FAB de Inicio (`FabActionSheets`, montado en
  `HomeBoard`) dejaba lo cargado en `localStorage` (`useExpenseDrafts`,
  `lib/data/local-drafts.ts`) sin tocar Firestore — un holdover de antes de
  que existiera el gestor de gastos. Ahora abre el mismo
  `NewExpenseMovementSheet` que usa `MovementsPanel`, que guarda contra el
  ciclo activo con `addExpenseMovementAction`. `useExpenseDrafts`,
  `movementFromDraft`, `ExpenseDraft` y la clave `DRAFT_KEYS.expenses` se
  borraron de `local-drafts.ts` (`useNoteDrafts`/notas siguen igual, sin
  backend todavía). `HomeBoard` ya no mezcla ningún borrador de gastos con
  `data.movements` — los movimientos que muestra son sólo los del ciclo
  activo, tal como los devuelve el server.
- `NewExpenseMovementSheet` ahora se monta en dos mecanismos de sheet
  distintos: el propio de `MovementsPanel` (`useAppSheet()`, con
  `closeSheet()` real) y `FabActionSheets`, que **no** expone ninguna forma
  de cerrarse desde adentro de su `content` (son sheets fijos, sólo
  `openIdx`/`onClose` internos de la librería). Por eso el componente dejó
  de llamar a `useAppSheet().closeSheet()` directo y ahora recibe un
  `onSaved?: () => void` opcional: `MovementsPanel` le pasa `closeSheet`,
  `HomeBoard` no le pasa nada (mismo criterio que ya tenían
  `NewNoteSheet`/el viejo `NewExpenseSheet` del FAB: guardan, muestran un
  snack y dejan el sheet abierto para que el usuario lo cierre a mano).
- Sin ciclo activo, "Nuevo gasto" del FAB muestra un aviso
  (`NoActiveExpenseCycleNotice`, en `HomeBoard.tsx`) con un botón a la tab
  Movimientos en vez del formulario — cargar un gasto no tiene sentido sin
  un período contra el cual cargarlo. Por esto mismo `QUICK_ACTIONS` pasó de
  ser una constante de módulo a un `useMemo` adentro de `HomeBoard`: ese
  ítem del FAB depende de `data.expenseCycle`/`data.expenseCategories`, que
  antes ninguna de las tres acciones necesitaba.

### 2026-08-01 — Panel de ajustes único para período y categorías

- Sin cambios de datos ni de reglas: es una reorganización de UI sobre lo de
  las dos entradas de abajo. Antes "Categorías" y "Editar" (tope/fechas)
  eran dos sheets sueltos, cada uno con su propio botón; ahora comparten un
  único sheet "Ajustes" (`ExpenseSettingsSheet`,
  `src/components/organisms/home/ExpenseSettingsSheet.tsx`), con la sección
  de período arriba (sólo si hay ciclo activo) y la de categorías abajo,
  separadas por un borde. `MovementsPanel` pasó de tres botones ghost
  ("Categorías", "Editar", "Reiniciar") a dos: un ícono de ajustes
  (`SettingsIcon`) y "Reiniciar" (que sigue aparte a propósito: cierra el
  ciclo y arranca uno nuevo, no es un simple ajuste).
- Los dos sheets viejos se renombraron a secciones reutilizables:
  `EditExpenseCycleSheet` → `ExpenseCycleEditor`
  (`src/components/organisms/home/ExpenseCycleEditor.tsx`) y
  `ExpenseCategoriesSheet` → `ExpenseCategoriesEditor`
  (`src/components/organisms/home/ExpenseCategoriesEditor.tsx`) — las
  referencias a los nombres/archivos viejos en las entradas de abajo quedan
  como estaban al escribirse, este es el puntero vigente.
- `ExpenseCycleEditor` dejó de cerrar el sheet al guardar (antes lo hacía
  como sheet independiente): ahora vive arriba de la sección de categorías
  dentro del mismo panel, así que cerrarlo de golpe cortaría si el usuario
  todavía quería tocar algo más ahí abajo. Mismo criterio que ya tenía
  `ExpenseCategoriesEditor`, que nunca cerró el sheet solo.

### 2026-08-01 — Ingresos y edición en curso del ciclo de gastos

- **No hay colección nueva**: los ingresos son `expenseMovements` con
  `amount` positivo y la categoría fija `"Ingreso"` / `💰` (no pasan por el
  ABM de categorías de gasto). `expenseCycles` no gana campos — se le puede
  actualizar `startDate`/`endDate`/`expenseLimit` en el lugar.
- Nueva Server Action `addExpenseIncomeAction`
  (`src/lib/data/expenses-actions.ts`): igual chequeo de dueño/`status:
  "active"` que `addExpenseMovementAction`, pero sin categoría y guardando el
  monto en positivo. Nuevo sheet `NewExpenseIncomeSheet`
  (`src/components/organisms/home/NewExpenseIncomeSheet.tsx`, mismo `Keypad`
  embebido que el de gasto), abierto por un botón **"Ingreso"** nuevo en
  `MovementsPanel`, al lado de "Gasto".
- Nueva Server Action `updateExpenseCycleAction`: cambia tope de gastos y/o
  lapso de fechas de un ciclo `active` sin cerrarlo ni tocar sus
  movimientos — a diferencia de `startExpenseCycleAction` ("Reiniciar"), que
  cierra el actual y arranca uno nuevo. El saldo inicial queda afuera a
  propósito: cambiarlo a mitad de período resignificaría los gastos ya
  cargados contra un punto de partida distinto al que tenían al cargarse.
  Nuevo sheet `EditExpenseCycleSheet`
  (`src/components/organisms/home/EditExpenseCycleSheet.tsx`), prefilled con
  los valores del ciclo actual, abierto por un botón **"Editar"** nuevo en
  `MovementsPanel`.
- Ambas acciones nuevas y `addExpenseMovementAction` comparten el chequeo de
  dueño/estado a través de un helper `getOwnedActiveCycle`
  (`src/lib/data/expenses-actions.ts`), antes duplicado en cada función.
- `expenseCycleProgress` (`src/lib/home-model.ts`) suma un campo `income` y
  `remaining` pasa de `initialBalance - spent` a
  `initialBalance + income - spent`: antes los ingresos no existían, así que
  el saldo disponible sólo restaba gastos.
- **Sin cambios de reglas**: `updateExpenseCycleAction` sólo hace `update()`
  sobre un documento que ya cubre la regla existente de `expenseCycles/{cycleId}`
  (lectura por `ownerId`, escritura sólo por Admin SDK); los ingresos son
  documentos de `expenseMovements` con la misma forma y las mismas reglas que
  los gastos.

### 2026-08-01 — ABM de categorías del gestor de gastos

- Nueva colección **`expenseCategories/{uid}`**: un documento por cuenta con
  el array `{ id, name, emoji }[]` (ver sección de arriba para la forma
  completa, los defaults y las decisiones de diseño). Antes las categorías
  eran una lista fija en código (`EXPENSE_CATEGORIES` en `home-model.ts`,
  sin emoji); ese export se eliminó.
- `ExpenseMovementDoc` (`src/lib/firebase/collections.ts`) gana
  `categoryEmoji: string`; `category` deja de ser un valor de una lista fija
  para ser el nombre de una categoría real del ABM, copiado al momento del
  alta (no una referencia). `Movement` (`src/lib/data/home.ts`) gana
  `categoryEmoji?: string` — lo usa `MovementsPanel` para pasarle un `icon`
  (el emoji) a cada fila de `TransactionList`.
- `AddExpenseMovementInput.category` pasa a ser `categoryId`:
  `addExpenseMovementAction` (`src/lib/data/expenses-actions.ts`) resuelve
  nombre/emoji del lado del server contra `expenseCategories/{uid}` (nunca
  confía en un nombre/emoji que mande el cliente) y rechaza el alta si el id
  no existe en la lista del usuario.
- Nuevas Server Actions `upsertExpenseCategoryAction` /
  `deleteExpenseCategoryAction`
  (`src/lib/data/expense-categories-actions.ts`), mismo patrón
  read-modify-write en transacción que `toggleFavorite`: devuelven el array
  completo ya actualizado, no sólo el item tocado.
- Nuevo sheet `ExpenseCategoriesSheet`
  (`src/components/organisms/home/ExpenseCategoriesSheet.tsx`): lista con
  editar/borrar por fila y alta al pie (emoji + nombre). Se abre con un
  botón "Categorías" nuevo en `MovementsPanel`, visible tanto con ciclo
  activo como en el alta inicial.
- `NewExpenseMovementSheet` recibe `categories` como prop (resuelta por
  `getHomeData` → `HomeData.expenseCategories`) y arma los chips del
  `ChipCarousel` con emoji + nombre; si el usuario borró todas sus
  categorías, muestra un aviso en vez del carrusel vacío.
- **El `Keypad` reemplaza a `AmountPad`** en `NewExpenseMovementSheet`: el
  monto se carga con un teclado numérico embebido directo en el sheet
  (`Keypad` de `lib-kit-components`, acumulando dígitos a mano) en vez de
  abrir `AmountPad`, que es un overlay a pantalla completa aparte — los
  pesos acá son siempre enteros, así que no hace falta su tecla de coma ni
  su UI de pantalla completa.
- **Fix**: `AppSheetProvider` (`src/components/shell/app-sheet.tsx`) guardaba
  sólo `open: boolean`; si se abría un sheet (ej. "Nuevo gasto") y se
  navegaba a otra pantalla sin cerrarlo a mano (ej. tocando otro tab del
  BottomNav), quedaba flotando sobre una pantalla que no tenía nada que ver,
  con datos (`cycleId`) de un contexto que ya no aplicaba. Ahora guarda
  `{ path, open }` y deriva `open` comparando contra la ruta actual — mismo
  patrón que ya usaba `AppShell` para la tab activa y el buscador — así se
  cierra solo en cada cambio de ruta, sin un efecto aparte. De paso corrige
  el mismo riesgo latente en el sheet de `MiniAppsGrid`, que comparte la
  misma infraestructura.
- **Nuevo bloque de reglas en `firestore.rules`** (pegado también en la
  sección de arriba, "Reglas objetivo"):
  ```
  match /expenseCategories/{uid} {
    allow read: if isOwner(uid);
    allow write: if false;
  }
  ```
  Mismo criterio que `users`/`favorites`: el id del documento es el `uid`,
  así que alcanza con `isOwner(uid)` en vez del patrón por campo `ownerId`
  que usan `expenseCycles`/`expenseMovements` (que tienen id autogenerado).
  Pendiente de publicar contra el proyecto real, igual que el resto de
  `firestore.rules` (ver ⚠️ arriba).
- **Fuera de alcance a propósito**: no hay reordenamiento manual de
  categorías (quedan en orden de alta); no hay picker de emoji nativo, se
  escribe con el teclado de emoji del dispositivo/SO; borrar una categoría
  no ofrece "reasignar" los movimientos que ya la usaban (igual no hace
  falta: quedan con el nombre/emoji copiado al momento del alta).

### 2026-08-01 — Gestor de gastos en la tab Movimientos

- Nuevas colecciones **`expenseCycles`** y **`expenseMovements`** (ver
  sección de arriba para la forma completa de cada documento y las
  decisiones de diseño). Simplificación de lo que va a ser una mini-app de
  gastos compartidos más adelante: misma colección, hoy sólo consumida desde
  la tab Movimientos de Inicio.
- `HomeData` (`src/lib/data/home.ts`) gana `expenseCycle: ExpenseCycle |
  null`; sus `movements` pasan de estar siempre vacíos a ser los del ciclo
  `active` del usuario (`[]` si todavía no armó ninguno).
- `MovementsPanel` (`src/components/organisms/home/MovementsPanel.tsx`) deja
  de ser un placeholder: sin ciclo activo muestra el alta
  (`ExpenseCycleForm`, `DatePicker` en modo rango + saldo inicial + tope);
  con uno, una card con el saldo disponible y una `ProgressBar` del % del
  tope gastado, más la lista de movimientos del período
  (`TransactionList`). El botón "Nuevo gasto" de esta tab abre
  `NewExpenseMovementSheet`, que carga el movimiento contra el ciclo activo
  vía `addExpenseMovementAction` — a diferencia del "Nuevo gasto" del FAB
  global (`quick-actions.tsx`), que se deja sin tocar y sigue guardando en
  `localStorage` (borrador rápido desde cualquier pantalla, sin período
  asociado); unificar los dos quedó fuera de alcance a propósito, ver nota
  más abajo.
- **Nuevo bloque de reglas en `firestore.rules`** (pegado también en la
  sección de arriba, "Reglas objetivo"):
  ```
  match /expenseCycles/{cycleId} {
    allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
    allow write: if false;
  }

  match /expenseMovements/{movementId} {
    allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
    allow write: if false;
  }
  ```
  Mismo criterio que el resto del archivo: todas las escrituras van por
  Server Actions con el Admin SDK, que saltea las reglas — la lectura del
  cliente se limita a lo propio, validado por `ownerId` en vez de por id de
  documento porque acá el id es autogenerado (no el `uid`, como en
  `users`/`favorites`). Pendiente de publicar contra el proyecto real, igual
  que el resto de `firestore.rules` (ver ⚠️ arriba).
- **Fuera de alcance a propósito**: no hay UI para ver el historial de
  ciclos cerrados (quedan en Firestore con `status: "closed"`, sin pantalla
  que los liste); el FAB global "Nuevo gasto" sigue siendo un borrador local
  sin conectar al gestor de gastos, porque `FabActionSheets` monta sus tres
  sheets de una y no pueden depender de datos que hoy sólo resuelve el
  Server Component de Inicio (ver comentario en
  `src/components/organisms/quick-actions.tsx`); y `category` de
  `expenseMovements` queda fija en `"Gastos"` — no hay selector de categoría
  en el alta.

### 2026-08-01 — Pantalla de editar perfil: subida real de avatar a Firebase Storage

- Cierra el pendiente `IMAGE_STORAGE_PROVIDER` (ver entrada de abajo): `avatarUrl`
  pasa de ser "sólo texto" a una URL de descarga real de **Firebase Storage**,
  subida por `uploadAvatar` (`src/lib/firebase/storage.ts`, Admin SDK) a una
  ruta fija por usuario (`avatars/{uid}/avatar.jpg` — cada subida nueva
  sobreescribe la anterior, sin archivos huérfanos).
- `updateProfileAction` (`src/lib/data/profile-actions.ts`) cambia de firma:
  de argumentos tipados (`{name?, alias?}`) a `(prevState, formData)`, patrón
  `useActionState`, para poder recibir el archivo de la foto junto con
  `name`/`alias` en un solo submit. Nueva pantalla `/ajustes/perfil`
  (`src/app/(app)/ajustes/perfil/page.tsx` + `EditProfileForm`), con un
  `AvatarPicker` propio (`src/components/molecules/AvatarPicker.tsx`) que
  comprime la imagen en el cliente (canvas, recorte cuadrado, máx. 512px)
  antes de mandarla.
- `UserAvatar` (`src/components/molecules/UserAvatar.tsx`) gana un prop `src`
  opcional para mostrar la foto real en vez de sólo iniciales; se conecta en
  el account card de `SettingsPanel`/`ajustes`.
- **Nuevo archivo `storage.rules`** (el proyecto no tenía reglas de Storage
  hasta ahora) + `firebase.json` referenciándolo:
  ```
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /avatars/{uid}/{fileName} {
        allow read: if true;
        allow write: if false;
      }
      match /{allPaths=**} {
        allow read, write: if false;
      }
    }
  }
  ```
  Mismo criterio que Firestore: todas las subidas van por el Admin SDK
  (`uploadAvatar`), que saltea las rules; el cliente nunca escribe. La
  lectura de `avatars/{uid}/*` es pública a propósito, así se puede mostrar
  con un `<img src>` normal sin manejar tokens de descarga ni signed URLs.
  Pendiente de publicar contra el proyecto real, igual que `firestore.rules`
  (ver sección de arriba): `firebase deploy --only storage:rules`.
- **`firestore.rules` no necesita ningún cambio**: `avatarUrl` sigue siendo
  un `string | null` como cualquier otro campo de `users/{uid}`, que ya
  tenía `allow write: if false` (todo por Admin SDK) y `allow read: if
  isOwner(uid)` cubriendo el documento entero. El bloque vigente (idéntico
  al de la sección de reglas de arriba) queda igual:
  ```
  match /users/{uid} {
    allow read: if isOwner(uid);
    allow write: if false;
  }
  ```
- `next.config.ts`: `experimental.serverActions.bodySizeLimit` sube a
  `"4mb"` (el default es 1MB) porque el form de editar perfil manda la foto
  como `multipart/form-data`.
- **Fuera de alcance a propósito**: el saludo del header (`AppShell`) sigue
  mostrando sólo iniciales — depende de la session cookie (`CurrentUser`),
  no de una lectura de Firestore, y conectarlo ahí es un cambio más grande
  que no se pidió. Cambiar el email tampoco está implementado (requiere
  reautenticación en Firebase Auth).

### 2026-08-01 — Perfil extendido: alias, avatar, preferencias

- `UserDoc` (`src/lib/firebase/collections.ts`) gana `alias`, `avatarUrl` y
  `preferences` (nuevo tipo `UserPreferences` + `DEFAULT_PREFERENCES`).
- `createAccount` y `findOrCreateGoogleAccount` (`src/lib/auth/users.ts`)
  escriben el documento completo con estos campos desde el alta;
  `findOrCreateGoogleAccount` además toma `avatarUrl` del claim `picture`
  de Google, que antes se descartaba sin usar.
- Nuevos accesores `src/lib/data/profile.ts` (`getProfile`) y
  `src/lib/data/profile-actions.ts` (`updateProfileAction`,
  `updatePreferencesAction`), siguiendo el mismo patrón que
  `favorites.ts` / `favorites-actions.ts`.
- Sin cambios de reglas (ver sección de arriba).
- **Fuera de alcance a propósito**: no se conectó `SettingsPanel` ni
  `ThemeProvider` — siguen en `localStorage`. Falta subir avatar
  (depende de `IMAGE_STORAGE_PROVIDER`, todavía sin implementar).

### 2026-08-01 — Ingreso y alta automática con Google

- Nueva Server Action `loginWithGoogle` (`src/lib/auth/actions.ts`) y
  `findOrCreateGoogleAccount` (`src/lib/auth/users.ts`): reutiliza el mismo
  canje de ID token por session cookie que el login por contraseña
  (`createSession`, `src/lib/auth/session.ts`).
- La cuenta de **Firebase Auth** la crea Firebase solo en el primer login
  federado (eso es lo "automático" del alta); lo único que faltaba era el
  documento de perfil en Firestore, que ahora crea
  `findOrCreateGoogleAccount` sólo si no existía (nunca pisa un perfil ya
  creado).
- Nuevo componente cliente `GoogleSignInButton`
  (`src/components/organisms/auth/GoogleSignInButton.tsx`), con
  `signInWithPopup` del SDK de Firebase (ya lazy-cargado vía
  `src/lib/firebase/client.ts`), agregado a `LoginForm` y `SignupForm`.

```mermaid
sequenceDiagram
    participant B as Browser (GoogleSignInButton)
    participant G as Firebase Auth (popup Google)
    participant SA as Server Action loginWithGoogle
    participant AD as Admin SDK
    participant FS as Firestore users/{uid}

    B->>G: signInWithPopup(GoogleAuthProvider)
    G-->>B: idToken
    B->>SA: loginWithGoogle(idToken, next)
    SA->>AD: verifyIdToken(idToken)
    AD-->>SA: decoded {uid, email, name, picture}
    SA->>FS: get users/{uid}
    alt no existía
        SA->>FS: set({email, name, alias:null, avatarUrl, preferences, createdAt, updatedAt})
    end
    SA->>AD: createSessionCookie(idToken)
    AD-->>SA: session cookie
    SA-->>B: Set-Cookie(httpOnly) + redirect(next)
```

- Sin cambios de reglas: la escritura del perfil sigue yendo por el Admin
  SDK, igual que el alta por contraseña.
- **Pendiente en Firebase Console** (fuera del repo, no es código): habilitar
  el proveedor **Google** en Authentication → Sign-in method — hoy sólo está
  habilitado Email/contraseña.
