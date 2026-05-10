import Link from "next/link";
import { AuthBrand } from "@/components/AuthBrand";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="card animate-fade-in p-8">
      <AuthBrand />
      <h1 className="mb-1 text-center text-xl font-semibold text-slate-900 dark:text-slate-50">
        Recuperar contraseña
      </h1>
      <p className="mb-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Te enviaremos un enlace para restablecerla
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        <Link href="/login" className="text-brand-600 hover:underline dark:text-brand-400">
          ← Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
