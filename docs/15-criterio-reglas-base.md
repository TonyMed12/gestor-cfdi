# Criterio de las reglas base por clave del SAT (tarea A2)

Revisión: 25 de noviembre de 2026. Antes: 430 reglas. Después: **424 reglas**, con **35 corregidas** y **6 quitadas**.

## Qué es una regla base

Una regla base propone la categoría de un concepto según su clave de producto o servicio del SAT. Es el tercer paso de la clasificación (ver `elegirCategoria` en `src/lib/categorias-por-defecto.ts`):

1. Clave asignada a mano por el contador (Claves del SAT).
2. Regla por emisor.
3. **Regla base** (este documento).
4. Sugerencia por división de la clave (los dos primeros dígitos).
5. Sin clasificar.

Las reglas base son solo **sugerencias**: nada queda firme hasta que el contador aprueba la factura (RN-05), y el contador puede cambiar cualquier clave en Claves del SAT.

## Criterio

1. **Se queda** una regla cuando su categoría es la correcta para la mayoría de los clientes que reciben esa factura como **gasto**. Todas las categorías de las reglas base son de gasto, porque en facturas emitidas solo se usan categorías de ingreso (tarea A1).
2. **Se corrige** cuando la regla se asignó por una palabra suelta de la descripción ("papel", "combustible", "honorarios", "alquiler") y lo que describe la clave es otra cosa.
3. **Se quita** cuando ninguna de las 15 categorías iniciales encaja. Es mejor que el concepto quede **sin clasificar** y lo decida el contador a que se proponga una categoría equivocada. Ninguna de las 6 claves quitadas tiene sugerencia por división, así que quedan sin clasificar.
4. La regla describe **qué es** el gasto, no si es deducible. La deducibilidad se marca por categoría o por factura (tarea A7). Por eso se quedan, por ejemplo, el software de juegos o los seguros de vida.

### Qué va en cada categoría

| Categoría | Qué incluye | Qué no incluye |
|---|---|---|
| Gastos de oficina y papelería | Papel de escritura e impresión, tóner, bolígrafos, folders, papel térmico, papel de dibujo y manualidades | Papel industrial o de empaque, papel de laboratorio, artículos de limpieza o domésticos, herramientas |
| Compras de mercancía o insumos | Materia prima, empaque, insumos de producción, laboratorio, alimentos o agrícolas | Gastos generales de oficina |
| Combustible, viáticos y transporte | Gasolina, diésel y combustibles de transporte; hospedaje y viajes | Combustibles que son materia prima industrial |
| Equipo de cómputo y software | Equipo, software y licencias, incluido su arrendamiento | Equipo médico |
| Mantenimiento y reparaciones | Mantenimiento de instalaciones, equipo y vehículos; acabados del local | |
| Renta de local o equipo | Alquiler de locales, maquinaria, equipo y contenedores | Licencias de software, hospedaje |
| Honorarios y servicios profesionales | Servicios legales y profesionales | Servicios de recolección o tarifas que solo usan la palabra "honorarios" |
| Servicios (luz, agua, internet, teléfono) | Internet, telefonía y telecomunicaciones | |
| Publicidad y marketing | Publicidad impresa, difundida y aérea | |
| Seguros | Seguros de bienes, personas y responsabilidad | |
| Comisiones bancarias | Servicios bancarios | |

## Reglas corregidas (35)

| Clave | Descripción del SAT | Antes | Ahora |
|---|---|---|---|
| 14121504 | Papel de empaque | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121507 | Papel inhibidor de la corrosión volátil o vci | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121600 | Papel de seda | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121601 | Papel crepé sin blanquear | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121602 | Papel crepé semi blanqueado | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121806 | Papel de parafinado | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121807 | Papel mantequilla | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121808 | Papel para congelador | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121809 | Papel de enmascarar | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121900 | Papel prensa y de offset | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121901 | Papel periódico estándar | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121902 | Papel periódico de colores | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121903 | Papel periódico de alto brillo | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14121904 | Papel offset | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14122101 | Papel kraft súper calandrado | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14122102 | Papel kraft terminado o satinado en máquina | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14122103 | Papel no recubierto no tratado | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14122104 | Papel crepé no tratado | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14122105 | Papel crepé tratado con látex | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14122106 | Papel no recubierto tratado con látex | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14122107 | Papel base corrugado | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14122201 | Papel para germinación de semillas | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 14122202 | Papel para bolsas de te | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 15131500 | Combustible nuclear | Combustible, viáticos y transporte | Compras de mercancía o insumos |
| 26141601 | Combustible para conjunto subcrítico | Combustible, viáticos y transporte | Compras de mercancía o insumos |
| 30161502 | Papel de colgadura | Gastos de oficina y papelería | Mantenimiento y reparaciones |
| 41102428 | Papel altamente absorbente | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 41122603 | Papel de lentes para microscopio | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 46171634 | Papel detector de agentes químicos | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 48102108 | Papel aluminio para envolver alimentos | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 48102109 | Papel plástico para envolver alimentos | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 50211607 | Papel para cigarrillos o filtros | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 53141613 | Papel calcante | Gastos de oficina y papelería | Compras de mercancía o insumos |
| 81112500 | Servicios de alquiler o arrendamiento de licencias de software de computador | Renta de local o equipo | Equipo de cómputo y software |
| 90111504 | Servicios de alquiler de cabañas | Renta de local o equipo | Combustible, viáticos y transporte |

El motivo de cada una está en `scripts/categorias-claves-propuestas.json` (campos `motivo` y `categoria_anterior`, con `origen: "revisión A2"`).

## Reglas quitadas (6)

| Clave | Descripción del SAT | Categoría que tenía | Motivo |
|---|---|---|---|
| 14111601 | Papel o bolsas o cajas de regalo | Gastos de oficina y papelería | No es papelería de oficina y ninguna categoría encaja. |
| 14111704 | Papel higiénico | Gastos de oficina y papelería | Artículo de limpieza, no papelería; no hay categoría de limpieza. |
| 27112153 | Engrapadora de banda | Gastos de oficina y papelería | Herramienta (segmento 27), no artículo de oficina. |
| 42203705 | Impresoras láser en seco para imágenes o reproductores de imágenes para uso médico | Equipo de cómputo y software | Equipo médico, no equipo de cómputo de oficina. |
| 52152201 | Papel para forrar repisas | Gastos de oficina y papelería | Artículo doméstico, ninguna categoría encaja. |
| 76122400 | Honorarios de disposición y tratamiento de basuras | Honorarios y servicios profesionales | Es un servicio de recolección, no honorarios profesionales. |

## Reglas que se quedan (389)

Se revisaron una por una y se quedan con su categoría: papel de escritura, impresión y manualidades, tóner, bolígrafos y folders; gasolina, diésel y combustibles de aviación y marítimo; las 159 de software y equipo; mantenimiento de instalaciones, equipo, pozos, vehículos y aeronaves; alquiler de maquinaria, equipo y contenedores; servicios legales; internet y telefonía; publicidad; seguros; y servicios bancarios agrícolas.

## Cómo cambiar una regla

1. Edita la entrada en `scripts/categorias-claves-propuestas.json`. El nombre de la categoría debe ser uno de los de `supabase/10-categorias-iniciales.sql` y de gasto.
2. Ejecuta `node scripts/generar-reglas-base.mjs`. Vuelve a generar `src/lib/reglas-base-claves.ts`; ese archivo no se edita a mano.
3. Ejecuta `npm test`. La prueba `pruebas/reglas-base.test.mjs` revisa que el `.ts` coincida con el JSON y que cada categoría exista y sea de gasto.

## Pendiente, fuera de esta tarea

- **Agregar reglas nuevas.** La cobertura sigue siendo baja: 424 de 52,513 claves. Por ejemplo, para comisiones bancarias faltan las claves `84121500` a `84121504` (instituciones bancarias). Agregar reglas es otra decisión del equipo.
- **Categorías de limpieza y de herramientas.** Las claves quitadas quedan sin clasificar porque no existen esas categorías. Si el despacho las crea, se pueden volver a agregar como reglas.
