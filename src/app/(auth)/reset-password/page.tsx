import { AuthBrand } from "@/components/AuthBrand";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="card animate-fade-in p-8">
      <AuthBrand />
      <h1 className="mb-1 text-center text-xl font-semibold text-slate-900 dark:text-slate-50">
        Nueva contraseña
      </h1>
      <p className="mb-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Establece una contraseña nueva para tu cuenta
      </p>
      <ResetPasswordForm />
    </div>
  );
}
