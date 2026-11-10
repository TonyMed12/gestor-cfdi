# Backlog Scrum

## Alcance

Se entrega la **Fase 1 (núcleo XML)** del documento de requerimientos: repositorio por cliente, lectura y validación de XML, clasificación por reglas, resumen por periodo, exportación, usuarios y roles. Corresponde a los requisitos marcados "Debe" más los "Debería" que el núcleo necesita (RF-29, RF-30, RF-43, RF-48).

Fuera de esta entrega, por tiempo: lectura de PDF y escaneos con OCR (RF-13 a RF-18), recepción por correo (RF-03), sugerencias de IA (RF-33 a RF-38), alertas de listas del SAT (RF-24) y estimación de IVA (RF-44). Si sobra capacidad en el sprint 4, se toman en este orden: RF-04 (enlace para el cliente), una sugerencia de IA mínima (RF-33, RF-36, RF-38).

## Organización

- **Sprints de aproximadamente una semana.** Son cuatro:
  - Sprint 1 (9 al 13 de noviembre): esquema, acceso y carga
  - Sprint 2 (16 al 20 de noviembre): lectura y validación del XML
  - Sprint 3 (23 al 27 de noviembre): clasificación, bandeja y resumen
  - Sprint 4 (30 de noviembre al 4 de diciembre): exportación, cierre y entrega
- **Base de datos:** Supabase, que da la autenticación, la base de datos PostgreSQL con seguridad por fila y el almacenamiento privado de archivos.
- **Tecnologías:** Next.js 16 y React 19 para las pantallas y el servidor, TypeScript, Tailwind CSS 4 para el diseño, y las librerías fast-xml-parser (lectura del XML) y fflate (descompresión de ZIP).

## Sprint 0: creación de las pantallas

Empezó el martes 3 de noviembre de 2026. Incluye las pantallas del mockup en Next.js, el inicio y cierre de sesión con Supabase Auth, la protección de rutas, la tabla `clientes` con RLS y el alta y lista de clientes.

## Avance

| Tarea | Estado | Nota |
| --- | --- | --- |
| S1-01 | Hecho | Esquema de la base ejecutado en Supabase (`02-esquema.sql`) |
| S1-02 | Hecho | Clientes ligados al despacho (`03-clientes-por-despacho.sql`) |
| S1-03 | Hecho | Alta, lista y desactivación de usuarios; la asignación de clientes a cada contador se aplazó |
| S1-04 | Hecho | Permisos por rol (`04-permisos-por-rol.sql`) |
| S1-05 | Por probar | Función de bitácora, que se usa al subir archivos; falta comprobar las filas en la tabla `bitacora` |
| S1-06 | Hecho | Almacenamiento privado `facturas` (`05-almacenamiento.sql`) |
| S1-07 | Hecho | Carga múltiple con validación de tipo y tamaño |
| S1-08 | Hecho | Código único de cada archivo y aviso de duplicado |
| S1-09 | Por probar | Descompresión de ZIP; falta probarla con un ZIP real |
| S1-10 | Hecho | Lista de archivos con estado y botón para verlos |
| S1-12 | Hecho | El servicio de estatus del SAT responde desde un servidor sin credenciales y se probó con dos facturas reales; falta probarlo desde el hospedaje final |
| S1-11 | Hecho | Lector de XML con `fast-xml-parser` y pruebas automáticas (`npm test`) |
| S1-13 | Parcial | Uso de CFDI y régimen cargados; falta importar la clave de producto o servicio |
| S2-01 | Hecho | Lee comprobante, emisor, receptor y timbre del CFDI 4.0, probado con facturas reales |
| S2-02 | Hecho | Conceptos con varias tasas, retenciones, exentos e impuestos locales |
| S2-03 | Hecho | Rechaza XML inválido, que no sea CFDI, sin timbre o de otra versión, con su motivo |
| S2-05 | Hecho | Comprueba que los importes y los impuestos sumen el total y que el UUID no se repita |
| S2-06 | Hecho | El RFC del cliente debe ser el emisor o el receptor de la factura |
| S2-08 | Hecho | Consulta al SAT al leer el XML y botón para consultar de nuevo (`08-consulta-sat.sql`); probado con dos facturas reales; falta reintentos automáticos |
| S2-09 | Hecho | El XML se lee automáticamente al subirlo (`07-lectura-xml.sql`) |
| S2-10 | Hecho | Excluye facturas cuyos importes no suman y las canceladas ante el SAT, con su motivo |
| S2-14 | Parcial | Pantalla de detalle del CFDI con datos reales (se abre con Ver en un XML); falta la pantalla de revisión y aprobación |
| S2-11 | Parcial | 20 pruebas automáticas con XML de ejemplo; falta ampliar el conjunto |

---

## Sprint 1 (9 al 13 de noviembre): esquema, acceso y carga

**Meta:** esquema completo en la base compartida, usuarios con roles y archivos que se suben, se guardan y detectan duplicados.

| ID | Tarea | Requisitos |
| --- | --- | --- |
| S1-01 | Script con las tablas despacho, usuario, archivo, factura, concepto, impuesto, categoría, regla, periodo y bitácora, con RLS (según `docs/04-modelo-datos.md`). | RNF-08 |
| S1-02 | Migrar `clientes` de `user_id` a `despacho_id` y reescribir sus políticas | RF-01, RNF-08 |
| S1-03 | Alta y desactivación de usuarios por el administrador y asignación de clientes | RF-45 |
| S1-04 | Roles administrador, contador, auxiliar y cliente en políticas y menú | RF-46 |
| S1-05 | Bitácora que los usuarios no pueden modificar y función para registrar acciones | RF-47, RNF-22 |
| S1-06 | Almacenamiento privado con políticas por cliente; el original no se modifica | RF-06, RNF-07 |
| S1-07 | Carga múltiple de XML, PDF, JPG, PNG y ZIP con validación de tipo y límite de 20 MB | RF-02, RNF-10 |
| S1-08 | Código único de cada archivo para avisar si ya fue subido, antes de guardarlo | RF-05 |
| S1-09 | Descompresión de ZIP y registro de cada archivo | RF-02 |
| S1-10 | Estados del archivo y lista de archivos del cliente | RF-07 |
| S1-11 | Elegir la librería de lectura de XML y reunir un conjunto de 20 o más XML (válidos, cancelados, duplicados, con retenciones, con varios conceptos) | RNF-04 |
| S1-12 | Prueba de viabilidad de la consulta de estado ante el SAT desde el servidor (disponibilidad y condiciones de uso) | RF-21 |
| S1-13 | Cargar los catálogos del SAT (clave de producto o servicio, uso de CFDI, régimen) como datos, no como código | RNF-23 |
| S1-14 | Pruebas de que un usuario no accede a datos de otro despacho | RNF-08 |

**PMV:** un contador inicia sesión, sube un ZIP con XML a un cliente, ve los archivos con su estado y el sistema avisa al subir un duplicado.

---

## Sprint 2 (16 al 20 de noviembre): lectura y validación del XML

**Meta:** cada XML subido se convierte en una factura con sus conceptos e impuestos, validada y con su estado ante el SAT.

| ID | Tarea | Requisitos |
| --- | --- | --- |
| S2-01 | Leer el comprobante, emisor, receptor y timbre de un CFDI 4.0 | RF-09 |
| S2-02 | Leer conceptos con varias tasas y los impuestos trasladados y retenidos | RF-09, RF-12 |
| S2-03 | Rechazar XML mal formados o que no sean CFDI, con un motivo claro | RF-11 |
| S2-04 | Verificar la estructura contra el esquema oficial del CFDI | RF-19 |
| S2-05 | Comprobar que conceptos e impuestos sumen el total y que el UUID no se repita | RF-20, RN-02 |
| S2-06 | Alertar cuando el RFC receptor no coincida con el del cliente | RF-23, RN-03 |
| S2-07 | Relacionar CFDI vinculados (notas de crédito, sustituciones) | RF-12 |
| S2-08 | Consultar el estado ante el SAT, guardar el resultado y la fecha, con tiempo límite y reintentos | RF-21 |
| S2-09 | Leer cada XML al subirlo y pasar el archivo a "por revisar" o "con error" en menos de 5 segundos | RF-07, RNF-01 |
| S2-10 | Excluir facturas canceladas y duplicadas, guardando el motivo | RN-01, RN-02 |
| S2-11 | Pruebas automáticas del lector con el conjunto de XML: los campos coinciden al 100 % | RNF-04 |
| S2-12 | Historial de procesamiento de cada archivo | RF-06 |
| S2-13 | Búsqueda y filtros por cliente, periodo, emisor, receptor, tipo, estado y monto | RF-08 |
| S2-14 | Pantalla de revisión de factura con datos reales | RF-09 |
| S2-15 | Verificación en dos pasos para contadores y administradores; activar el campo del login | RNF-09 |
| S2-16 | Edición y desactivación de clientes | RF-45 |
| S2-17 | Tablero con contadores reales: sin leer, por revisar, con error y faltantes | RF-48 |

**PMV:** se sube un XML real, el sistema muestra sus datos, indica si está vigente, cancelada o no encontrada, y rechaza uno mal formado.

---

## Sprint 3 (23 al 27 de noviembre): clasificación, bandeja y resumen

**Meta:** las facturas se clasifican con reglas, el contador las revisa en la bandeja y el resumen por periodo se calcula con datos reales.

| ID | Tarea | Requisitos |
| --- | --- | --- |
| S3-01 | Clasificar por tipo de comprobante y marcar si es emitida o recibida | RF-25, RF-26 |
| S3-02 | Agrupar conceptos por clave de producto o servicio y asignarlos a categorías | RF-27 |
| S3-03 | Registrar uso de CFDI, forma y método de pago y régimen del receptor | RF-28 |
| S3-04 | Crear y editar categorías por despacho o por cliente | RF-29 |
| S3-05 | Reglas del tipo "emisor X va a categoría Y", aplicadas antes de cualquier IA | RF-30 |
| S3-06 | Bandeja de revisión con datos reales, ordenada por prioridad | RF-31 |
| S3-07 | Reclasificar manualmente con historial | RF-32 |
| S3-08 | Aprobar o rechazar una clasificación, guardando quién y cuándo | RF-36, RN-05 |
| S3-09 | Periodos y asignación de cada factura a su periodo | RF-39 |
| S3-10 | Resumen por cliente y periodo: ingresos, gastos, IVA trasladado y acreditable y retenciones, por categoría | RF-39 |
| S3-11 | Mostrar cuántas facturas quedan fuera del resumen y por qué | RF-40 |
| S3-12 | Volver a consultar al SAT las facturas del periodo abierto para detectar cancelaciones | RF-22 |
| S3-13 | Alertar facturas en parcialidades o diferido sin complemento de pago | RF-41 |
| S3-14 | Pruebas de cálculo del resumen con datos conocidos | RNF-04 |
| S3-15 | Selector de cliente y de periodo en el resumen | RF-39 |

**PMV:** se clasifican varias facturas de un cliente con reglas, se aprueban desde la bandeja y el resumen del periodo coincide con un cálculo hecho a mano.

---

## Sprint 4 (30 de noviembre al 4 de diciembre): exportación, cierre y entrega

**Meta:** el contador exporta, cierra el periodo y el sistema queda desplegado y probado de punta a punta.

| ID | Tarea | Requisitos |
| --- | --- | --- |
| S4-01 | Exportar resumen y detalle a Excel o CSV | RF-42 |
| S4-02 | Exportar resumen y detalle a PDF | RF-42 |
| S4-03 | Cerrar un periodo; los cambios posteriores quedan registrados con motivo | RF-43, RN-07 |
| S4-04 | Exportar y eliminar todos los datos de un cliente | RF-50, RNF-14 |
| S4-05 | Aviso de privacidad y consentimiento | RNF-12 |
| S4-06 | Rol cliente: sube archivos y ve su estado, sin ver notas internas | RF-46, RN-08 |
| S4-07 | Revisar que ninguna clave de servicios externos llegue al navegador | RNF-11 |
| S4-08 | Despliegue con HTTPS | RNF-07 |
| S4-09 | Prueba de punta a punta: un mes completo de 3 clientes, con el resumen comparado contra captura manual | Criterio de la Fase 1 |
| S4-10 | Manual de instalación y manual de usuario breves, con capturas reales | |
| S4-11 | Corrección de errores y ensayo de la demostración final | |

**Revisión final:** viernes 4 de diciembre.
