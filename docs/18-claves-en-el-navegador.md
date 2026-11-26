# Claves secretas y el navegador (G4)

**Regla (RNF-11, S4-07):** ninguna clave secreta aparece en el código que descarga el navegador.

Revisión del 25 de noviembre de 2026, en la rama `avance-tareas`. Resultado: **ninguna clave secreta llega al navegador.**

## Las claves del proyecto

| Variable | ¿Secreta? | ¿Llega al navegador? | Dónde se usa |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Sí, a propósito | Dirección del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No: es pública por diseño | Sí, a propósito | La usa el navegador con la sesión del usuario; RLS decide qué puede ver y cambiar (ver `docs/17`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí**: salta RLS | **No** | Solo en el servidor: `src/lib/supabase-admin.ts` y `src/lib/enlace.ts` (firma de la sesión del enlace del cliente) |

En Next.js, solo las variables que empiezan con `NEXT_PUBLIC_` pueden llegar al navegador. La clave de servicio no lleva ese prefijo.

## Qué se revisó

1. **Dónde se lee la clave de servicio.** Solo en `supabase-admin.ts` y `enlace.ts`. Los dos empiezan con `import "server-only"`, así que si un componente del navegador los importara, **la compilación fallaría**.
2. **Componentes del navegador.** Ninguno de los 24 archivos con `"use client"` importa módulos del servidor (`supabase-admin`, `enlace`, `datos`, `supabase-servidor`). Dos solo importan tipos de `datos.ts` (`import type`), que desaparecen al compilar. `SubirArchivos.tsx` usa `registrarAccion` de `bitacora.ts`, que no tiene claves: recibe el cliente de Supabase del navegador, con la sesión del usuario.
3. **Variables públicas.** En el código solo hay dos variables `NEXT_PUBLIC_`: la URL y la clave anónima.
4. **Git.** `.gitignore` ignora `.env*` menos `.env.example`, y `.env.example` va sin valores. No hay claves de Supabase escritas en ningún archivo de git (se buscaron JWT `eyJ…` y claves `sb_secret_…`), ni en **todo el historial** de commits.
5. **La compilación de producción.** Se compiló (`npm run build`) y se buscó el **valor real** de la clave de servicio, completo y sus primeros 24 caracteres, en cada archivo de `.next/static`. Esos son los archivos que descarga el navegador. No aparece. Para comprobar que la búsqueda funciona, se copió la clave a un archivo temporal de `.next/static`: la prueba falló y señaló ese archivo. Luego se borró.

## Prueba automática

`pruebas/claves-navegador.test.mjs` repite los puntos 1 a 5 con cada `npm test`. El punto 5 se omite si no hay compilación o no hay `.env.local`. La prueba nunca imprime el valor de la clave: si la encuentra, solo dice en qué archivo.

Si alguien agrega un archivo que lea la clave de servicio, o una variable `NEXT_PUBLIC_` nueva, la prueba falla hasta que se revise.

## Si algún día se filtra

Si la clave de servicio llega a un commit, a un mensaje o al navegador:

1. En Supabase, en *Project Settings → API*, genera una clave de servicio nueva. La anterior deja de funcionar.
2. Cambia `SUPABASE_SERVICE_ROLE_KEY` en el `.env.local` de cada computadora y en el servidor.
3. Al cambiar la clave, las sesiones abiertas del enlace del cliente dejan de valer, porque se firman con ella. Los clientes solo vuelven a escribir su contraseña.
