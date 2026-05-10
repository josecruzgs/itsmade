import { AuthBrand } from "@/components/AuthBrand";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo =
    typeof next === "string" && next.startsWith("/") ? next : "/services";

  return (
    <div className="card animate-fade-in p-8">
      <AuthBrand />
      <h1 className="mb-1 text-center text-xl font-semibold text-slate-900 dark:text-slate-50">
        Iniciar sesión
      </h1>
      <p className="mb-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Accede al panel de itsMade
      </p>
      <LoginForm next={redirectTo} />
    </div>
  );
}
