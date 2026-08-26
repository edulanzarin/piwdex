"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  alvosTocados,
  combina,
  frase,
  naturezaLabel,
  porAlvo,
  resumo,
  type Alvo,
  type Familia,
  type Mudanca,
  type Natureza,
  type Patch,
} from "@/lib/patches";
import {
  escreverPatchQuery,
  lerPatchQuery,
  patchQueryVazia,
  PATCH_PADRAO,
  type PatchQuery,
} from "@/lib/patch-url";
import { spriteUrl } from "@/lib/sprites";
import {
  Button,
  Chip,
  Empty,
  Panel,
  SearchInput,
  Segmented,
  Sprite,
} from "@/components/ui";

/**
 * A ficha de um patch, filtrável.
 *
 * ## Por que ela precisou de filtro
 *
 * A primeira versão despejava as 1.200 mudanças numa lista só, agrupadas por
 * alvo e ordenadas por impacto. Ordenar certo resolve as dez primeiras linhas e
 * não resolve a página: quem abre isto quase nunca quer ler o patch — quer saber
 * se **mexeram no bicho dele**, ou quantos drops sumiram. Numa lista de 238
 * espécies, as duas perguntas se respondem com Ctrl+F, que é o sinal de que a
 * tela não fez o trabalho dela.
 *
 * Então a tela passa a aceitar três recortes, e eles são os três que a pergunta
 * real usa: um NOME (busca), uma NATUREZA (só o ouro, só os drops que sumiram) e
 * uma FAMÍLIA (espécie, item, ponto de caça).
 *
 * ## O que a contagem mostra
 *
 * Os chips de natureza carregam o número dentro do RECORTE ATUAL, e não o total
 * do patch. Com o total, filtrar por "drop removido" e ver "drop-chance (1005)"
 * ao lado seria um número que não descreve nada do que está na tela — e número
 * que não descreve a tela é o que faz alguém desconfiar do resto dela.
 *
 * ## O teto de desenho
 *
 * Mesmo filtrado, um patch pode devolver 200 blocos, e desenhar todos de uma vez
 * trava o telefone por segundos. A tela desenha `PASSO` blocos e cresce sob
 * demanda — com o total escrito no botão, porque "ver mais" sem número esconde
 * o tamanho do que falta.
 */

const PASSO = 40;

export function PatchBrowser({ patch }: { patch: Patch }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [q, setQ] = useState<PatchQuery>(() => lerPatchQuery(new URLSearchParams(sp.toString())));
  const [teto, setTeto] = useState(PASSO);

  // A URL segue o estado, e não o contrário: `replace` (e não `push`) porque
  // mexer num filtro não é navegar — com `push`, o botão voltar do telefone
  // desfaria letra por letra o que a pessoa digitou na busca.
  useEffect(() => {
    router.replace(`${pathname}${escreverPatchQuery(q)}`, { scroll: false });
  }, [q, pathname, router]);

  // Mexeu no filtro, o teto volta ao começo: manter 200 blocos abertos de um
  // recorte antigo faz a tela nova nascer no meio de si mesma.
  useEffect(() => setTeto(PASSO), [q.q, q.nat.join(","), q.fam, q.ord]);

  const filtradas = useMemo(() => {
    const nat = new Set(q.nat);
    return patch.mudancas.filter((m) => {
      if (q.fam !== "todas" && m.alvo.familia !== q.fam) return false;
      if (nat.size && !nat.has(m.natureza)) return false;
      return combina(m, q.q);
    });
  }, [patch.mudancas, q.q, q.nat, q.fam]);

  const grupos = useMemo(() => {
    const gs = porAlvo({ ...patch, mudancas: filtradas });
    if (q.ord === "nome") {
      return [...gs].sort((a, b) => a.alvo.nome.localeCompare(b.alvo.nome, "pt-BR"));
    }
    return gs;
  }, [patch, filtradas, q.ord]);

  // As naturezas do PATCH inteiro (pra o chip nunca sumir do trilho quando o
  // próprio filtro zera a contagem dele), com a contagem do recorte atual.
  const naturezas = useMemo(() => {
    const doPatch = resumo(patch).map((r) => r.natureza);
    const conta = new Map<Natureza, number>();
    for (const m of filtradas) conta.set(m.natureza, (conta.get(m.natureza) ?? 0) + 1);
    return doPatch.map((n) => ({ natureza: n, n: conta.get(n) ?? 0 }));
  }, [patch, filtradas]);

  const familias: Array<{ value: Familia | "todas"; label: string; n: number }> = [
    { value: "todas", label: "Tudo", n: patch.mudancas.length },
    { value: "especie", label: "Espécies", n: alvosTocados(patch, "especie") },
    { value: "item", label: "Itens", n: alvosTocados(patch, "item") },
    { value: "spot", label: "Pontos", n: alvosTocados(patch, "spot") },
  ];

  const alternarNatureza = (n: Natureza) =>
    setQ((v) => ({
      ...v,
      nat: v.nat.includes(n) ? v.nat.filter((x) => x !== n) : [...v.nat, n],
    }));

  const visiveis = grupos.slice(0, teto);
  const limpo = patchQueryVazia(q);

  return (
    <div className="flex flex-col gap-3">
      <Panel bodyClassName="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <SearchInput
              value={q.q}
              onChange={(e) => setQ((v) => ({ ...v, q: e.target.value }))}
              placeholder="Buscar espécie, item, drop ou golpe…"
              aria-label="Buscar no patch"
            />
          </div>

          <Segmented
            aria-label="Ordenar"
            value={q.ord}
            onChange={(ord) => setQ((v) => ({ ...v, ord }))}
            options={[
              { value: "impacto", label: "Impacto", title: "o que mais mexeu primeiro" },
              { value: "nome", label: "Nome", title: "alfabético pelo alvo" },
            ]}
          />

          {!limpo ? (
            <Button variant="ghost" size="sm" onClick={() => setQ(PATCH_PADRAO)}>
              limpar
            </Button>
          ) : null}
        </div>

        {/* A família só aparece quando o patch tocou em mais de uma: um trilho
            com três opções mortas ensina que a tela tem filtro que não serve. */}
        {familias.filter((f) => f.value !== "todas" && f.n > 0).length > 1 ? (
          <Segmented
            aria-label="Família"
            value={q.fam}
            onChange={(fam) => setQ((v) => ({ ...v, fam }))}
            options={familias
              .filter((f) => f.value === "todas" || f.n > 0)
              .map((f) => ({ value: f.value, label: `${f.label} (${f.n})` }))}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {naturezas.map(({ natureza, n }) => {
            const on = q.nat.includes(natureza);
            return (
              <button key={natureza} type="button" onClick={() => alternarNatureza(natureza)}>
                <Chip
                  tone={on ? "accent" : "neutral"}
                  className={n === 0 && !on ? "opacity-45" : undefined}
                >
                  {naturezaLabel(natureza)} ({n})
                </Chip>
              </button>
            );
          })}
        </div>
      </Panel>

      <p className="pix px-1 text-[11px] text-text-mute">
        {filtradas.length.toLocaleString("pt-BR")}{" "}
        {filtradas.length === 1 ? "mudança" : "mudanças"} em{" "}
        {grupos.length.toLocaleString("pt-BR")} {grupos.length === 1 ? "alvo" : "alvos"}
      </p>

      {grupos.length === 0 ? (
        <Empty
          title="Nada neste patch bate com o filtro"
          hint="O patch tem mudança, mas nenhuma dela sobrevive a este recorte. Tire uma natureza ou limpe a busca."
          action={
            <Button variant="outline" size="sm" onClick={() => setQ(PATCH_PADRAO)}>
              limpar filtros
            </Button>
          }
        />
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {visiveis.map((g) => (
              <li key={`${g.alvo.familia}-${g.alvo.id}`}>
                <BlocoAlvo alvo={g.alvo} mudancas={g.mudancas} />
              </li>
            ))}
          </ol>

          {grupos.length > teto ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setTeto((t) => t + PASSO)}
            >
              ver mais {Math.min(PASSO, grupos.length - teto)} de{" "}
              {(grupos.length - teto).toLocaleString("pt-BR")} restantes
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function rotaDo(alvo: Alvo): string | null {
  if (alvo.familia === "especie") return `/dex/${alvo.id}`;
  if (alvo.familia === "item") return `/itens/${alvo.id}`;
  return null;
}

const FAMILIA_LABEL: Record<Familia, string> = {
  especie: "espécie",
  item: "item",
  spot: "ponto de caça",
};

function BlocoAlvo({ alvo, mudancas }: { alvo: Alvo; mudancas: Mudanca[] }) {
  const rota = rotaDo(alvo);
  const sprite = alvo.familia === "especie" ? spriteUrl(Number(alvo.id)) : null;

  const cabeca = (
    <span className="flex items-center gap-2">
      {sprite ? <Sprite src={sprite} alt="" size={28} className="[--sprite:28px]" /> : null}
      <span className="text-[14px] text-text">{alvo.nome}</span>
      {/* A família por extenso só onde ela não é óbvia: espécie tem sprite, e
          repetir "espécie" ao lado de um Ledian desenhado é ruído. */}
      {alvo.familia !== "especie" ? (
        <span className="pix text-[10px] text-text-mute">{FAMILIA_LABEL[alvo.familia]}</span>
      ) : null}
    </span>
  );

  return (
    <Panel
      title={
        rota ? (
          <Link href={rota} className="transition-colors hover:text-accent">
            {cabeca}
          </Link>
        ) : (
          cabeca
        )
      }
      bodyClassName="flex flex-col gap-1.5"
    >
      {mudancas.map((m, i) => (
        <p
          key={`${m.natureza}-${m.detalhe ?? i}`}
          className="flex items-start gap-2 text-[13px] leading-relaxed text-text-dim"
        >
          <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
          {/* Sem o sujeito: o cabeçalho do bloco já diz de quem se fala, e
              repetir o nome em toda linha rouba a primeira palavra — que é onde
              o olho procura o que mudou. */}
          {frase(m, { sujeito: false })}
        </p>
      ))}
    </Panel>
  );
}
