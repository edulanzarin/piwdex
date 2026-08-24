"use client";

import { Pokeball } from "@/components/ui/pokeball";
import { TOM } from "@/components/robo/pecas";
import { compact } from "@/lib/labels";

/**
 * O trilho de contas.
 *
 * Ele nao e so um seletor: e o unico lugar da tela que responde "alguma das
 * minhas parou?". Com uma conta so, essa pergunta se respondia olhando o painel
 * inteiro; com cinco, olhar cinco paineis nao e resposta, e uma conta caida as
 * tres da manha ficaria caida ate alguem visitar a aba dela.
 *
 * Por isso cada chip carrega o estado VIVO e nao so o nome — e por isso o caso
 * que mais importa (o dono quis ligada, e ela nao esta conectada) e o unico que
 * ganha cor de alarme. Ligada e conectada e o normal; desligada foi decisao de
 * alguem; ligada e no chao e o unico que pede ato.
 */

export interface ContaNaTela {
  id: string;
  nomeJogador: string | null;
  apelido: string | null;
  status: "active" | "expired" | "blocked";
}

/** O que a lista viva acrescenta ao cadastro. */
export interface ContaViva extends ContaNaTela {
  ligada?: boolean;
  /** esperando vaga no teto de conexoes por IP */
  naFila?: boolean;
  conectada?: boolean;
  cacando?: string | null;
  nivel?: number | null;
  ouro?: number | null;
}

const rotulo = (c: ContaNaTela) => c.apelido || c.nomeJogador || "conta sem nome";

function tomDe(c: ContaViva): { cor: string; texto: string } {
  if (c.status === "blocked") return { cor: TOM.perigo, texto: "recusada" };
  if (c.status === "expired") return { cor: TOM.ouro, texto: "reconectar" };
  if (c.conectada) return { cor: TOM.vida, texto: c.cacando ? "caçando" : "ligada" };
  // Fila nao e queda: o jogo so nao tem vaga pra ela agora, e nao ha o que
  // consertar. Pintar de vermelho junto com "no chão" mandaria procurar defeito.
  if (c.naFila) return { cor: TOM.ouro, texto: "na fila" };
  if (c.ligada) return { cor: TOM.perigo, texto: "no chão" };
  return { cor: TOM.fraco, texto: "parada" };
}

export function SeletorDeConta({
  contas,
  ativa,
  onTrocar,
  onAdicionar,
  limite,
}: {
  contas: ContaViva[];
  ativa: string | null;
  onTrocar: (id: string) => void;
  onAdicionar: () => void;
  /** `-1` = sem teto (admin, e o que os planos vao relaxar) */
  limite: number;
}) {
  const semTeto = limite < 0;
  if (!contas.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {contas.map((c) => {
        const t = tomDe(c);
        const eu = c.id === ativa;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onTrocar(c.id)}
            aria-current={eu ? "true" : undefined}
            className="flex min-w-0 items-center gap-2 border px-2.5 py-1.5 transition-colors hover:border-line-strong"
            style={{
              borderColor: eu
                ? "color-mix(in srgb, var(--color-t-robo) 55%, transparent)"
                : "var(--color-line)",
              backgroundColor: eu ? "color-mix(in srgb, var(--color-t-robo) 8%, transparent)" : undefined,
            }}
          >
            <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: t.cor }} aria-hidden="true" />
            <span
              className="max-w-[10rem] truncate text-[12px]"
              style={{ color: eu ? "var(--color-text)" : "var(--color-text-dim)" }}
            >
              {rotulo(c)}
            </span>
            <span className="pix shrink-0 text-[9px]" style={{ color: t.cor }}>
              {t.texto}
            </span>
          </button>
        );
      })}

      {semTeto || contas.length < limite ? (
        <button
          type="button"
          onClick={onAdicionar}
          className="pix border border-dashed border-line px-2.5 py-1.5 text-[10px] text-text-mute transition-colors hover:border-line-strong hover:text-text-dim"
          title={semTeto ? `${contas.length} contas` : `${contas.length} de ${limite} contas`}
        >
          + conta
        </button>
      ) : (
        <span className="pix px-1 text-[10px] text-text-mute" title="teto da assinatura">
          {contas.length}/{limite}
        </span>
      )}
    </div>
  );
}

/** Um resumo de uma linha por conta, pro caso de querer ver todas de uma vez. */
export function ResumoDeContas({ contas }: { contas: ContaViva[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {contas.map((c) => {
        const t = tomDe(c);
        return (
          <li key={c.id} className="flex h-9 items-center gap-2 border border-line bg-bg-soft px-2">
            <Pokeball size={14} />
            <span className="min-w-0 flex-1 truncate text-[12px] text-text">{rotulo(c)}</span>
            {c.nivel != null ? (
              <span className="pix shrink-0 text-[10px] text-text-mute">nv {c.nivel}</span>
            ) : null}
            {c.ouro != null ? (
              <span className="shrink-0 text-[11px] tabular" style={{ color: TOM.ouro }}>
                {compact(c.ouro)}
              </span>
            ) : null}
            <span className="pix w-20 shrink-0 text-right text-[10px]" style={{ color: t.cor }}>
              {t.texto}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
