import Link from "next/link";
import { getDexPayload } from "@/lib/dex-data";
import { Chip, IconChevronRight, IconPin, Pokeball } from "@/components/ui";
import { IconBag, IconGem, IconScale, IconTarget, IconTm, IconXp } from "@/components/game-icons";

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

const TOOLS = [
  {
    href: "/dex",
    name: "Pokédex",
    desc:
      "As 434 espécies com filtro por tipo, raridade, origem, estágio, fraqueza e " +
      "faixa de nível, valor, XP, stats e poder de golpe.",
    icon: IconGem,
    ready: true,
  },
  {
    href: "/itens",
    name: "Itens",
    desc: "Catálogo de itens com o índice reverso: quem dropa cada um, e com que chance real.",
    icon: IconBag,
    ready: false,
  },
  {
    href: "/calc",
    name: "Calculadora",
    desc: "IV, Quality e Poder pela fórmula do jogo. Projeta os stats em qualquer nível.",
    icon: IconScale,
    ready: false,
  },
  {
    href: "/hunt",
    name: "Hunt",
    desc: "Rota de caça por XP, ouro e efetividade — usando o melhor golpe CONTRA o alvo.",
    icon: IconPin,
    ready: false,
  },
  {
    href: "/breed",
    name: "Breeding",
    desc: "Simula o ovo, projeta os stats do filho e planeja quantos breeds até a Quality alvo.",
    icon: IconTm,
    ready: false,
  },
  {
    href: "/meta",
    name: "Meta",
    desc: "Quem bate em quem: cobertura de tipo, fraquezas cruzadas e montagem de time.",
    icon: IconTarget,
    ready: false,
  },
];

export default async function HomePage() {
  const { entries, counts, catalog } = await getDexPayload();
  const playable = entries.filter((e) => !e.variant).length;

  const numeros = [
    { label: "espécies", value: playable },
    { label: "itens", value: counts.items },
    { label: "locais de caça", value: counts.hunts },
    { label: "registros de drop", value: counts.drops },
  ];

  return (
    <div className="flex flex-col gap-10 py-6">
      {/* ================= topo ================= */}
      <section className="flex flex-col items-center gap-7 text-center">
        <div className="flex items-center gap-4">
          <Pokeball size={56} className="text-accent" />
          <div className="text-left">
            <h1 className="pix text-[38px] leading-none text-text sm:text-[48px]">
              piw<span className="text-accent">dex</span>
            </h1>
            <p className="pix mt-2 text-[12px] text-text-mute">
              dex e ferramentas de poke idle world
            </p>
          </div>
        </div>

        <p className="max-w-2xl text-[17px] leading-relaxed text-text-dim">
          O catálogo inteiro do jogo, lido direto da fonte e pesquisável de verdade: filtre
          por tipo, raridade, estágio, fraqueza, item que dropa e por faixa de nível, valor,
          XP, stats e poder de golpe — tudo ao mesmo tempo.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dex"
            className="pix inline-flex h-12 items-center gap-3 rounded-pix border border-accent/60
                       bg-accent/20 px-7 text-[14px] text-accent transition-colors
                       hover:border-accent hover:bg-accent/30"
          >
            abrir a pokédex
            <IconChevronRight size={10} />
          </Link>
          {/* Frescor do catalogo e ESTADO, nao rodape: num patch de balanceamento
              a dex ao vivo e a de snapshot dao respostas diferentes. */}
          <Chip
            tone={catalog.live ? "ok" : "warn"}
            className="h-8 px-3 text-[11px]"
            title={
              catalog.live
                ? `Catálogo do jogo, publicado em ${catalog.generatedAt}`
                : `Fonte indisponível (${catalog.error ?? "motivo desconhecido"})`
            }
          >
            {catalog.live ? "catálogo ao vivo" : "catálogo salvo"}
          </Chip>
        </div>
      </section>

      {/* ================= os numeros do catalogo AGORA ================= */}
      <section>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {numeros.map((n) => (
            <div
              key={n.label}
              className="panel flex flex-col items-center gap-2 px-4 py-5 text-center"
            >
              <dd className="text-[30px] leading-none font-bold text-text">
                {n.value.toLocaleString("pt-BR")}
              </dd>
              <dt className="pix text-[11px] text-text-mute">{n.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* ================= ferramentas ================= */}
      <section className="flex flex-col gap-4">
        <h2 className="pix text-[14px] text-text-dim">Ferramentas</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const body = (
              <>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      t.ready
                        ? "grid h-10 w-10 shrink-0 place-items-center rounded-pix border border-accent/45 bg-accent/12 text-accent"
                        : "grid h-10 w-10 shrink-0 place-items-center rounded-pix border border-line bg-surface-2 text-text-mute"
                    }
                  >
                    <Icon size={18} />
                  </span>
                  <span className="pix flex-1 text-[15px] text-text">{t.name}</span>
                  {t.ready ? (
                    <IconChevronRight size={12} className="text-accent" />
                  ) : (
                    <Chip size="sm">em breve</Chip>
                  )}
                </div>
                <p className="text-[15px] leading-relaxed text-text-mute">{t.desc}</p>
              </>
            );
            return t.ready ? (
              <Link
                key={t.href}
                href={t.href}
                className="panel group flex flex-col gap-3 p-5 transition-all
                           hover:border-accent/55 hover:shadow-[0_0_30px_-14px_var(--color-accent)]"
              >
                {body}
              </Link>
            ) : (
              <div key={t.href} className="panel flex flex-col gap-3 p-5 opacity-50">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= de onde vem o dado ================= */}
      <section className="panel flex flex-col gap-3 p-6">
        <h2 className="pix flex items-center gap-2 text-[13px] text-text-dim">
          <IconXp size={12} />
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
