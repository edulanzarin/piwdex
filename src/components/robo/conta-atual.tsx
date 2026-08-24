"use client";

import { createContext, useCallback, useContext } from "react";

/**
 * Qual conta de jogo a tela esta operando.
 *
 * Existe porque o painel tem seis abas e treze chamadas, e todas precisam da
 * mesma resposta. As alternativas eram piores: passar `contaId` como prop
 * atravessaria componentes que nao tem nada a ver com isso, e esquecer UMA
 * chamada nao daria erro — ela cairia na primeira conta do usuario e mostraria o
 * dado da conta errada com cara de certo, que e o pior desfecho possivel numa
 * tela que existe pra distinguir contas.
 *
 * Com o contexto, `useRota` e o unico jeito de montar a URL, e ele nunca esquece.
 */
const Ctx = createContext<string | null>(null);

export const ProvedorConta = Ctx.Provider;

export const useConta = (): string | null => useContext(Ctx);

/** Acrescenta a conta a uma rota do robo, respeitando query que ja exista. */
export function comConta(caminho: string, conta: string | null): string {
  if (!conta) return caminho;
  return `${caminho}${caminho.includes("?") ? "&" : "?"}conta=${encodeURIComponent(conta)}`;
}

/** A URL de uma rota do robo, ja apontando pra conta que esta na tela. */
export function useRota(): (caminho: string) => string {
  const conta = useConta();
  return useCallback((caminho: string) => comConta(caminho, conta), [conta]);
}
