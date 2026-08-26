import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/robo/auth";
import { FormAuth } from "@/components/robo/form-auth";
import { HeroRobo } from "@/components/robo/hero-robo";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar() {
  // Quem ja entrou nao tem o que fazer aqui.
  if (await auth()) redirect("/painel");
  return (
    // A coluna estreita: a chegada e o formulario sao a MESMA peca, e um heroi
    // de 1400px em cima de um form de 384 os separaria em duas telas empilhadas.
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pt-2">
      <HeroRobo tela="/entrar" />
      <FormAuth modo="entrar" />
    </div>
  );
}
