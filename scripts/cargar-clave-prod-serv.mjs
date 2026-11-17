// Carga el catálogo c_ClaveProdServ (SAT, CFDI 4.0) en cat_clave_prod_serv.
// Uso: node --env-file=.env.local scripts/cargar-clave-prod-serv.mjs
// Usa la clave de servicio, así que solo debe correrse en tu máquina.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");

const filas = JSON.parse(readFileSync(new URL("./clave-prod-serv.json", import.meta.url), "utf8"));
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const LOTE = 1000;
for (let i = 0; i < filas.length; i += LOTE) {
  const trozo = filas.slice(i, i + LOTE);
  const { error } = await supabase
    .from("cat_clave_prod_serv")
    .upsert(trozo, { onConflict: "clave" });
  if (error) {
    console.error(`Error en el lote que empieza en la fila ${i}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Cargadas ${Math.min(i + LOTE, filas.length)} de ${filas.length}`);
}

const { count, error } = await supabase
  .from("cat_clave_prod_serv")
  .select("*", { count: "exact", head: true });
if (error) throw error;
console.log(`Listo. Filas en la tabla: ${count}`);
