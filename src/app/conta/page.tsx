import type { Metadata } from "next";
import { ToolFrame } from "@/components/tool-frame";
import { NavAccount } from "@/components/nav-icons";
import { AccountPanel } from "@/components/account-panel";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Minha conta" };

export default function ContaPage() {
  return (
    <ToolFrame accent="#4f8bf0" label="CONTA" icon={<NavAccount size={13} />}>
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-2"><T k="account.eyebrow" /></div>
          <h1 className="pixel text-xl" style={{ color: "#4f8bf0" }}><T k="account.title" /></h1>
          <p className="mt-3 max-w-2xl text-sm text-text-dim"><T k="account.desc" /></p>
        </div>
        <AccountPanel />
      </div>
    </ToolFrame>
  );
}
