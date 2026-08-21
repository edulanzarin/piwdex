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
    icon: IconGem,
    cor: "var(--color-t-dex)",
    ready: true,
  },
  {
    href: "/itens",
    name: "Itens",
    desc: "Catálogo de itens com o índice reverso: quem dropa cada um, e com que chance real.",
    icon: IconBag,
    cor: "var(--color-t-itens)",
    ready: false,
  },
  {
    href: "/calc",
    name: "Calculadora",
    desc: "IV, Quality e Poder pela fórmula do jogo. Projeta os stats em qualquer nível.",
    icon: IconScale,
    cor: "var(--color-t-calc)",
    ready: false,
  },
  {
    href: "/hunt",
    name: "Hunt",
    desc: "Rota de caça por XP, ouro e efetividade — usando o melhor golpe CONTRA o alvo.",
    icon: IconPin,
    cor: "var(--color-t-hunt)",
    ready: false,
  },
  {
    href: "/breed",
    name: "Breeding",
    desc: "Simula o ovo, projeta os stats do filho e planeja quantos breeds até a Quality alvo.",
    icon: IconTm,
    cor: "var(--color-t-breed)",
    ready: false,
  },
  {
    href: "/meta",
    name: "Meta",
    desc: "Quem bate em quem: cobertura de tipo, fraquezas cruzadas e montagem de time.",
    icon: IconTarget,
    cor: "var(--color-t-meta)",
    ready: false,
  },
];

export default async function HomePage() {
  const { entries, counts, catalog } = await getDexPayload();
  const total = entries.length;

  const numeros = [
    { label: "pokémons", value: total, cor: "var(--color-t-dex)" },
    { label: "itens", value: counts.items, cor: "var(--color-t-itens)" },
    { label: "drops mapeados", value: counts.drops, cor: "var(--color-t-breed)" },
    { label: "locais de caça", value: counts.hunts, cor: "var(--color-t-hunt)" },
  ];

  return (
    <div className="flex flex-col gap-10 py-6">
      {/* ================= topo ================= */}
      {/* O heroi tem vidro proprio. A regra do fundo com foto e simples e nao
          tem excecao: **texto nunca encosta na imagem** — a arte tem luminancia
          media 148 e varia de nuvem clara a folhagem escura na mesma linha, e
          nenhum scrim uniforme resolve isso sem apagar a foto. O vidro resolve
          os dois: o texto ganha piso constante e a arte continua visivel em
          volta e ATRAVES dele. */}
      <section className="panel flex flex-col items-center gap-7 px-6 py-12 text-center sm:px-10">
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
              <dd className="text-[30px] leading-none font-bold" style={{ color: n.cor }}>
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
                <div className="flex items-start gap-4">
                  {/* Icone e titulo carregam a cor da FERRAMENTA. E o que faz a
                      home parar de ser seis caixas cinza iguais, e o que depois
                      deixa reconhecer a tela pela cor antes de ler o titulo. */}
                  <span
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-pix-lg border"
                    style={{
                      borderColor: `color-mix(in oklab, ${t.cor} ${t.ready ? 55 : 30}%, transparent)`,
                      backgroundColor: `color-mix(in oklab, ${t.cor} ${t.ready ? 16 : 9}%, transparent)`,
                      color: t.cor,
                      opacity: t.ready ? 1 : 0.62,
                    }}
                  >
                    <Icon size={26} />
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
                    <IconChevronRight size={11} />
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
