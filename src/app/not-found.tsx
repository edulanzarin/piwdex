import Link from "next/link";
import { BookOpen, Calculator, Disc3, Egg, Package, Radar, Shield, Sparkles, Swords } from "lucide-react";
import { ButtonLink, IconChevronRight, Pokeball, Sprite } from "@/components/ui";
import { CascaSite } from "@/components/casca-site";
import { arteUrl, iconeUrl } from "@/lib/ferramentas";

/**
 * O 404.
 *
 * Ele cobre duas coisas de uma vez: o `notFound()` de `dex/[id]` e de
 * `itens/[id]` — que ate agora caia no `_not-found` gerado pelo Next e respondia
 * "This page could not be found" em ingles, fundo branco, fora do site — e
 * qualquer endereco que nao bate com rota nenhuma.
 *
 * O 404 do jogo tem uma causa DOMINANTE: link antigo pra um id que saiu do
 * catalogo, ou id digitado na mao. Entao a tela nao para em "nao achei" — ela
 * manda pras seis ferramentas, que e onde a pessoa reencontra o que procurava
 * pelo nome em vez de pelo numero.
 *
 * Sem `export const metadata`: `metadata` so e contrato em `global-not-found`, e
 * o `noindex` de pagina 404 o proprio Next injeta. O titulo da aba fica o padrao
 * do layout, que continua sendo verdade aqui.
 *
 * Ele veste a `CascaSite` por conta propria porque vive FORA do grupo `(site)`:
 * 404 precisa pegar endereco que nao casa com rota nenhuma, e isso so acontece
 * na raiz. Sem a casca ele apareceria sem navegacao nem rodape — justo a pagina
 * cujo unico trabalho e devolver a pessoa pro site.
 */

/**
 * A lista e uma COPIA curta da home, de proposito.
 *
 * O `TOOLS` de `page.tsx` mora dentro de um modulo de rota que faz
 * `getDexPayload()` no topo — importar de la pra ca arrastaria a leitura do
 * catalogo pra dentro da tela de erro, que e exatamente o tipo de dependencia
 * que uma pagina de socorro nao pode ter. Aqui so o que o card precisa: rota,
 * nome, arte e cor.
 */
const FERRAMENTAS = [
  {
    href: "/dex",
    nome: "Pokédex",
    desc: "todas as espécies, com filtro",
    icon: BookOpen,
    arte: "pokedex",
    cor: "var(--color-t-dex)",
  },
  {
    href: "/itens",
    nome: "Itens",
    desc: "quem dropa cada item",
    icon: Package,
    arte: "itens",
    cor: "var(--color-t-itens)",
  },
  {
    href: "/calc",
    nome: "Calculadora",
    desc: "IV, quality e poder",
    icon: Calculator,
    arte: "calculadora",
    cor: "var(--color-t-calc)",
  },
  {
    href: "/hunt",
    nome: "Hunt",
    desc: "XP/h, ouro/h e risco",
    icon: Radar,
    arte: "hunt",
    cor: "var(--color-t-hunt)",
  },
  {
    href: "/breed",
    nome: "Breeding",
    desc: "par, herança e quality",
    icon: Egg,
    arte: "breeding",
    cor: "var(--color-t-breed)",
  },
  {
    href: "/meta",
    nome: "Meta",
    desc: "tier list e duelo",
    icon: Swords,
    arte: "meta",
    cor: "var(--color-t-meta)",
  },
  {
    href: "/stadium",
    nome: "Stadium",
    desc: "seu time contra um boss",
    icon: Shield,
    arte: "stadium",
    cor: "var(--color-t-stadium)",
  },
  {
    href: "/eevee",
    nome: "Eevee",
    desc: "a pedra de cada evolução",
    icon: Sparkles,
    arte: "eevee",
    cor: "var(--color-t-eevee)",
  },
  {
    href: "/tm",
    nome: "TM",
    desc: "qual disco, e em quem",
    icon: Disc3,
    arte: "tm",
    cor: "var(--color-t-tm)",
  },
];

export default function NaoEncontrado() {
  return (
    <CascaSite>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 py-10">
        {/* `.on-art` porque aqui tambem nao ha painel: o texto encosta no
            wallpaper, e a sombra e o que segura a letra na parte clara da cena. */}
        <section className="on-art flex flex-col items-center gap-4 text-center">
          {/* Arte propria do 404: a pokebola RACHADA (scripts/pixel-icons/arte.py).
              A pokebola inteira e a marca do site e aparece no topo de toda pagina
              — repetir ela aqui nao diz nada. A quebrada diz. */}
          <Sprite
            src={iconeUrl("quebrada")}
            alt=""
            size={112}
            priority
            className="[--sprite:88px] sm:[--sprite:112px]"
            fallback={<Pokeball size={72} className="text-[var(--color-t-dex)]" />}
          />
          <p className="pix text-[56px] leading-none text-text-mute">404</p>
          <h1 className="pix text-[24px] text-text">Essa página não existe</h1>
          <p className="max-w-xl text-[16px] leading-relaxed text-text-dim">
            O endereço não bate com nada do PIWdex. Se você veio de um link para um
            pokémon ou item, é provável que o número não exista no catálogo do jogo — ou
            que ele tenha saído de lá.
          </p>
          <ButtonLink
            href="/"
            variant="primary"
            size="lg"
            iconRight={<IconChevronRight size={16} />}
            className="mt-1"
          >
            voltar pro início
          </ButtonLink>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="pix text-[13px] text-text-dim">Ou vá direto pra uma ferramenta</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FERRAMENTAS.map((f) => {
              const Icon = f.icon;
              return (
                <Link
                  key={f.href}
                  href={f.href}
                  className="panel-card group flex items-center gap-3 p-3 transition-all hover:brightness-110"
                  style={{ borderColor: `color-mix(in oklab, ${f.cor} 38%, var(--color-line))` }}
                >
                  {/* Mesma arte da home. O `fallback` e o icone de linha, e nao a
                      pokebola padrao do `Sprite`: uma pokebola no lugar do icone de
                      Itens diria que faltou um pokemon, que nao e o caso. */}
                  <Sprite
                    src={arteUrl(f.arte)}
                    alt=""
                    size={52}
                    className="shrink-0 transition-transform duration-300 group-hover:scale-105"
                    fallback={<Icon size={22} strokeWidth={1.8} style={{ color: f.cor }} />}
                  />
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="pix text-[14px] leading-none" style={{ color: f.cor }}>
                      {f.nome}
                    </span>
                    <span className="text-[13px] leading-snug text-text-mute">{f.desc}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </CascaSite>
  );
}
