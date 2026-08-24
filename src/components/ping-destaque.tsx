"use client";

import { useEffect } from "react";
import { pingDestaque } from "@/lib/destaque-cliente";

/**
 * Avisa que esta ficha foi aberta, pra a contagem do destaque da home.
 *
 * Existe como componente porque a ficha da especie e ESTATICA (`force-static`
 * com revalidacao de uma hora): ela e gerada uma vez e servida do cache, entao
 * nao ha render por visita onde contar do lado do servidor. Um componente de
 * cliente de tres linhas e o unico ponto da pagina que roda a cada visita.
 */
export function PingDestaque({ id }: { id: number }) {
  useEffect(() => {
    pingDestaque(id);
  }, [id]);
  return null;
}
