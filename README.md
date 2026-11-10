# Lector de facturas

Aplicación web para despachos contables que centraliza la recepción, la revisión y la clasificación de facturas electrónicas (CFDI) de sus clientes. El contador carga los comprobantes de cada cliente, revisa la clasificación propuesta y consulta un resumen del periodo. La decisión fiscal siempre queda en manos del contador: el sistema solo sugiere.

Este repositorio contiene el frontend. Se desarrolla como proyecto escolar, por etapas.

## Tecnologías

- Next.js 16 (App Router) y React 19
- TypeScript
- Tailwind CSS 4
- Supabase: autenticación y base de datos PostgreSQL

## Requisitos

- Node.js 20.9 o superior
- npm
- Un proyecto de Supabase

## Configuración

1. Instalar las dependencias:

   ```bash
   npm install
   ```

2. Crear el archivo `.env.local` a partir de `.env.example` y completar los valores de *Project Settings > API* en Supabase:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```

   Debe usarse la clave pública (`sb_publishable_...` o `anon`). La clave secreta no debe colocarse en estas variables.

3. Crear las tablas ejecutando, en el editor SQL de Supabase, los scripts de la carpeta `supabase/` en orden numérico. El equipo comparte un único proyecto de Supabase, de modo que los cambios de esquema se integran siempre como un script nuevo con el siguiente número.

4. Crear un usuario en *Authentication > Users* de Supabase para poder iniciar sesión.

5. Iniciar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   La aplicación queda disponible en `http://localhost:3000`.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Análisis estático con ESLint |

## Estructura

```
src/
  app/          Páginas y rutas de la aplicación
  components/   Componentes compartidos (menú, etiquetas, estructura base)
  lib/          Tipos, acceso a datos y clientes de Supabase
  proxy.ts      Protección de rutas según la sesión
supabase/       Scripts SQL de la base de datos
```

## Pantallas

| Ruta | Descripción |
| --- | --- |
| `/login` | Inicio de sesión |
| `/dashboard` | Tablero de pendientes por cliente |
| `/clientes` | Alta y listado de clientes |
| `/clientes/[clienteId]` | Detalle y archivos del cliente |
| `/bandeja` | Bandeja de revisión |
| `/revision/[facturaId]` | Revisión de una factura |
| `/resumen` | Resumen del periodo |

## Estado del proyecto

Implementado:

- Inicio y cierre de sesión con Supabase Auth.
- Protección de todas las rutas salvo `/login`.
- Alta y consulta de clientes, aislados por usuario mediante políticas de seguridad a nivel de fila (RLS).

Pendiente:

- Tabla de facturas y carga de archivos XML y PDF.
- Lectura de CFDI y consulta de su estado ante el SAT.
- Clasificación sugerida, revisión y resumen del periodo con datos reales. Estas pantallas usan temporalmente datos vacíos de `src/lib/mock-data.ts`.
- Verificación en dos pasos. El campo existe en el formulario de acceso, pero está deshabilitado.
- Edición y eliminación de clientes.
