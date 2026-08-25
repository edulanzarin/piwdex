import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  ATUALIZACOES,
  TIPO_COR,
  TIPO_LABEL,
  dataLonga,
  ultimaMudanca,
} from "@/lib/atualizacoes";
import { FERRAMENTAS, arteUrl } from "@/lib/ferramentas";
import {
  IconChevronRight,
  Note,
  PageHeader,
  Panel,
  Sprite,
} from "@/components/ui";
import { History as IconHistory } from "lucide-react";

export const metadata: Metadata = {
  alternates: { canonical: "/atualizacoes" },
  title: "Atualizações do PIWdex — o que mudou e quando",
  description:
    "Tudo que mudou no PIWdex: ferramentas novas, consertos de cálculo e melhorias. " +
    "Conserto que muda um número aparece aqui, porque quem decidiu com o número velho " +
    "precisa saber.",
};

/**
 * O que mudou, e quando.
 *
 * A página existe por causa de um caso específico e desconfortável: um conserto de
 * CÁLCULO muda a resposta que alguém já tomou como boa. Quem montou time contra um
 * boss antes de a penalidade de grupo entrar na conta saiu daqui com um "você
 * ganha" que o jogo desmentiu. Sem um lugar que diga "isto mudou no dia tal", a
 * única leitura possível pra essa pessoa é que a ferramenta erra — e não que ela
 * errava, foi corrigida, e a correção tem data.
 *
 * Por isso a lista não separa "novidades" de "correções" em abas: a correção é a
 * parte que mais importa e não pode ficar numa segunda página que ninguém abre. O
 * tipo é um selo na linha, não uma gaveta.
 */
export default function AtualizacoesPage() {
  const ferramentaDe = (href: string | null) =>
    href ? (FERRAMENTAS.find((f) => f.href === href) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Atualizações"
        icon={<IconHistory size={22} />}
        lead={`Tudo que mudou no site, em ordem. A última foi em ${dataLonga(ultimaMudanca())}.`}
      />

      <Note>
        Esta página é o que mudou no SITE. O que mudou no JOGO — stat, drop, XP,
        ouro por abate — tem página própria, em{" "}
        <Link href="/patches" className="text-accent not-italic hover:opacity-80">
          patches do jogo
        </Link>
        .
      </Note>

      <Note>
        Conserto de cálculo entra aqui mesmo quando é pequeno. Se um número
        mudou, quem tomou uma decisão com o número velho tem o direito de saber
        — e de refazer a conta.
      </Note>

      <ol className="flex flex-col gap-3">
        {ATUALIZACOES.map((a, i) => {
          const f = ferramentaDe(a.onde);
          // Duas cores, duas perguntas. A da FERRAMENTA pinta a barra lateral
          // ("onde mexeu"); a do TIPO pinta o selo ("o que aconteceu"). Com uma
          // variável só, um Conserto e uma Melhoria do mesmo Stadium saíam os
          // dois em verde-limão e o selo deixava de significar qualquer coisa.
          const corFerramenta = f?.cor ?? "var(--color-line-strong)";
          const corTipo = TIPO_COR[a.tipo];
          return (
            <li key={`${a.data}-${i}`}>
              <Panel
                bodyClassName="flex flex-col gap-3"
                style={
                  {
                    "--tint": corFerramenta,
                    borderLeftColor: corFerramenta,
                  } as CSSProperties
                }
                className="border-l-2"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    className="pix rounded-pill px-2.5 py-1 text-[10px] tracking-[0.1em]"
                    style={{
                      color: corTipo,
                      backgroundColor: `color-mix(in oklab, ${corTipo} 14%, transparent)`,
                    }}
                  >
                    {TIPO_LABEL[a.tipo]}
                  </span>

                  {f ? (
                    <Link
                      href={f.href}
                      className="flex items-center gap-1.5 text-[13px] text-text-dim transition-colors hover:text-text"
                    >
                      <Sprite
                        src={arteUrl(f.arte)}
                        alt=""
                        size={18}
                        className="[--sprite:18px]"
                        fallback={
                          <f.Icone size={14} style={{ color: f.cor }} />
                        }
                      />
                      {f.nome}
                    </Link>
                  ) : (
                    <span className="text-[13px] text-text-mute">
                      o site todo
                    </span>
                  )}

                  <time
                    dateTime={a.data}
                    className="num ml-auto text-[12px] text-text-mute"
                  >
                    {dataLonga(a.data)}
                  </time>
                </div>

                <h2 className="text-[16px] leading-snug text-text sm:text-[18px]">
                  {a.titulo}
                </h2>

                <p className="text-[13px] leading-relaxed text-text-dim">
                  {a.resumo}
                </p>

                {a.itens?.length ? (
                  <ul className="flex flex-col gap-1.5 border-t border-line pt-3">
                    {a.itens.map((t) => (
                      <li
                        key={t}
                        className="flex items-start gap-2 text-[13px] leading-relaxed text-text-mute"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[7px] size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: corFerramenta }}
                        />
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            </li>
          );
        })}
      </ol>

      <Link
        href="/"
        className={cn(
          "pix inline-flex w-fit items-center gap-1.5 rounded-pill border border-line px-3 py-2",
          "text-[10px] tracking-[0.1em] text-text-dim transition-colors hover:border-accent hover:text-text",
        )}
      >
        VOLTAR PRA HOME
        <IconChevronRight size={14} />
      </Link>
    </div>
  );
}
