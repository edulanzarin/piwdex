"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Note, Panel } from "@/components/ui";
import { Pokeball } from "@/components/ui/pokeball";
import { TOM } from "@/components/robo/pecas";
import type { ContaNaTela } from "@/components/robo/seletor-conta";

/**
 * As contas ligadas — renomear e desligar.
 *
 * O apelido nao e enfeite: duas contas do mesmo jogo chegam aqui com o MESMO
 * nome de personagem, e uma lista de dois "Zashz" nao e uma lista, e um enigma.
 * O jogo nao sabe qual delas e "a de farm".
 *
 * Desligar pede confirmacao digitada? Nao — apagar o vinculo nao apaga nada no
 * jogo: a conta de jogo continua inteira, so para de ser controlada daqui. O
 * estrago maximo e ter que colar o token de novo, e um modal pra isso seria
 * cerimonia sem risco por tras.
 */

const rotulo = (c: ContaNaTela) => c.apelido || c.nomeJogador || "conta sem nome";

const SITUACAO: Record<ContaNaTela["status"], { texto: string; cor: string }> = {
  active: { texto: "ligada", cor: TOM.vida },
  expired: { texto: "token vencido", cor: TOM.ouro },
  blocked: { texto: "recusada pelo jogo", cor: TOM.perigo },
};

export function GerenciarContas({ contas }: { contas: ContaNaTela[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (!contas.length) return null;

  async function chamar(id: string, init: RequestInit) {
    setOcupado(id);
    try {
      await fetch(`/api/robo/contas?conta=${encodeURIComponent(id)}`, init).catch(() => null);
      setEditando(null);
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  // Nome de personagem repetido = a mesma conta ligada duas vezes. O aviso vale
  // mais que a lista: dois sockets pro mesmo personagem se derrubam pra sempre,
  // e o sintoma disso ("o robô cai sozinho") nao aponta pra ca.
  const nomes = contas.map((c) => c.nomeJogador).filter(Boolean);
  const repetido = nomes.length !== new Set(nomes).size;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Pokeball size={14} />
          Contas ligadas
        </span>
      }
      actions={<span className="pix text-[11px] text-text-mute">{contas.length}</span>}
    >
      {repetido ? (
        <Note tone="danger">
          Há duas entradas para o mesmo personagem. Elas abrem dois WebSockets na mesma conta
          de jogo, e o jogo aceita um só — cada um derruba o outro, para sempre. Desligue uma.
        </Note>
      ) : null}

      <ul className="mt-2 flex flex-col gap-1">
        {contas.map((c) => {
          const s = SITUACAO[c.status];
          return (
            <li
              key={c.id}
              className="flex min-h-12 flex-wrap items-center gap-2 border border-line bg-bg-soft px-2 py-1.5"
            >
              <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: s.cor }} aria-hidden="true" />

              {editando === c.id ? (
                <>
                  <Input
                    value={texto}
                    onChange={(e) => setTexto(e.currentTarget.value)}
                    placeholder={c.nomeJogador ?? "apelido"}
                    maxLength={40}
                    wrapClassName="min-w-0 flex-1"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={ocupado === c.id}
                    onClick={() =>
                      void chamar(c.id, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ apelido: texto }),
                      })
                    }
                  >
                    salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                    cancelar
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-text">{rotulo(c)}</span>
                    {c.apelido && c.nomeJogador ? (
                      <span className="block truncate text-[11px] text-text-mute">{c.nomeJogador}</span>
                    ) : null}
                  </span>
                  <span className="pix shrink-0 text-[10px]" style={{ color: s.cor }}>
                    {s.texto}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditando(c.id);
                      setTexto(c.apelido ?? "");
                    }}
                  >
                    apelido
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={ocupado === c.id}
                    onClick={() => void chamar(c.id, { method: "DELETE" })}
                  >
                    desligar
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[11px] text-text-mute">
        Desligar remove a conta daqui e nada no jogo — ela volta colando o token de novo.
      </p>
    </Panel>
  );
}
