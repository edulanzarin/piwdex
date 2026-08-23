"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, Empty, Loading, Note, Panel, SearchInput, Segmented, Sprite } from "@/components/ui";
import { compact, num, TIER_LABEL } from "@/lib/labels";
import { qualityTier, TIER_COLOR } from "@/lib/rarity";
import { spriteUrl } from "@/lib/sprites";
import type { ActivePoke } from "@/lib/robo/jogo/pokes";
import { Pokeball } from "@/components/ui/pokeball";
import { ICONE, TOM } from "@/components/robo/pecas";
import { fichaDaConta, type FichaPoke } from "@/components/robo/poke-modal";
import type { BolaEstoque, Perfil } from "@/lib/robo/motor/tipos";

/**
 * A conta do jogo, inteira.
 *
 * Existe por um motivo prático: com o robô ligado, abrir o jogo no navegador
 * para conferir o saldo custa a sessão de caçada. Tudo aqui vem por REST, que
 * não disputa nada.
 */

interface ItemMochila {
  id: number;
  nome: string;
  icone: string;
  quantidade: number;
  precoNpc: number;
  categoria: string;
}

interface Meu extends ActivePoke {
  vendavel: boolean;
}

type Ordem = "qualidade" | "iv" | "nivel" | "valor" | "nome";

const ORDENAR: Record<Ordem, (a: Meu, b: Meu) => number> = {
  qualidade: (a, b) => b.quality - a.quality || b.ivTotal - a.ivTotal,
  iv: (a, b) => b.ivTotal - a.ivTotal || b.quality - a.quality,
  nivel: (a, b) => b.level - a.level || b.ivTotal - a.ivTotal,
  valor: (a, b) => b.sellValue - a.sellValue,
  nome: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
};

const CATEGORIA: Record<string, string> = {
  loot: "drop",
  heal: "cura",
  revive: "revive",
  ball: "bola",
  tm: "TM",
  evolution: "evolução",
  key: "chave",
};

function Dado({
  rotulo,
  valor,
  tom,
  icone,
}: {
  rotulo: string;
  valor: string;
  tom?: string;
  icone?: ReactNode;
}) {
  return (
    <div className="border border-line bg-bg-soft p-2.5">
      <p className="pix flex items-center gap-1.5 text-[10px] text-text-mute">
        {icone}
        {rotulo}
      </p>
      <p className="mt-1 text-[16px] leading-none font-bold tabular" style={{ color: tom ?? "var(--color-text)" }}>
        {valor}
      </p>
    </div>
  );
}

function data(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AbaConta({ onFicha }: { onFicha: (f: FichaPoke) => void }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [bolas, setBolas] = useState<BolaEstoque[]>([]);
  const [consumiveis, setConsumiveis] = useState<ItemMochila[]>([]);
  const [mochila, setMochila] = useState<ItemMochila[]>([]);
  const [pokemons, setPokemons] = useState<Meu[]>([]);
  const [boxVivo, setBoxVivo] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>("qualidade");
  const [buscaPoke, setBuscaPoke] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const res = await fetch("/api/robo/conta").catch(() => null);
    const j = (await res?.json().catch(() => null)) as
      | {
          perfil?: Perfil;
          bolas?: BolaEstoque[];
          consumiveis?: ItemMochila[];
          mochila?: ItemMochila[];
          pokemons?: Meu[];
          boxVivo?: boolean;
          erro?: string;
        }
      | null;
    if (!res?.ok) {
      setErro(
        j?.erro === "vinculo_vencido"
          ? "o token do jogo venceu: reconecte a conta"
          : "não consegui ler a conta no jogo",
      );
      setCarregando(false);
      return;
    }
    setPerfil(j?.perfil ?? null);
    setBolas(j?.bolas ?? []);
    setConsumiveis(j?.consumiveis ?? []);
    setMochila(j?.mochila ?? []);
    setPokemons(j?.pokemons ?? []);
    setBoxVivo(!!j?.boxVivo);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && !perfil) return <Loading />;

  const termo = busca.trim().toLowerCase();
  const itens = mochila.filter((i) => !termo || i.nome.toLowerCase().includes(termo));
  const valorParado = mochila.reduce((soma, i) => soma + i.quantidade * i.precoNpc, 0);
  const totalBolas = bolas.reduce((s, b) => (b.infinita ? s : s + b.quantidade), 0);

  return (
    <div className="flex flex-col gap-4">
      {erro ? <Note tone="danger">{erro}</Note> : null}

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="pix text-[13px] text-text-dim">
              {perfil?.nome ?? "Treinador"}
              {perfil?.vip ? <span className="ml-2 text-warn">VIP</span> : null}
            </h2>
            {perfil?.vip && perfil.vipAte ? (
              <p className="mt-1 text-[12px] text-text-mute">VIP até {data(perfil.vipAte)}.</p>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
            atualizar
          </Button>
        </div>

        {!perfil ? (
          <Empty title="Conta não carregou" hint="Reconecte a conta do jogo." />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Dado rotulo="Nível" valor={String(perfil.level)} icone={<ICONE.nivel size={12} />} />
            <Dado rotulo="Ouro" valor={compact(perfil.gold)} tom={TOM.ouro} icone={<ICONE.ouro size={12} />} />
            <Dado
              rotulo="Diamantes"
              valor={compact(perfil.diamantes)}
              tom={TOM.diamante}
              icone={<ICONE.diamante size={12} />}
            />
            <Dado rotulo="Capturas" valor={compact(perfil.capturas)} icone={<Pokeball size={12} />} />
            <Dado rotulo="Bolsa" valor={compact(totalBolas)} icone={<Pokeball size={12} />} />
            <Dado
              rotulo="Mochila"
              valor={compact(valorParado)}
              tom={TOM.vida}
              icone={<ICONE.ouro size={12} />}
            />
            {perfil.sequencia != null ? (
              <Dado rotulo="Sequência" valor={`${perfil.sequencia} dias`} />
            ) : null}
            {perfil.cla ? <Dado rotulo="Clã" valor={perfil.cla} /> : null}
            {perfil.profissao ? <Dado rotulo="Profissão" valor={perfil.profissao} /> : null}
            {perfil.pescaria != null ? <Dado rotulo="Pescaria" valor={num(perfil.pescaria, 0)} /> : null}
            {perfil.passeNivel != null ? (
              <Dado rotulo="Passe" valor={compact(perfil.passeNivel)} />
            ) : null}
          </div>
        )}
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ---- bolsa: o que a caçada GASTA ---- */}
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pix text-[13px] text-text-dim">Bolsa</h2>
            <span className="pix text-[11px] text-text-mute">bolas, poções, revives</span>
          </div>

          {consumiveis.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1">
              {consumiveis.map((i) => (
                <li key={i.id} className="flex items-center gap-2 border border-line bg-bg-soft px-2 py-1.5">
                  {i.icone ? <Sprite src={i.icone} alt="" size={22} /> : null}
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text">{i.nome}</span>
                  <span className="shrink-0 text-[12px] tabular text-text-dim">{compact(i.quantidade)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {bolas.length === 0 ? (
            <Empty title="Sem bolas" hint="O catálogo chega junto com a conta." />
          ) : (
            <ul className="mt-3 flex flex-col gap-1">
              {[...bolas]
                .sort((a, b) => Number(b.infinita) - Number(a.infinita) || b.quantidade - a.quantidade)
                .map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-2 border border-line bg-bg-soft px-2 py-1.5"
                  >
                    {b.icone ? <Sprite src={b.icone} alt="" size={22} /> : null}
                    <span className="min-w-0 flex-1 truncate text-[13px] text-text">{b.nome}</span>
                    <span
                      className="shrink-0 text-[12px] tabular"
                      style={{ color: b.infinita ? "var(--color-neon)" : b.quantidade ? "var(--color-text-dim)" : "var(--color-danger)" }}
                    >
                      {b.infinita ? "∞" : compact(b.quantidade)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        {/* ---- mochila ---- */}
        <Panel className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="pix text-[13px] text-text-dim">Mochila</h2>
            <span className="pix text-[11px] text-text-mute">
              {mochila.length} tipos · {compact(valorParado)} de ouro parado
            </span>
          </div>

          <div className="mt-3">
            <SearchInput
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              placeholder="filtrar item…"
            />
          </div>

          {itens.length === 0 ? (
            <Empty
              title={mochila.length ? "Nada com esse nome" : "Mochila vazia"}
              hint={mochila.length ? undefined : "Os drops aparecem depois dos primeiros abates."}
            />
          ) : (
            <ul className="mt-3 grid max-h-[480px] gap-1 overflow-y-auto sm:grid-cols-2">
              {itens.map((i) => (
                <li key={i.id} className="flex items-center gap-2 border border-line bg-bg-soft px-2 py-1.5">
                  {i.icone ? <Sprite src={i.icone} alt="" size={22} /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-text">{i.nome}</span>
                    <span className="pix text-[10px] text-text-mute">
                      {CATEGORIA[i.categoria] ?? i.categoria}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] tabular text-text-dim">{compact(i.quantidade)}x</span>
                    <span className="block text-[11px] tabular text-text-mute">
                      {compact(i.quantidade * i.precoNpc)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---- todos os pokémons ---- */}
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="pix text-[13px] text-text-dim">Pokémons</h2>
            <p className="mt-1 text-[12px] text-text-mute">
              {pokemons.length
                ? `${pokemons.filter((p) => p.team).length} no time · ${pokemons.filter((p) => !p.team).length} no box`
                : "Time e box."}
            </p>
          </div>
          <Segmented
            value={ordem}
            onChange={setOrdem}
            size="sm"
            options={[
              { value: "qualidade", label: "qualidade" },
              { value: "iv", label: "IV" },
              { value: "nivel", label: "nível" },
              { value: "valor", label: "valor" },
              { value: "nome", label: "nome" },
            ]}
          />
        </div>

        <div className="mt-3">
          <SearchInput
            value={buscaPoke}
            onChange={(e) => setBuscaPoke(e.currentTarget.value)}
            placeholder="filtrar pokémon…"
          />
        </div>

        {!boxVivo ? (
          <Note className="mt-3">
            O box só existe com a sessão do jogo aberta. Ligue o robô para ver a coleção inteira.
          </Note>
        ) : null}

        {(() => {
          const t = buscaPoke.trim().toLowerCase();
          const lista = pokemons
            .filter((p) => !t || p.name.toLowerCase().includes(t))
            .sort(ORDENAR[ordem]);
          if (!lista.length) {
            return (
              <Empty
                title={pokemons.length ? "Nada com esse nome" : "Nenhum pokémon carregado"}
                hint={pokemons.length ? undefined : "Ligue o robô para ler a coleção."}
              />
            );
          }
          return (
            <ul className="mt-3 grid max-h-[560px] gap-1 overflow-y-auto lg:grid-cols-2">
              {lista.map((p) => {
                const tier = qualityTier(p.quality);
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 border border-line bg-bg-soft p-2 transition-colors hover:border-line-strong"
                    style={
                      p.leader
                        ? { borderColor: "color-mix(in srgb, var(--color-t-robo) 45%, transparent)" }
                        : p.vendavel
                          ? { borderColor: "color-mix(in srgb, var(--color-danger) 40%, transparent)" }
                          : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onFicha(fichaDaConta(p, p.team ? "no seu time" : "no seu box"))
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      title="ver a ficha completa"
                    >
                    <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt="" size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-text">
                        <span className="truncate">{p.name}</span>
                        <span className="pix text-[10px] text-text-mute">nv {p.level}</span>
                        {p.leader ? (
                          <span className="pix text-[10px]" style={{ color: "var(--color-t-robo)" }}>
                            líder
                          </span>
                        ) : p.team ? (
                          <span className="pix text-[10px] text-text-mute">time</span>
                        ) : null}
                        {p.shiny ? <span className="pix text-[10px] text-warn">shiny</span> : null}
                        {p.locked ? <span className="pix text-[10px] text-text-mute">cadeado</span> : null}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] tabular text-text-mute">
                        <span className="pix text-[10px]" style={{ color: TIER_COLOR[tier] }}>
                          {TIER_LABEL[tier]}
                        </span>
                        <span>IV {p.ivTotal}</span>
                        <span>poder {compact(p.power)}</span>
                        <span>vale {compact(p.sellValue)}</span>
                        <span>
                          {num(p.hp, 0)}/{num(p.maxHp, 0)}
                        </span>
                      </p>
                    </div>
                    </button>
                    {p.vendavel ? (
                      <span className="pix shrink-0 text-[10px] text-danger">sai na venda</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </Panel>
    </div>
  );
}
