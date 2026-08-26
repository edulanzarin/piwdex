import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/robo/auth";
import { FormAuth } from "@/components/robo/form-auth";
import { HeroRobo } from "@/components/robo/hero-robo";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CriarConta() {
  if (await auth()) redirect("/painel");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pt-2">
      <HeroRobo tela="/criar-conta" />
      <FormAuth modo="criar" />
    </div>
  );
}
