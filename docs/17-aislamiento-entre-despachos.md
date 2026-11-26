# Aislamiento entre despachos (G1)

**Regla (RNF-08, S1-14):** una persona de un despacho no ve ni cambia datos de otro despacho.

Revisión del 25 de noviembre de 2026, en la rama `avance-tareas`, con los scripts `supabase/01` a `23`.

## Cómo se protege

1. **Base de datos (RLS).** Toda tabla de `public` tiene RLS. Cada política limita las filas al despacho de quien consulta (`mi_despacho()`, `cliente_es_mio()`, `factura_es_mia()`…). Las vistas `resumen_cliente` y `claves_en_uso` usan `security_invoker`, así que aplican la RLS de quien consulta. Los catálogos del SAT (`cat_*`) son públicos a propósito, porque son iguales para todos.
2. **Almacenamiento.** Los archivos se guardan como `<cliente_id>/…`. Las políticas de `storage.objects` (script 05) solo dejan leer, subir o borrar si ese cliente es del despacho, y no hay política para modificar un archivo. Los archivos de la bandeja «sin cliente» (`entrada/<despacho_id>/…`) no los puede abrir ningún usuario directamente.
3. **Servidor.** La mayoría de las acciones usan la sesión del usuario, así que RLS aplica. Las que usan la **clave de servicio** (que salta RLS) primero comprueban con la sesión que el dato es del despacho, o sacan el despacho de la sesión. La tabla de abajo las lista todas.

## Prueba automática

`pruebas/aislamiento.test.mjs` carga **todos** los scripts de `supabase/` (01 a 23, sin el 99) en un Postgres en memoria (PGlite). Usa lo mínimo de Supabase, que está en `pruebas/aislamiento/supabase-simulado.sql`: los roles `anon`, `authenticated` y `service_role`, `auth.uid()` y `storage`.

Crea dos despachos, A y B, con datos en cada tabla y archivos en el almacenamiento. Luego entra como el administrador, el contador y el auxiliar de A, y también sin sesión. Comprueba lo siguiente:

| Prueba | Qué comprueba |
|---|---|
| Ver | Nadie de A ve filas de B en ninguna tabla, vista ni archivo. Sin sesión no se ve nada. |
| Cambiar y borrar | Nadie de A cambia ni borra filas de B. Las filas de B quedan idénticas. |
| Crear | Nadie de A crea filas dentro de B ni que apunten a datos de B. Son 26 intentos: clientes, usuarios, archivos, facturas, conceptos, categorías, reglas, bitácora, enlace, almacenamiento… |
| Mover | Nadie de A pasa sus propios datos a B. Son 18 intentos: cambiar su cliente, factura, concepto, categoría o regla para que apunte a B. |
| Trabajo normal | Dentro de A, todo sigue funcionando: crear categorías, clasificar conceptos, crear reglas, escribir en la bitácora y editar clientes. |
| Funciones | Las funciones que un usuario puede llamar por la API solo responden sobre su propio despacho. Si aparece una función nueva, la prueba falla hasta que se revise. |
| Tablas nuevas | Si se agrega una tabla sin incluirla en la prueba, o sin RLS, la prueba falla. |
| Clave de servicio | Si aparece un uso nuevo de `supabaseAdmin()` en `src/`, la prueba falla hasta que se revise y se agregue a la tabla de abajo. |

Se corre con `npm test`. Necesita `@electric-sql/pglite` como dependencia de desarrollo; si no está instalado, las pruebas de la base se omiten con aviso.

## Lo que encontró la prueba y se corrigió

Con las políticas anteriores, una persona del despacho A podía dejar en A referencias a datos de B. No veía datos de B, pero:

| # | Hueco | Quién | Efecto | Corrección |
|---|---|---|---|---|
| 1 | Escribir en la bitácora una fila sobre una factura de B | Cualquier rol | La fila contaba como «motivo» para cambiar una factura de B en un periodo cerrado, si el cambio lo hacía el servidor | `23-aislamiento.sql`: la factura de la fila debe ser del despacho |
| 2 | Poner en un concepto de A una categoría de B, al editarlo | Administrador y contador | B ya no podía borrar esa categoría | Igual: la categoría del concepto debe ser del despacho |
| 3 | Crear o editar una regla de un cliente de A con una categoría de B | Administrador y contador | Igual que el anterior | Igual, para `regla` |
| 4 | Ligar una categoría de A a un cliente de B, al editarla | Administrador y contador | Al crearla ya se revisaba (script 17), pero al editarla no | Igual, para `categoria` |

Además se reforzó `getEnlaceEnvio` (`src/lib/datos.ts`). Lee el token del enlace con la clave de servicio, y antes dependía de que la página ya hubiera comprobado al cliente. Ahora lo comprueba ella misma con la sesión.

## Acciones del servidor

| Acción | Archivo | Clave de servicio | Cómo se limita al despacho |
|---|---|---|---|
| `procesarXml` | `clientes/[clienteId]/acciones.ts` | Sí, al guardar la factura | Primero toma el archivo con la sesión (RLS); si no es del despacho, no hace nada |
| `reconsultarSat` | igual | Sí, al marcar el archivo | Primero actualiza la factura con la sesión (RLS) |
| `reintentarLectura` | igual | Sí, al regresar el archivo a «recibido» | Primero lee el archivo con la sesión (RLS) |
| `generarEnlaceEnvio` | igual | Sí, al guardar el token | Revisa el rol y lee el cliente con la sesión (RLS) |
| `subirXmlPorEnlace` | igual | Sí | Sin cuenta: el token y la sesión firmada del enlace identifican al cliente; solo escribe en ese cliente |
| `subirAEntrada` | igual | Sí | El despacho sale de la sesión; solo busca clientes de ese despacho |
| `urlArchivo` | igual | No | Las políticas del almacenamiento |
| `actualizarCliente`, `guardarCategoriaCliente`, `reconsultarPeriodo` | igual | No | RLS con la sesión |
| `procesarDocumentoArchivo` | igual | Sí, al marcar el archivo | Primero lee el archivo con la sesión (RLS) |
| `desbloquearEnlace` | `enviar/[token]/acciones.ts` | Sí | Solo toca el enlace de ese token |
| Página del enlace | `enviar/[token]/page.tsx` | Sí, al leer el nombre del cliente | Solo el cliente de ese token |
| `aprobarFactura`, `aprobarFacturasEnLote`, `rechazarFactura` | `revision/[facturaId]/acciones.ts` | Sí, al fijar categorías y marcar el archivo | Primero leen la factura con la sesión (RLS); las categorías se validan contra las del despacho |
| `guardarDeducible` | igual | No | RLS con la sesión |
| `crearUsuario` | `usuarios/acciones.ts` | Sí, al crear la cuenta | Solo el administrador; la fila del usuario se inserta con la sesión, en su despacho (RLS) |
| `cambiarEstadoUsuario` | igual | Sí, al bloquear la cuenta | Primero actualiza la fila con la sesión (RLS); si no es de su despacho, no sigue |
| `guardarCategoria`, `guardarClaveCategoria`, `guardarClavesCategoria`, `guardarReglaEmisor`, `eliminarReglaEmisor` | `categorias`, `claves`, `reglas` | No | El despacho sale de la sesión, más RLS |
| `cerrarPeriodo` | `resumen/acciones.ts` | No | RLS con la sesión |
| Descarga del resumen (CSV, Excel, PDF) | `resumen/exportar/route.ts` | No | Lee cliente y facturas con la sesión (RLS) |
| `getEnlaceEnvio` | `lib/datos.ts` | Sí, al leer el token | Comprueba el cliente con la sesión (corregido en G1) |
| `buscarAcceso` | `lib/enlace.ts` | Sí | Busca por token; lo usan solo las acciones del enlace |

## Pendiente fuera de G1

- `crearUsuario` responde «Ya existe una cuenta con ese correo» aunque la cuenta sea de otro despacho, porque los correos son únicos en toda la autenticación de Supabase. Solo revela que el correo existe, no de qué despacho es.
- Los archivos de la bandeja «sin cliente» no se pueden abrir desde la aplicación, por las políticas del almacenamiento. Es una limitación de uso, no de aislamiento.
