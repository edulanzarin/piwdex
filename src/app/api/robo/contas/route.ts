import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { contaPedida } from "@/lib/robo/conta";
import {
  limiteDeContas,
  apagarVinculo,
  contaDoUsuario,
  listarContas,
  renomearConta,
} from "@/lib/robo/vinculo";
import { espiarSessao, soltarSessao } from "@/lib/robo/motor/sessao";
import { lerDesejado } from "@/lib/robo/motor/desejado";

export const runtime = "nodejs";

/**
 * As contas de jogo do assinante — listar, renomear, desligar.
 *
 * A lista traz o estado VIVO de cada uma junto, e nao so o cadastro. E o que
 * transforma o seletor em painel: com varias contas, a pergunta que se faz ao
 * abrir a tela nao e "qual delas existe", e "qual delas parou".
 *
 * O estado vem de duas fontes e as duas sao necessarias: a sessao em memoria
 * responde "esta conectada agora", e o desejo no banco responde "deveria estar".
 * Uma conta ligada que nao aparece viva e exatamente o caso que precisa saltar.
 */
export async function GET() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const contas = await listarContas(usuario.id);
  const desejos = await Promise.all(contas.map((c) => lerDesejado(c.id).catch(() => null)));

  return NextResponse.json({
    // `Infinity` nao sobrevive ao JSON (vira null). O contrato manda -1, e a
    // tela le isso como "sem teto" — um null seria indistinguivel de campo
    // ausente, e a tela acabaria escondendo o botao de adicionar.
    limite: Number.isFinite(limiteDeContas(usuario)) ? limiteDeContas(usuario) : -1,
    contas: contas.map((c, i) => {
      const viva = espiarSessao(c.id)?.estado();
      return {
        ...c,
        /** o dono quis ligada */
        ligada: !!desejos[i]?.ligado,
        /** o socket esta aberto AGORA */
        conectada: !!viva?.conectado,
        cacando: viva?.slug ?? null,
        status: c.status,
        nivel: viva?.nivelLider ?? null,
        ouro: viva?.ouro ?? null,
      };
    }),
  });
}

/** Renomear: o apelido e do dono, e e o que distingue duas contas na lista. */
export async function PATCH(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const id = contaPedida(req);
  if (!id) return NextResponse.json({ erro: "sem_conta" }, { status: 400 });
  if (!(await contaDoUsuario(usuario.id, id))) {
    return NextResponse.json({ erro: "conta_alheia" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { apelido?: unknown };
  await renomearConta(id, typeof body.apelido === "string" ? body.apelido : null);
  return NextResponse.json({ ok: true });
}

/**
 * Desliga a conta do piwdex.
 *
 * A ordem importa: o socket morre ANTES da linha sair. Apagar primeiro deixaria
 * o motor segurando a sessao de jogo de uma conta que nao existe mais aqui — e
 * sem linha no banco nao ha por onde desliga-lo depois.
 */
export async function DELETE(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const id = contaPedida(req);
  if (!id) return NextResponse.json({ erro: "sem_conta" }, { status: 400 });
  if (!(await contaDoUsuario(usuario.id, id))) {
    return NextResponse.json({ erro: "conta_alheia" }, { status: 404 });
  }

  soltarSessao(id);
  await apagarVinculo(id);
  return NextResponse.json({ ok: true });
}
