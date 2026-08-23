import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/robo/auth";
import { FormAuth } from "@/components/robo/form-auth";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CriarConta() {
  if (await auth()) redirect("/painel");
  return <FormAuth modo="criar" />;
}
