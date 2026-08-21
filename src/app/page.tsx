import Link from "next/link";
import { getDexPayload } from "@/lib/dex-data";
import { Chip, IconChevronRight, Pokeball } from "@/components/ui";
import { Sparkles } from "lucide-react";
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
 * Cada ferramenta tem COR propria.
 *
 * Sem isso a home e uma lista de seis caixas cinza iguais, e o olho nao tem
 * onde pousar. Com cor, a pessoa reconhece a ferramenta antes de ler o titulo —
 * e depois passa a associar "o vermelho e a dex" nas telas internas.
 */
const TOOLS = [
  {
    href: "/dex",
    name: "Pokédex",
    desc:
      "Todas as espécies com filtro por tipo, raridade, origem, estágio, fraqueza e " +
      "faixa de nível, valor, XP, stats e poder de golpe.",
    icon: BookOpen,
    cor: "var(--color-t-dex)",
    ready: true,
  },
  {
    href: "/itens",
    name: "Itens",
    desc: "Catálogo de itens com o índice reverso: quem dropa cada um, e com que chance real.",
    icon: Package,
    cor: "var(--color-t-itens)",
    ready: false,
  },
  {
    href: "/calc",
    name: "Calculadora",
    desc: "IV, Quality e Poder pela fórmula do jogo. Projeta os stats em qualquer nível.",
    icon: Calculator,
    cor: "var(--color-t-calc)",
    ready: false,
  },
  {
    href: "/hunt",
    name: "Hunt",
    desc: "Rota de caça por XP, ouro e efetividade — usando o melhor golpe CONTRA o alvo.",
    icon: Radar,
    cor: "var(--color-t-hunt)",
    ready: false,
  },
  {
    href: "/breed",
    name: "Breeding",
    desc: "Simula o ovo, projeta os stats do filho e planeja quantos breeds até a Quality alvo.",
    icon: Egg,
    cor: "var(--color-t-breed)",
    ready: false,
  },
  {
    href: "/meta",
    name: "Meta",
    desc: "Quem bate em quem: cobertura de tipo, fraquezas cruzadas e montagem de time.",
    icon: Swords,
    cor: "var(--color-t-meta)",
    ready: false,
  },
];

export default async function HomePage() {
  await getDexPayload();

  return (
    <div className="flex flex-col gap-10 py-6">
      {/* ================= topo ================= */}
      {/* O heroi NAO tem painel: texto direto sobre o wallpaper.
          Isso so passou a ser possivel depois que a arte foi escurecida
          (luminancia media 37, pico 67) — com a foto clara original era
          ilegivel. `.on-art` poe sombra na letra, que e o que segura o texto
          na parte mais clara da cena sem escurecer a foto inteira. */}
      <section className="on-art flex flex-col items-center gap-7 px-4 py-14 text-center sm:py-20">
        <div className="flex items-center gap-4">
          <Pokeball size={64} className="anim-float text-[var(--color-t-dex)]" />
          <div className="text-left">
            <h1 className="pix text-[38px] leading-none text-text sm:text-[48px]">
              piw<span className="text-accent">dex</span>
            </h1>
            <p className="pix mt-2 text-[12px] text-text-mute">
              dex e ferramentas de poke idle world
            </p>
          </div>
        </div>

        <h2 className="max-w-3xl text-[30px] leading-tight font-bold text-text sm:text-[36px]">
          A dex <span style={{ color: "var(--color-t-dex)" }}>completa</span> do{" "}
          <span style={{ color: "var(--color-t-meta)" }}>Poke Idle World</span>.
        </h2>

        <p className="max-w-2xl text-[17px] leading-relaxed text-text-dim">
          Stats, movesets, evoluções, a chance{" "}
          <span style={{ color: "var(--color-t-hunt)" }}>real</span> de cada drop, onde
          farmar cada item e em que área cada pokémon aparece — com filtro por tipo,
          raridade, estágio, fraqueza e faixa de nível, valor, XP e poder de golpe.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dex"
            className="pix inline-flex h-12 items-center gap-3 rounded-pix border px-7 text-[14px] transition-opacity hover:opacity-85"
            style={{
              borderColor: "color-mix(in oklab, var(--color-t-dex) 60%, transparent)",
              backgroundColor: "color-mix(in oklab, var(--color-t-dex) 22%, transparent)",
              color: "var(--color-t-dex)",
            }}
          >
            abrir a pokédex
            <IconChevronRight size={16} />
          </Link>

        </div>
      </section>

      {/* ================= ferramentas ================= */}
      <section className="flex flex-col gap-4">
        <h2 className="pix text-[14px] text-text-dim">Ferramentas</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const body = (
              <>
                <div className="flex items-start gap-4">
                  {/* Icone e titulo carregam a cor da FERRAMENTA. E o que faz a
                      home parar de ser seis caixas cinza iguais, e o que depois
                      deixa reconhecer a tela pela cor antes de ler o titulo. */}
                  <span
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-none border"
                    style={{
                      borderColor: `color-mix(in oklab, ${t.cor} ${t.ready ? 55 : 30}%, transparent)`,
                      backgroundColor: `color-mix(in oklab, ${t.cor} ${t.ready ? 16 : 9}%, transparent)`,
                      color: t.cor,
                      opacity: t.ready ? 1 : 0.62,
                    }}
                  >
                    <Icon size={24} strokeWidth={1.8} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="pix flex-1 text-[17px]"
                        style={{ color: t.cor, opacity: t.ready ? 1 : 0.6 }}
                      >
                        {t.name}
                      </span>
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
                  </div>
                </div>
                {t.ready ? (
                  <span
                    className="pix mt-1 inline-flex h-10 w-fit items-center gap-2 rounded-pix border px-4 text-[13px]"
                    style={{
                      borderColor: `color-mix(in oklab, ${t.cor} 55%, transparent)`,
                      backgroundColor: `color-mix(in oklab, ${t.cor} 20%, transparent)`,
                      color: t.cor,
                    }}
                  >
                    abrir {t.name.toLowerCase()}
                    <IconChevronRight size={16} />
                  </span>
                ) : null}
              </>
            );
            return t.ready ? (
              <Link
                key={t.href}
                href={t.href}
                className="panel group flex flex-col gap-4 p-5 transition-all hover:brightness-115"
                style={{
                  borderColor: `color-mix(in oklab, ${t.cor} 30%, var(--color-line))`,
                  boxShadow: `0 0 44px -24px ${t.cor}`,
                }}
              >
                {body}
              </Link>
            ) : (
              <div
                key={t.href}
                /* `opacity` no card inteiro tambem apagava o VIDRO — sobre a
                   foto, o texto ficava ilegivel. Quem esmaece agora e so o
                   conteudo, pela cor; a superficie fica de pe. */
                className="panel flex flex-col gap-4 p-5"
              >
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= de onde vem o dado ================= */}
      <section className="panel flex flex-col gap-3 p-6">
        <h2 className="pix flex items-center gap-2 text-[13px] text-text-dim">
          <Sparkles size={16} />
          De onde vem o dado
        </h2>
        <p className="max-w-3xl text-[15px] leading-relaxed text-text-mute">
          Direto do catálogo público do próprio jogo — criaturas, itens e pontos do mapa —
          conferido por ETag a cada visita e recarregado no segundo em que o jogo publica um
          patch. Quando a fonte não responde, o site continua de pé com o último catálogo
          salvo e diz isso na tela, em vez de servir dado velho fingindo estar ao vivo.
        </p>
      </section>
    </div>
  );
}
