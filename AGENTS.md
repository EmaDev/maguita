<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Documentar cambios de arquitectura de datos

Cada vez que se cree o modifique una colección de Firestore, se cambie la
forma de un documento existente, o se toque la arquitectura de datos/auth,
hay que agregar una entrada al changelog de `docs/firestore-schema.md`:
qué cambió, por qué, un diagrama (mermaid) si ayuda a entenderlo, y el
bloque de reglas de `firestore.rules` que haya que agregar o actualizar (el
bloque en sí, no sólo una descripción — incluso si la conclusión es "no
hace falta cambiar nada"). Mantené también la tabla de colecciones y los
diagramas de ese archivo al día, no sólo el changelog.
