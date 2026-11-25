# Conjunto de prueba del resumen (tarea C7)

Once facturas CFDI 4.0 **inventadas** de octubre de 2026 para el cliente de ejemplo **Consultores Ejemplo SC** (RFC `CEJ190312AB1`), con el resultado del resumen **calculado a mano**. La prueba [`pruebas/conjunto-resumen.test.mjs`](../conjunto-resumen.test.mjs) recorre el mismo camino que la app y compara contra ese resultado:

1. Lee cada XML con `leerCfdi` (`src/lib/cfdi.ts`).
2. Decide si es emitida o recibida según el RFC del cliente.
3. Clasifica cada concepto con `elegirCategoria` (A1): clave asignada a mano, regla base (A2) o división de la clave.
4. Resuelve la deducibilidad con `esDeducible` (A7): la marca de la factura gana sobre la categoría.
5. Calcula el resumen con `calcularResumen` (C3), que usa la regla de IVA acreditable (C4) y separa las excluidas (C5).

- `xml/`: las once facturas.
- `facturas.json`: lo que la base guardaría y el XML no trae: estado de revisión, estado ante el SAT y marca de deducible. También las claves que el contador asignó a mano.
- `esperado.json`: el resultado calculado a mano. **Si cambia una regla, se corrige aquí a mano, no copiando lo que da el programa.**

## Las facturas

| # | Archivo | Qué es | Estado | Caso que prueba |
|---|---|---|---|---|
| 1 | `01-asesoria-emitida.xml` | Asesoría que cobra el cliente: 20,000 + IVA 3,200, le retienen ISR 2,000 e IVA 2,133.33 | Aprobada | Ingreso con retenciones a favor |
| 2 | `02-nota-credito-emitida.xml` | Nota de crédito sobre la asesoría: 2,000 + IVA 320, ret. ISR 200 e IVA 213.33 | Aprobada | Un egreso resta |
| 3 | `03-papeleria.xml` | Papel 1,500 + tóner 2,500, IVA 16 % | Aprobada | Regla base (A2), dos conceptos |
| 4 | `04-renta-persona-fisica.xml` | Renta 10,000 + IVA 1,600; el cliente retiene ISR 1,000 e IVA 1,066.67 | Aprobada | Clave asignada a mano (A1), retenciones por enterar |
| 5 | `05-restaurante.xml` | Comida 800 + IVA 128 | Aprobada, **no deducible** | Marca por factura (A7) |
| 6 | `06-maiz-tasa-cero.xml` | Maíz 5,000, IVA 0 % | Aprobada | Tasa 0 % (C4) |
| 7 | `07-laptop-frontera-8.xml` | Laptop 12,000 + IVA 8 % = 960 | Aprobada | Tasa fronteriza (C4) |
| 8 | `08-cancelada.xml` | Papel 1,000 + IVA 160 | Aprobada, **cancelada** | Fuera del resumen (RN-01) |
| 9 | `09-pendiente.xml` | Gasolina 700 + IVA 112 | **Por revisar** | Fuera del resumen (RN-05) |
| 10 | `10-pago.xml` | Complemento de pago, total 0 | Aprobada | Fuera del resumen: tipo P |
| 11 | `11-internet-dolares.xml` | Internet 100 USD + IVA 16 USD | Aprobada | Fuera del resumen: otra moneda |

## Cálculo a mano

**Incluidas:** 1 a 7 (siete). **Fuera del resumen:** 8, 9, 10 y 11 (cuatro). 7 + 4 = 11.

**Ingresos** (emitidas 1 y 2, categoría «Servicios prestados» porque una emitida solo toma categorías de ingreso):
- Importe: 20,000 − 2,000 = **18,000**
- IVA trasladado: 3,200 − 320 = **2,880**
- ISR retenido: 2,000 − 200 = 1,800; IVA retenido: 2,133.33 − 213.33 = 1,920
- Retenciones a favor: 1,800 + 1,920 = **3,720**

**Gastos** (recibidas 3 a 7):

| Factura | Categoría | Importe | Deducible | IVA trasladado | IVA acreditable | Por qué |
|---|---|---|---|---|---|---|
| 7 Laptop | Equipo de cómputo y software (división 43) | 12,000 | 12,000 | 960 | 960 | Tasa 8 %: válida |
| 4 Renta | Renta de local o equipo (asignada a mano) | 10,000 | 10,000 | 1,600 | 1,600 | |
| 6 Maíz | Compras de mercancía o insumos (división 50) | 5,000 | 5,000 | 0 | 0 | Tasa 0 %: no genera IVA |
| 3 Papelería | Gastos de oficina y papelería (regla base) | 4,000 | 4,000 | 640 | 640 | 240 + 400 |
| 5 Restaurante | Combustible, viáticos y transporte (división 90) | 800 | 0 | 128 | 0 | Marcada no deducible |
| **Total** | | **31,800** | **31,000** | 3,328 | **3,200** | |

- Retenciones por enterar (las hizo el cliente en la renta): 1,000 + 1,066.67 = **2,066.67**
- Ajuste no desglosado: **0**. Todas las facturas cuadran con su total.

## Cómo correrla

```bash
npm test
```

La prueba también se puede leer como guía para probar en pantalla. Si subes estos XML a un cliente con el RFC `CEJ190312AB1`, apruebas las facturas 1 a 7, 8, 10 y 11, asignas a mano la clave `80131502` a «Renta de local o equipo» y marcas el restaurante como no deducible, el resumen de octubre de 2026 debe mostrar estas mismas cifras. La factura 8 solo queda fuera si el SAT la reporta cancelada; como es inventada, en pantalla el SAT la dará como no encontrada.
