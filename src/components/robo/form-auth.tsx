"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input, Note, Panel } from "@/components/ui";
import { criarConta, entrar, type ResultadoAuth } from "@/lib/robo/acoes-auth";

/**
 * Entrar e criar conta na MESMA peca.
 *
 * Os dois formularios diferem por um campo e um verbo; separa-los em dois
 * componentes garantiria que um recebesse um ajuste e o outro nao — foi o que
 * aconteceu no v1, onde a tela de cadastro ficou com um espacamento proprio por
 * meses.
 */

function Enviar({ rotulo }: { rotulo: string }) {
  // `useFormStatus` tem que ser lido de DENTRO do form, num filho: no mesmo
  // componente que renderiza o `<form>` ele devolve `pending: false` pra sempre.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
      {pending ? "aguarde…" : rotulo}
    </Button>
  );
}

export function FormAuth({ modo }: { modo: "entrar" | "criar" }) {
  const criando = modo === "criar";
  const [estado, acao] = useActionState<ResultadoAuth | undefined, FormData>(
    criando ? criarConta : entrar,
    undefined,
  );

  return (
    /* O titulo e a frase saiam daqui: eles viraram a chegada (`HeroRobo`) que a
       pagina poe em cima. Mantidos nos dois lugares, a tela dizia "Entrar" duas
       vezes em dois corpos diferentes, a dez centimetros de distancia. */
    <Panel className="w-full p-6">
      <form action={acao} className="flex flex-col gap-3">
        {criando ? (
          <Field label="Nome" hint="opcional, só pra tela te chamar de alguma coisa">
            <Input name="nome" autoComplete="nickname" maxLength={40} />
          </Field>
        ) : null}

        <Field label="E-mail">
          <Input name="email" type="email" required autoComplete="email" inputMode="email" />
        </Field>

        <Field label="Senha" hint={criando ? "mínimo de 8 caracteres" : undefined}>
          <Input
            name="senha"
            type="password"
            required
            minLength={criando ? 8 : undefined}
            autoComplete={criando ? "new-password" : "current-password"}
          />
        </Field>

        {/* `aria-live`: quem usa leitor de tela precisa ouvir o erro sem ter que
            varrer o formulario atras dele. */}
        <div aria-live="polite">
          {estado?.erro ? (
            <Note tone="danger" className="mt-1">
              {estado.erro}
            </Note>
          ) : null}
        </div>

        <div className="mt-1">
          <Enviar rotulo={criando ? "criar conta" : "entrar"} />
        </div>
      </form>

      <p className="mt-5 text-[13px] text-text-mute">
        {criando ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link
          href={criando ? "/entrar" : "/criar-conta"}
          className="tap text-accent underline-offset-4 hover:underline"
        >
          {criando ? "entrar" : "criar uma"}
        </Link>
      </p>
    </Panel>
  );
}
