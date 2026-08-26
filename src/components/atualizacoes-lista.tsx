"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  dataLonga,
  TIPO_COR,
  TIPO_LABEL,
  type Atualizacao,
  type TipoAtualizacao,
} from "@/lib/atualizacoes";
import { FERRAMENTAS, arteUrl } from "@/lib/ferramentas";
import { semAcento } from "@/lib/patches";
import {
  Button,
  Chip,
  Empty,
  IconChevronRight,
  Panel,
  SearchInput,
  Segmented,
  Sprite,
} from "@/components/ui";

/**
 * O changelog do site, filtrável.
 *
 * ## Por que o filtro aqui é outro filtro
 *
 * O diário de patches filtra no SERVIDOR, porque ele cresce sem teto e cada
 * entrada carrega mil mudanças. Este cresce a uma entrada por trabalho meu, cada
 * uma com um parágrafo — a lista inteira cabe folgada no cliente, e mandar isso
 * pro servidor a cada tecla trocaria resposta instantânea por ida e volta.
 *
 * Mesma tela, decisões opostas, e o que decide é o tamanho do que se filtra.
 *
 * ## O recorte que interessa
 *
 * "Mudou alguma coisa na Hunt?" e "o que quebrou e foi consertado?" são as duas
 * perguntas reais, e elas pedem eixos diferentes: FERRAMENTA e TIPO. O tipo
 * ganhou trilho próprio porque `conserto` é o que mais importa e o que menos
 * aparece — quem tomou uma decisão com um número que depois mudou precisa achar
 * a linha da correção sem ler as outras dez.
 */
export function AtualizacoesLista({ itens }: { itens: Atualizacao[] }) {
  const [tipo, setTipo] = useState<TipoAtualizacao | "tudo">("tudo");
  const [onde, setOnde] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const contaTipo = useMemo(() => {
    const c = new Map<TipoAtualizacao, number>();
    for (const a of itens) c.set(a.tipo, (c.get(a.tipo) ?? 0) + 1);
    return c;
  }, [itens]);

  // Só as ferramentas que APARECEM no changelog viram chip. Um trilho com as
  // nove, das quais três nunca mudaram, ensina que o filtro não filtra.
  const ondes = useMemo(() => {
    const usados = new Set(itens.map((a) => a.onde));
    const lista = FERRAMENTAS.filter((f) => usados.has(f.href)).map((f) => ({
      href: f.href,
      nome: f.nome,
      cor: f.cor,
      arte: f.arte,
      Icone: f.Icone,
    }));
    return { lista, temSite: usados.has(null) };
  }, [itens]);

  const filtradas = useMemo(() => {
    const termo = semAcento(q.trim());
    return itens.filter((a) => {
      if (tipo !== "tudo" && a.tipo !== tipo) return false;
      if (onde !== null && a.onde !== (onde === "site" ? null : onde)) return false;
      if (!termo) return true;
      const alvo = semAcento(
        [a.titulo, a.resumo, ...(a.itens ?? [])].join(" "),
      );
      return alvo.includes(termo);
    });
  }, [itens, tipo, onde, q]);

  const limpo = tipo === "tudo" && onde === null && !q.trim();

  return (
    <div className="flex flex-col gap-3">
      <Panel bodyClassName="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar no que mudou…"
              aria-label="Buscar nas atualizações"
            />
          </div>

          <Segmented
            aria-label="Tipo"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: "tudo" as const, label: `Tudo (${itens.length})` },
              ...(["novo", "conserto", "melhoria"] as const)
                .filter((t) => contaTipo.get(t))
                .map((t) => ({
                  value: t,
                  label: `${TIPO_LABEL[t]} (${contaTipo.get(t) ?? 0})`,
                })),
            ]}
          />

          {!limpo ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTipo("tudo");
                setOnde(null);
                setQ("");
              }}
            >
              limpar
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {ondes.lista.map((f) => {
            const on = onde === f.href;
            return (
              <button
                key={f.href}
                type="button"
                onClick={() => setOnde(on ? null : f.href)}
                aria-pressed={on}
              >
                <Chip tint={on ? f.cor : undefined} icon={<Sprite src={arteUrl(f.arte)} alt="" size={14} className="[--sprite:14px]" fallback={<f.Icone size={12} />} />}>
                  {f.nome}
                </Chip>
              </button>
            );
          })}
          {ondes.temSite ? (
            <button
              type="button"
              onClick={() => setOnde(onde === "site" ? null : "site")}
              aria-pressed={onde === "site"}
            >
              <Chip tone={onde === "site" ? "accent" : "neutral"}>o site todo</Chip>
            </button>
          ) : null}
        </div>
      </Panel>

      {filtradas.length === 0 ? (
        <Empty
          title="Nada bate com esse recorte"
          hint="Pode ser que a ferramenta que você escolheu ainda não tenha mudado desse jeito."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTipo("tudo");
                setOnde(null);
                setQ("");
              }}
            >
              limpar filtros
            </Button>
          }
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {filtradas.map((a, i) => (
            <li key={`${a.data}-${a.titulo}-${i}`}>
              <Entrada atualizacao={a} />
            </li>
          ))}
        </ol>
      )}

      <Link
        href="/patches"
        className="pix inline-flex w-fit items-center gap-1.5 rounded-pill border border-line px-3 py-2 text-[10px] tracking-[0.1em] text-text-dim transition-colors hover:border-accent hover:text-text"
      >
        O QUE O JOGO MUDOU
        <IconChevronRight size={14} />
      </Link>
    </div>
  );
}

function Entrada({ atualizacao: a }: { atualizacao: Atualizacao }) {
  const f = a.onde ? (FERRAMENTAS.find((x) => x.href === a.onde) ?? null) : null;
  // Duas cores, duas perguntas. A da FERRAMENTA pinta a barra lateral ("onde
  // mexeu"); a do TIPO pinta o selo ("o que aconteceu"). Com uma variável só, um
  // Conserto e uma Melhoria do mesmo Stadium saíam os dois em verde-limão e o
  // selo deixava de significar qualquer coisa.
  const corFerramenta = f?.cor ?? "var(--color-line-strong)";
  const corTipo = TIPO_COR[a.tipo];

  return (
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
              fallback={<f.Icone size={14} style={{ color: f.cor }} />}
            />
            {f.nome}
          </Link>
        ) : (
          <span className="text-[13px] text-text-mute">o site todo</span>
        )}

        <time dateTime={a.data} className="num ml-auto text-[12px] text-text-mute">
          {dataLonga(a.data)}
        </time>
      </div>

      <h2 className="text-[16px] leading-snug text-text sm:text-[18px]">{a.titulo}</h2>

      <p className="text-[13px] leading-relaxed text-text-dim">{a.resumo}</p>

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
  );
}
