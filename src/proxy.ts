import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Protege las rutas: sin sesión solo se permite entrar a /login.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida la sesión con Supabase en lugar de confiar solo en la cookie.
  const { data: { user } } = await supabase.auth.getUser();
  const enLogin = request.nextUrl.pathname === "/login";

  // Al redirigir se copian las cookies que Supabase acaba de renovar; si se pierden, el navegador
  // conserva un token ya rotado y la sesión puede cerrarse en la siguiente renovación.
  const redirigir = (ruta: string) => {
    const redireccion = NextResponse.redirect(new URL(ruta, request.url));
    response.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie));
    return redireccion;
  };

  if (!user && !enLogin) return redirigir("/login");
  if (user && enLogin) return redirigir("/dashboard");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico)$).*)"],
};
