# Backlog Scrum

Base: documento de requerimientos (RF, RNF, RN y priorización MoSCoW de la sección 8) y documentos de `docs/`. Fecha de entrega: **viernes 4 de diciembre de 2026**.

## Alcance

Se entrega la **Fase 1 (núcleo XML)** del documento de requerimientos: repositorio por cliente, lectura y validación de XML, clasificación por reglas, resumen por periodo, exportación, usuarios y roles. Corresponde a los requisitos marcados "Debe" más los "Debería" que el núcleo necesita (RF-29, RF-30, RF-43, RF-48).

Fuera de esta entrega, por tiempo: lectura de PDF y escaneos con OCR (RF-13 a RF-18), recepción por correo (RF-03), sugerencias de IA (RF-33 a RF-38), alertas de listas del SAT (RF-24) y estimación de IVA (RF-44). Si sobra capacidad en el sprint 4, se toman en este orden: RF-04 (enlace para el cliente), una sugerencia de IA mínima (RF-33, RF-36, RF-38).

## Organización

- **Sprints de una semana:** planeación el lunes, reunión diaria de 10 minutos, revisión con demostración y retrospectiva el viernes.
- **Roles:** Product Owner, Scrum Master y equipo de desarrollo. Los dos primeros los define el equipo.
- **Equipos de trabajo (13 personas):**
  - A. Datos, usuarios y seguridad (3)
  - B. Repositorio y carga de archivos (3)
  - C. Lectura y validación de XML (4)
  - D. Clasificación, bandeja, resumen y exportación (3)
- **Una sola base de Supabase** para todo el equipo. Los cambios de esquema los integra una sola persona del equipo A como scripts numerados en `supabase/`, para que dos cambios no se pisen. La clave secreta y la de servicio no se comparten ni se suben al repositorio.
- **Definición de terminado:** cumple su criterio de aceptación, tiene RLS si crea tablas, pasa lint y compilación, fue revisada por otra persona y se demostró en la revisión del sprint.
- **Tamaño:** S (hasta medio día), M (1 a 2 días), L (3 días o más).

## Ya hecho (sprint 0)

Pantallas del mockup en Next.js, inicio y cierre de sesión con Supabase Auth, protección de rutas, tabla `clientes` con RLS, alta y lista de clientes, README.

## Cómo leer los códigos

Cada tarea tiene un código `SX-NN`: la `S` es de sprint, `X` es el número del sprint y `NN` el número de la tarea dentro de él. Por ejemplo, `S1-03` es la tarea 3 del sprint 1.

## Avance a la fecha (9 de noviembre de 2026)

| Tarea | Estado | Nota |
| --- | --- | --- |
| S1-01 | Hecho | Esquema de la base ejecutado en Supabase (`02-esquema.sql`) |
| S1-02 | Hecho | Clientes ligados al despacho (`03-clientes-por-despacho.sql`) |
| S1-03 | Hecho | Alta, lista y desactivación de usuarios; la asignación de clientes a cada contador se aplazó |
| S1-04 | Hecho | Permisos por rol (`04-permisos-por-rol.sql`) |
| S1-05 | Por probar | Función de bitácora, que se usa al subir archivos; falta comprobar las filas en la tabla `bitacora` |
| S1-06 | Hecho | Almacenamiento privado `facturas` (`05-almacenamiento.sql`) |
| S1-07 | Hecho | Carga múltiple con validación de tipo y tamaño |
| S1-08 | Hecho | Huella SHA-256 y aviso de duplicado |
| S1-09 | Por probar | Descompresión de ZIP; falta probarla con un ZIP real |
| S1-10 | Hecho | Lista de archivos con estado y botón para verlos |
| S1-12 | Hecho | El servicio de estatus del SAT responde desde un servidor sin credenciales; falta probarlo con una factura real y desde el hospedaje final |
| S1-11 | Hecho | Lector de XML con `fast-xml-parser` y pruebas automáticas (`npm test`) |
| S1-13 | Parcial | Uso de CFDI y régimen cargados; falta importar la clave de producto o servicio |
| S2-01 | Hecho | Lee comprobante, emisor, receptor y timbre del CFDI 4.0, probado con facturas reales |
| S2-02 | Hecho | Conceptos con varias tasas, retenciones, exentos e impuestos locales |
| S2-03 | Hecho | Rechaza XML inválido, que no sea CFDI, sin timbre o de otra versión, con su motivo |
| S2-05 | Hecho | Comprueba que los importes y los impuestos sumen el total y que el UUID no se repita |
| S2-06 | Hecho | El RFC del cliente debe ser el emisor o el receptor de la factura |
| S2-08 | Parcial | Módulo de consulta al SAT escrito y probado; falta conectarlo al guardado de la factura |
| S2-09 | Hecho | El XML se lee automáticamente al subirlo (`07-lectura-xml.sql`) |
| S2-10 | Parcial | Excluye facturas cuyos importes no suman; falta excluir las canceladas |
| S2-11 | Parcial | 15 pruebas automáticas con XML de ejemplo; falta ampliar el conjunto |

---

## Sprint 1 (9 al 13 de noviembre): esquema, acceso y carga

**Meta:** esquema completo en la base compartida, usuarios con roles y archivos que se suben, se guardan y detectan duplicados.

| ID | Tarea | Requisitos | Equipo | Tamaño |
| --- | --- | --- | --- | --- |
| S1-01 | Script con las tablas despacho, usuario, archivo, factura, concepto, impuesto, categoría, regla, periodo y bitácora, con RLS (según `docs/04-modelo-datos.md`). Es la primera tarea: las demás dependen de ella | RNF-08 | A | L |
| S1-02 | Migrar `clientes` de `user_id` a `despacho_id` y reescribir sus políticas | RF-01, RNF-08 | A | M |
| S1-03 | Alta y desactivación de usuarios por el administrador y asignación de clientes | RF-45 | A | M |
| S1-04 | Roles administrador, contador, auxiliar y cliente en políticas y menú | RF-46 | A | M |
| S1-05 | Bitácora que los usuarios no pueden modificar y función para registrar acciones | RF-47, RNF-22 | A | M |
| S1-06 | Almacenamiento privado con políticas por cliente; el original no se modifica | RF-06, RNF-07 | B | M |
| S1-07 | Carga múltiple de XML, PDF, JPG, PNG y ZIP con validación de tipo y límite de 20 MB | RF-02, RNF-10 | B | M |
| S1-08 | Huella SHA-256 y aviso de duplicado antes de guardar | RF-05 | B | M |
| S1-09 | Descompresión de ZIP y registro de cada archivo | RF-02 | B | M |
| S1-10 | Estados del archivo y lista de archivos del cliente | RF-07 | B | M |
| S1-11 | Elegir la librería de lectura de XML y reunir un conjunto de 20 o más XML (válidos, cancelados, duplicados, con retenciones, con varios conceptos) | RNF-04 | C | M |
| S1-12 | Prueba de viabilidad de la consulta de estado ante el SAT desde el servidor (disponibilidad y condiciones de uso) | RF-21 | C | S |
| S1-13 | Cargar los catálogos del SAT (clave de producto o servicio, uso de CFDI, régimen) como datos, no como código | RNF-23 | C | M |
| S1-14 | Pruebas de que un usuario no accede a datos de otro despacho | RNF-08 | D | M |

**Demostración:** un contador inicia sesión, sube un ZIP con XML a un cliente, ve los archivos con su estado y el sistema avisa al subir un duplicado.

---

## Sprint 2 (16 al 20 de noviembre): lectura y validación del XML

**Meta:** cada XML subido se convierte en una factura con sus conceptos e impuestos, validada y con su estado ante el SAT.

| ID | Tarea | Requisitos | Equipo | Tamaño |
| --- | --- | --- | --- | --- |
| S2-01 | Leer el comprobante, emisor, receptor y timbre de un CFDI 4.0 | RF-09 | C | M |
| S2-02 | Leer conceptos con varias tasas y los impuestos trasladados y retenidos | RF-09, RF-12 | C | M |
| S2-03 | Rechazar XML mal formados o que no sean CFDI, con un motivo claro | RF-11 | C | S |
| S2-04 | Verificar la estructura contra el esquema oficial del CFDI | RF-19 | C | L |
| S2-05 | Comprobar que conceptos e impuestos sumen el total y que el UUID no se repita | RF-20, RN-02 | C | M |
| S2-06 | Alertar cuando el RFC receptor no coincida con el del cliente | RF-23, RN-03 | C | S |
| S2-07 | Relacionar CFDI vinculados (notas de crédito, sustituciones) | RF-12 | C | M |
| S2-08 | Consultar el estado ante el SAT, guardar el resultado y la fecha, con tiempo límite y reintentos | RF-21 | C | L |
| S2-09 | Leer cada XML al subirlo y pasar el archivo a "por revisar" o "con error" en menos de 5 segundos | RF-07, RNF-01 | B | M |
| S2-10 | Excluir facturas canceladas y duplicadas, guardando el motivo | RN-01, RN-02 | C | S |
| S2-11 | Pruebas automáticas del lector con el conjunto de XML: los campos coinciden al 100 % | RNF-04 | C | M |
| S2-12 | Historial de procesamiento de cada archivo | RF-06 | B | S |
| S2-13 | Búsqueda y filtros por cliente, periodo, emisor, receptor, tipo, estado y monto | RF-08 | B | M |
| S2-14 | Pantalla de revisión de factura con datos reales | RF-09 | D | M |
| S2-15 | Verificación en dos pasos para contadores y administradores; activar el campo del login | RNF-09 | A | M |
| S2-16 | Edición y desactivación de clientes | RF-45 | A | S |
| S2-17 | Tablero con contadores reales: sin leer, por revisar, con error y faltantes | RF-48 | D | M |

**Demostración:** se sube un XML real, el sistema muestra sus datos, indica si está vigente, cancelada o no encontrada, y rechaza uno mal formado.

---

## Sprint 3 (23 al 27 de noviembre): clasificación, bandeja y resumen

**Meta:** las facturas se clasifican con reglas, el contador las revisa en la bandeja y el resumen por periodo se calcula con datos reales.

| ID | Tarea | Requisitos | Equipo | Tamaño |
| --- | --- | --- | --- | --- |
| S3-01 | Clasificar por tipo de comprobante y marcar si es emitida o recibida | RF-25, RF-26 | D | M |
| S3-02 | Agrupar conceptos por clave de producto o servicio y asignarlos a categorías | RF-27 | D | M |
| S3-03 | Registrar uso de CFDI, forma y método de pago y régimen del receptor | RF-28 | D | S |
| S3-04 | Crear y editar categorías por despacho o por cliente | RF-29 | D | M |
| S3-05 | Reglas del tipo "emisor X va a categoría Y", aplicadas antes de cualquier IA | RF-30 | D | L |
| S3-06 | Bandeja de revisión con datos reales, ordenada por prioridad | RF-31 | D | M |
| S3-07 | Reclasificar manualmente con historial | RF-32 | D | M |
| S3-08 | Aprobar o rechazar una clasificación, guardando quién y cuándo | RF-36, RN-05 | D | M |
| S3-09 | Periodos y asignación de cada factura a su periodo | RF-39 | A | M |
| S3-10 | Resumen por cliente y periodo: ingresos, gastos, IVA trasladado y acreditable y retenciones, por categoría | RF-39 | D | L |
| S3-11 | Mostrar cuántas facturas quedan fuera del resumen y por qué | RF-40 | D | S |
| S3-12 | Volver a consultar al SAT las facturas del periodo abierto para detectar cancelaciones | RF-22 | C | M |
| S3-13 | Alertar facturas en parcialidades o diferido sin complemento de pago | RF-41 | C | M |
| S3-14 | Pruebas de cálculo del resumen con datos conocidos | RNF-04 | B | M |
| S3-15 | Selector de cliente y de periodo en el resumen | RF-39 | B | S |

**Demostración:** se clasifican varias facturas de un cliente con reglas, se aprueban desde la bandeja y el resumen del periodo coincide con un cálculo hecho a mano.

---

## Sprint 4 (30 de noviembre al 4 de diciembre): exportación, cierre y entrega

**Meta:** el contador exporta, cierra el periodo y el sistema queda desplegado y probado de punta a punta.

| ID | Tarea | Requisitos | Equipo | Tamaño |
| --- | --- | --- | --- | --- |
| S4-01 | Exportar resumen y detalle a Excel o CSV | RF-42 | D | M |
| S4-02 | Exportar resumen y detalle a PDF | RF-42 | D | M |
| S4-03 | Cerrar un periodo; los cambios posteriores quedan registrados con motivo | RF-43, RN-07 | D | M |
| S4-04 | Exportar y eliminar todos los datos de un cliente | RF-50, RNF-14 | A | M |
| S4-05 | Aviso de privacidad y consentimiento | RNF-12 | A | S |
| S4-06 | Rol cliente: sube archivos y ve su estado, sin ver notas internas | RF-46, RN-08 | A | M |
| S4-07 | Revisar que ninguna clave de servicios externos llegue al navegador | RNF-11 | A | S |
| S4-08 | Despliegue con HTTPS | RNF-07 | B | M |
| S4-09 | Prueba de punta a punta: un mes completo de 3 clientes, con el resumen comparado contra captura manual | Criterio de la Fase 1 | C | L |
| S4-10 | Manual de instalación y manual de usuario breves, con capturas reales | | B | M |
| S4-11 | Corrección de errores y ensayo de la demostración final | | Todos | M |

**Revisión final:** viernes 4 de diciembre.

---

## Riesgos

| Riesgo | Qué hacer |
| --- | --- |
| Una sola base compartida: los datos de prueba se mezclan y dos cambios de esquema pueden chocar | Un responsable de scripts numerados; datos de prueba marcados por cliente |
| La consulta de estado ante el SAT puede no estar disponible o tener límites (S1-12, S2-08) | Resolver la prueba de viabilidad en el sprint 1; si no hay acceso, simularla y dejarla documentada como límite |
| La validación contra el esquema oficial del CFDI (S2-04) es costosa de implementar | Si no cabe, validar los campos obligatorios y dejar el esquema completo como deuda anotada |
| Crear usuarios desde la aplicación exige la clave de servicio, que no debe salir del servidor | Usarla solo en rutas de servidor y solo en el entorno de quien trabaje esa tarea |
| La estimación supone dedicación parcial de 13 personas; si baja, el sprint 4 se recorta | Priorizar según MoSCoW y recortar primero la exportación a PDF y el rol cliente |

## Decisiones pendientes

- Quién es el Product Owner y el Scrum Master.
- Si se aceptan CFDI anteriores a la versión 4.0 (pregunta abierta en el documento de requerimientos).
- Dónde se hospedan los archivos y bajo qué jurisdicción (pregunta abierta en la sección 4 del documento de requerimientos).
