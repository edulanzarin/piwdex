import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/users";
import { AccountSettings } from "@/components/account-settings";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Conta" };

// Conta do PIWDEX (login por email/senha): nome de exibicao e senha. Separada da area VIP,
// que e a conta do JOGO. Exige estar logado; deslogado vai pro login.
export default async function ContaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");
  // Admin nao usa a Conta comum (conta do jogo/VIP): vai direto pro painel.
  if (session.user.admin) redirect("/admin");
  const u = await getUserById(session.user.id);
  if (!u) redirect("/entrar");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <div className="text-center">
        <h1 className="pixel text-3xl text-cyan"><T k="conta.title" /></h1>
        <p className="mt-3 text-sm text-text-dim"><T k="conta.desc" /></p>
      </div>
      <AccountSettings email={u.email} nome={u.nome} vip={u.vip} />
    </div>
  );
}
