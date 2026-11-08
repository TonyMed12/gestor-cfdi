import { Logo } from "@/components/Logo";
import { NOMBRE_APP } from "@/lib/config";
import { LoginForm } from "./LoginForm";

export const metadata = { title: `Iniciar sesión · ${NOMBRE_APP}` };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5 py-12">
      <div className="flex w-full max-w-[1040px] flex-wrap overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-1 basis-[380px] flex-col justify-between gap-7 bg-accent p-12 text-white">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <span className="text-xl font-bold tracking-tight">
              {NOMBRE_APP}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            <h1 className="m-0 text-[34px] leading-tight font-bold">
              Tus CFDI leídos, validados y clasificados en un solo lugar.
            </h1>
            <p className="m-0 text-base leading-relaxed text-[#E3F4EF]">
              Recibe XML, PDF y escaneos de tus clientes, consulta su estado
              ante el SAT y revisa las sugerencias antes de calcular
              impuestos.
            </p>
          </div>
          <p className="m-0 text-sm text-[#F1FAF7]">
            La decisión fiscal siempre es del contador: el sistema solo
            sugiere.
          </p>
        </div>
        <div className="flex flex-1 basis-[420px] flex-col gap-5 p-12">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 text-2xl font-bold">Iniciar sesión</h2>
            <p className="m-0 text-[15px] text-text-muted">
              Entra con la cuenta de tu despacho.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
