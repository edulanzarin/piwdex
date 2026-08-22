import Link from "next/link";
import { getDexPayload } from "@/lib/dex-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { Chip, IconChevronRight, Pokeball, Sprite } from "@/components/ui";
import { BookOpen, Calculator, Egg, Package, Radar, Swords } from "lucide-react";

export const revalidate = 3600;

/**
 * Pagina inicial.
 *
 * Ela NAO lista dado. A versao anterior abria com tres paineis de "top 5 do
 * catalogo" e o Eduardo cortou: o lugar do dado e a Pokedex, onde ele vem com
 * filtro, ordem e o card inteiro. Rank fixo na home e uma segunda fonte de
 * verdade que ninguem mantem — e ainda ensina o visitante a ler o catalogo por
 * uma janelinha de cinco linhas em vez de abrir a ferramenta.
 *
 * O que sobra e o que a home tem de fazer: dizer o que o site e, provar que o
 * catalogo esta vivo, e mandar pra ferramenta certa.
 */

/**
 * Cada ferramenta tem COR e ARTE propria.
 *
 * A cor sozinha ja tirava a home de "seis caixas cinza iguais". A arte fecha o
 * argumento: um icone de linha do lucide a 24px e vocabulario de dashboard, e
 * este site e ferramenta de JOGO — pixel art com contorno e halo neon fala a
 * mesma lingua dos sprites e do wallpaper.
 *
 * Os PNG vivem em `public/images/icons/<arte>.png`, num grid 32x32 com moldura
 * de 44 (a mesma proporcao do pokedex.png, senao um icone colado na borda
 * aparece MAIOR que os outros dentro da mesma caixa). O gerador esta em
 * `scripts/pixel-icons/`. O icone do lucide fica como reserva: arte que nao
 * carregou nao pode virar caixa vazia.
 */
const TOOLS = [
  {
    href: "/dex",
    name: "Pokédex",
    desc:
      "Todas as espécies com filtro por tipo, raridade, origem, estágio, fraqueza e " +
      "faixa de nível, valor, XP, stats e poder de golpe.",
    icon: BookOpen,
    arte: "pokedex",
    cor: "var(--color-t-dex)",
    ready: true,
  },
  {
    href: "/itens",
    name: "Itens",
    desc: "Catálogo de itens com o índice reverso: quem dropa cada um, e com que chance real.",
    icon: Package,
    arte: "itens",
    cor: "var(--color-t-itens)",
    ready: true,
  },
  {
    href: "/calc",
    name: "Calculadora",
    desc: "IV, Quality e Poder pela fórmula do jogo. Projeta os stats em qualquer nível.",
    icon: Calculator,
    arte: "calculadora",
    cor: "var(--color-t-calc)",
    ready: true,
  },
  {
    href: "/hunt",
    name: "Hunt",
    desc:
      "Todo alvo do jogo medido contra o SEU pokémon, pelos dois lados do combate: XP/h, " +
      "ouro/h e risco reais — e a rota de níveis até a meta.",
    icon: Radar,
    arte: "hunt",
    cor: "var(--color-t-hunt)",
    ready: true,
  },
  {
    href: "/breed",
    name: "Breeding",
    desc:
      "Valida o par, mostra o sorteio de Quality e o IV que o filho herda — e diz quantos " +
      "breeds faltam até a Quality alvo, com o melhor caso, o típico e o azarado.",
    icon: Egg,
    arte: "breeding",
    cor: "var(--color-t-breed)",
    ready: true,
  },
  {
    href: "/meta",
    name: "Meta",
    desc: "Quem bate em quem: cobertura de tipo, fraquezas cruzadas e montagem de time.",
    icon: Swords,
    arte: "meta",
    cor: "var(--color-t-meta)",
    ready: false,
  },
];

export default async function HomePage() {
  const t0 = agora();
  const { counts, catalog } = await getDexPayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* ================= topo ================= */}
      {/* O heroi NAO tem painel: texto direto sobre o wallpaper.
          Isso so passou a ser possivel depois que a arte foi escurecida
          (luminancia media 37, pico 67) — com a foto clara original era
          ilegivel. `.on-art` poe sombra na letra, que e o que segura o texto
          na parte mais clara da cena sem escurecer a foto inteira. */}
      <section className="on-art flex flex-col items-center justify-center gap-7 px-4 py-14 text-center sm:py-20">
        <div className="flex items-center gap-5">
          <Pokeball size={88} className="anim-float text-[var(--color-t-dex)]" />
          <div className="text-left">
            <h1 className="pix text-[52px] leading-none text-text sm:text-[68px]">
              piw<span className="text-accent">dex</span>
            </h1>
            <p className="pix mt-3 text-[13px] text-text-mute">
              dex e ferramentas de poke idle world
            </p>
          </div>
        </div>

        <h2 className="max-w-4xl text-[36px] leading-tight font-bold text-text sm:text-[48px]">
          A dex <span style={{ color: "var(--color-t-dex)" }}>completa</span> do{" "}
          <span style={{ color: "var(--color-t-meta)" }}>Poke Idle World</span>.
        </h2>

        <p className="max-w-2xl text-[18px] leading-relaxed text-text-dim">
          Stats, movesets, evoluções, a chance{" "}
          <span style={{ color: "var(--color-t-hunt)" }}>real</span> de cada drop, onde
          farmar cada item e em que área cada pokémon aparece — com filtro por tipo,
          raridade, estágio, fraqueza e faixa de nível, valor, XP e poder de golpe.
        </p>

        {/* O vao entre o paragrafo e os cards era espaco morto. Aqui ele faz o
            terceiro trabalho da home — provar que o catalogo esta VIVO. Nao e
            lista de dado (isso e a Pokedex): e o tamanho do catalogo do momento
            e de onde ele veio, que e exatamente o que uma dex de fa precisa
            dizer pra ser levada a serio. */}
        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {[
              { n: counts.creatures, label: "espécies", cor: "var(--color-t-dex)" },
              { n: counts.items, label: "itens", cor: "var(--color-t-itens)" },
              { n: counts.hunts, label: "locais de caça", cor: "var(--color-t-hunt)" },
              { n: counts.drops, label: "registros de drop", cor: "var(--color-t-meta)" },
            ].map((k) => (
              <span key={k.label} className="flex flex-col items-center gap-1">
                <span
                  className="text-[30px] leading-none font-bold tabular sm:text-[34px]"
                  style={{ color: k.cor }}
                >
                  {k.n.toLocaleString("pt-BR")}
                </span>
                <span className="pix text-[11px] text-text-mute">{k.label}</span>
              </span>
            ))}
          </div>

          <Chip
            size="sm"
            tone={catalog.live ? "ok" : "warn"}
            title={
              catalog.live
                ? `Catálogo do jogo, publicado em ${catalog.generatedAt}`
                : `Fonte indisponível (${catalog.error ?? "motivo desconhecido"})`
            }
          >
            {catalog.live ? "direto do catálogo do jogo" : "fonte fora do ar — último catálogo salvo"}
          </Chip>
        </div>
      </section>

      {/* ================= ferramentas ================= */}
      <section className="flex flex-col gap-4">
        <h2 className="pix text-[14px] text-text-dim">Ferramentas</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const body = (
              <>
                <div className="flex items-start gap-4 sm:gap-5">
                  {/* A arte carrega a identidade da ferramenta e e a primeira
                      coisa que o olho pega — entao ela tem tamanho de figura,
                      nao de bullet. O `Sprite` ja resolve carga e falha: sem o
                      PNG, entra o icone de linha no lugar. */}
                  <span
                    className="shrink-0 transition-transform duration-300 group-hover:scale-105"
                    style={{ opacity: t.ready ? 1 : 0.55 }}
                  >
                    <Sprite
                      src={`/images/icons/${t.arte}.png`}
                      alt=""
                      size={104}
                      priority
                      fallback={<Icon size={34} strokeWidth={1.8} style={{ color: t.cor }} />}
                    />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <h3
                        className="pix flex-1 text-[19px] leading-none"
                        style={{ color: t.cor, opacity: t.ready ? 1 : 0.6 }}
                      >
                        {t.name}
                      </h3>
                      {t.ready ? null : <Chip size="sm">em breve</Chip>}
                    </div>

                    <p
                      className={
                        t.ready
                          ? "text-[15px] leading-relaxed text-text-dim"
                          : "text-[15px] leading-relaxed text-text-mute/70"
                      }
                    >
                      {t.desc}
                    </p>

                    {/* O botao mora na COLUNA DO TEXTO, alinhado com a
                        descricao. Solto no rodape do card ele se descola da
                        frase que explica pra onde vai. */}
                    {t.ready ? (
                      <span
                        className="pix mt-1 inline-flex h-10 w-fit items-center gap-2 border px-4 text-[13px] transition-all group-hover:brightness-125"
                        style={{
                          borderColor: `color-mix(in oklab, ${t.cor} 60%, transparent)`,
                          backgroundColor: `color-mix(in oklab, ${t.cor} 18%, transparent)`,
                          color: t.cor,
                        }}
                      >
                        abrir {t.name.toLowerCase()}
                        <IconChevronRight size={16} />
                      </span>
                    ) : null}
                  </div>
                </div>
              </>
            );

            const skin = {
              borderColor: `color-mix(in oklab, ${t.cor} ${t.ready ? 42 : 22}%, var(--color-line))`,
              boxShadow: `0 0 52px -26px ${t.cor}`,
            };

            return t.ready ? (
              <Link
                key={t.href}
                href={t.href}
                className="panel group flex flex-col p-5 transition-all hover:brightness-110"
                style={skin}
              >
                {body}
              </Link>
            ) : (
              /* `opacity` no card inteiro tambem apagava o VIDRO — sobre a foto,
                 o texto ficava ilegivel. Quem esmaece e o conteudo, pela cor; a
                 superficie fica de pe. */
              <div key={t.href} className="panel flex flex-col p-5" style={skin}>
                {body}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
