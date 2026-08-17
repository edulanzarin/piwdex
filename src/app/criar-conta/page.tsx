import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CriarContaPage() {
  const session = await auth();
  if (session?.user) redirect("/conta");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <div className="text-center">
        <div className="eyebrow mb-2"><T k="auth.register.eyebrow" /></div>
        <h1 className="pixel text-xl text-cyan"><T k="auth.register.title" /></h1>
        <p className="mt-3 text-sm text-text-dim"><T k="auth.register.desc" /></p>
      </div>
      <AuthForm mode="register" />
    </div>
  );
}
