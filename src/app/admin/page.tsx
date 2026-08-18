import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAdminOverview } from "@/lib/admin-data";
import { ToolFrame } from "@/components/tool-frame";
import { AdminDashboard } from "@/components/admin-dashboard";
import { Gear } from "@/components/icons";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
// Moedas ao vivo por request: nunca cachear.
export const dynamic = "force-dynamic";

const ACCENT = "#e5484d";

// Portal interno: visao de TODAS as contas do piwdex. Gate duro no servidor — quem nao e
// admin nem ve a rota (redirect). A conta admin cai aqui em vez da area VIP/Conta.
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.admin) redirect("/");

  const users = await getAdminOverview();

  return (
    <div className="container-vip">
      <ToolFrame accent={ACCENT} label="ADMIN" icon={<Gear size={13} />}>
        <div className="flex flex-col gap-5">
          <div>
            <div className="eyebrow mb-2">Painel interno</div>
            <h1 className="pixel text-xl" style={{ color: ACCENT }}>Contas do PIWdex</h1>
          </div>
          <AdminDashboard users={users} />
        </div>
      </ToolFrame>
    </div>
  );
}
