import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage() {
  const session = await auth();
  if (session?.user?.admin) redirect("/admin");
  if (session?.user) redirect("/conta");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <div className="text-center">
        <div className="eyebrow mb-2"><T k="auth.login.eyebrow" /></div>
        <h1 className="pixel text-xl text-cyan"><T k="auth.login.title" /></h1>
        <p className="mt-3 text-sm text-text-dim"><T k="auth.login.desc" /></p>
      </div>
      <AuthForm mode="login" />
    </div>
  );
}
