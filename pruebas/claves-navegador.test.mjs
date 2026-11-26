// G4. Ninguna clave secreta llega al navegador (RNF-11, S4-07). Revisión documentada en docs/18-claves-en-el-navegador.md.
// 1) En el código: la clave de servicio solo se lee en archivos marcados "server-only", ningún componente del navegador
//    los importa, y solo dos variables NEXT_PUBLIC_ (URL y clave anónima, que son públicas por diseño).
// 2) En git: no se sube ningún .env con valores ni claves escritas en el código.
// 3) En la compilación (si existe .next/): el valor real de la clave de servicio no está en ningún archivo que descarga
//    el navegador. Se lee de .env.local y nunca se imprime.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (ruta) => relative(RAIZ, ruta).replace(/\\/g, "/");

function archivos(dir, filtro) {
  const lista = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) lista.push(...archivos(ruta, filtro));
    else if (filtro(nombre)) lista.push(ruta);
  }
  return lista;
}
const codigo = archivos(join(RAIZ, "src"), (n) => /\.(ts|tsx)$/.test(n)).map((ruta) => ({
  ruta: rel(ruta),
  texto: readFileSync(ruta, "utf8"),
}));

// Archivos que solo pueden correr en el servidor: leen la clave de servicio o la usan.
const SOLO_SERVIDOR = ["src/lib/supabase-admin.ts", "src/lib/enlace.ts"];

test("G4: la clave de servicio solo se lee en archivos del servidor marcados server-only", () => {
  const leen = codigo.filter((a) => a.texto.includes("SUPABASE_SERVICE_ROLE_KEY")).map((a) => a.ruta).sort();
  assert.deepEqual(leen, [...SOLO_SERVIDOR].sort(), "Un archivo nuevo lee la clave de servicio: revísalo y agrégalo aquí");
  for (const ruta of SOLO_SERVIDOR) {
    const texto = codigo.find((a) => a.ruta === ruta).texto;
    assert.match(texto, /^import "server-only";/m, `${ruta} debe importar "server-only" (falla la compilación si llega al navegador)`);
  }
});

test("G4: ningún componente del navegador importa módulos del servidor", () => {
  // Módulos que usan la clave de servicio o las cookies del servidor. Un `import type` no cuenta: se borra al compilar.
  // (bitacora.ts no está aquí: recibe el cliente de Supabase de quien lo llama; en el navegador es el de la sesión.)
  const servidor = /^import (?!type )[^;]*from ["']@\/lib\/(supabase-admin|enlace|datos|supabase-servidor)["']/m;
  const mal = codigo
    .filter((a) => /^["']use client["']/m.test(a.texto) && servidor.test(a.texto))
    .map((a) => a.ruta);
  assert.deepEqual(mal, []);
});

test("G4: las únicas variables que llegan al navegador (NEXT_PUBLIC_) son la URL y la clave anónima", () => {
  const publicas = new Set(codigo.flatMap((a) => [...a.texto.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)].map((m) => m[1])));
  assert.deepEqual([...publicas].sort(), ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
  // Ninguna variable secreta con el prefijo que la publicaría.
  assert.ok(![...publicas].some((v) => /SERVICE|SECRET|PRIVATE/.test(v)));
});

test("G4: git no guarda claves: .env.local ignorado, .env.example vacío y sin claves en el código", () => {
  const ignorar = readFileSync(join(RAIZ, ".gitignore"), "utf8");
  assert.match(ignorar, /^\.env\*$/m);
  let enGit;
  try {
    enGit = execFileSync("git", ["ls-files"], { cwd: RAIZ, encoding: "utf8" }).split("\n");
  } catch {
    return; // sin git (por ejemplo, una copia sin historial): se revisa solo lo demás
  }
  assert.deepEqual(enGit.filter((f) => /(^|\/)\.env/.test(f)), [".env.example"]);
  const ejemplo = readFileSync(join(RAIZ, ".env.example"), "utf8");
  for (const linea of ejemplo.split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))) {
    assert.equal(linea.split("=")[1].trim(), "", `.env.example no debe traer valores: ${linea.split("=")[0]}`);
  }
  // Ninguna clave de Supabase escrita en archivos de git (JWT o claves nuevas sb_secret_).
  const conClaves = enGit
    .filter((f) => f && !f.endsWith("package-lock.json") && existsSync(join(RAIZ, f)) && statSync(join(RAIZ, f)).isFile())
    .filter((f) => /eyJhbGciOi[A-Za-z0-9_-]{10,}\.eyJ|sb_secret_[A-Za-z0-9]/.test(readFileSync(join(RAIZ, f), "utf8")));
  assert.deepEqual(conClaves, []);
});

// Compilación: lo que realmente descarga el navegador está en .next/static.
const estaticos = join(RAIZ, ".next", "static");
const envLocal = join(RAIZ, ".env.local");
const claveServicio = existsSync(envLocal)
  ? readFileSync(envLocal, "utf8").match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
  : undefined;
const omitirCompilacion = !existsSync(estaticos)
  ? "no hay compilación (.next/static): corre npm run build"
  : !claveServicio
    ? "no hay SUPABASE_SERVICE_ROLE_KEY en .env.local para comparar"
    : false;

test("G4: el valor de la clave de servicio no está en ningún archivo que descarga el navegador", { skip: omitirCompilacion }, () => {
  const lista = archivos(estaticos, () => true);
  assert.ok(lista.length > 0);
  // Se busca la clave completa y también sus primeros 24 caracteres, por si quedara partida o recortada.
  const pedazo = claveServicio.slice(0, 24);
  const conClave = lista.filter((ruta) => {
    const texto = readFileSync(ruta, "latin1");
    return texto.includes(claveServicio) || texto.includes(pedazo) || texto.includes("SUPABASE_SERVICE_ROLE_KEY");
  });
  // Si falla, solo se dice en qué archivo; el valor nunca se imprime.
  assert.deepEqual(conClave.map(rel), []);
});
