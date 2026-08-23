import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/robo/auth";
import { FormAuth } from "@/components/robo/form-auth";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar() {
  // Quem ja entrou nao tem o que fazer aqui.
  if (await auth()) redirect("/painel");
  return <FormAuth modo="entrar" />;
}
