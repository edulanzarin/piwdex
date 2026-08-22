import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { T } from "@/components/locale-provider";
import { ChevronRight, Robot } from "@/components/icons";
import { BotShot } from "@/components/bot-shot";

export const metadata: Metadata = {
  title: "O BOT",
  description:
    "O robô joga Poke Idle World por você: auto-hunt que escolhe o spot, plano de leveling, reposição e venda automáticas — e continua farmando com o jogo fechado.",
};

// Pagina PUBLICA de venda do bot. Separada do cockpit de proposito:
//   /bot      -> explica (esta pagina; quem nao assina cai aqui pelo menu e pelo CTA)
//   /bot-app  -> opera (cockpit; sem assinatura, mostra o checkout)
// Antes o menu jogava o visitante direto no paywall — preco sem argumento. Agora o
// caminho e ver o que a ferramenta faz, com print de tela real, e so depois o preco.

// Um recurso: icone-menos, frase-mais. O que vende e o VERBO, nao o adjetivo.
const FEATURES = ["refill", "sell", "revive", "offline", "sniper", "stats"] as const;
const MODES = ["auto", "level", "manual"] as const;

export default async function BotPage() {
  const session = await auth();
  // Assinante que cai aqui nao ve "assinar" — ve a porta do cockpit.
  const isVip = !!session?.user?.vip;
  const ctaHref = isVip ? "/bot-app" : "/bot-app#assinar";

  return (
    <div className="container-page flex flex-col gap-12 pb-14 pt-6 sm:gap-16">
      {/* ---- HERO ---------------------------------------------------------- */}
      <header className="flex flex-col items-center gap-5 text-center">
        <span
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1 pixel text-sm text-yellow"
          style={{
            borderColor: "color-mix(in srgb, var(--yellow) 45%, transparent)",
            background: "color-mix(in srgb, var(--yellow) 10%, transparent)",
          }}
        >
          <Robot size={14} /> <T k="botpage.eyebrow" />
        </span>
        <h1 className="pixel text-3xl leading-tight text-text [overflow-wrap:anywhere] sm:text-5xl">
          <T k="botpage.title" />
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-text-dim sm:text-lg">
          <T k="botpage.sub" />
        </p>
        <div className="flex flex-col items-center gap-2">
          <Link href={ctaHref} className="btn btn-yellow">
            <T k={isVip ? "botpage.ctaVip" : "botpage.cta"} /> <ChevronRight size={14} />
          </Link>
          <span className="text-sm text-text-dim"><T k="botpage.ctaNote" /></span>
        </div>
      </header>

      {/* ---- PRINT 1: o painel --------------------------------------------- */}
      <BotShot
        src="/images/painel.png"
        width={1600}
        height={887}
        altKey="botpage.shot1.alt"
        captionKey="botpage.shot1.caption"
        priority
      />

      {/* ---- OS TRES MODOS -------------------------------------------------- */}
      <section className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="pixel text-2xl text-cyan sm:text-3xl"><T k="botpage.modes.title" /></h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-text-dim"><T k="botpage.modes.sub" /></p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {MODES.map((m) => (
            <div key={m} className="card flex flex-col gap-2 p-5">
              <h3 className="pixel text-lg text-yellow"><T k={`botpage.mode.${m}.title`} /></h3>
              <p className="text-base leading-relaxed text-text-dim"><T k={`botpage.mode.${m}.desc`} /></p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- PRINT 2: a aba Hunt -------------------------------------------- */}
      <BotShot
        src="/images/hunt.png"
        width={1600}
        height={901}
        altKey="botpage.shot2.alt"
        captionKey="botpage.shot2.caption"
      />

      {/* ---- O QUE ELE FAZ SOZINHO ------------------------------------------ */}
      <section className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="pixel text-2xl text-green sm:text-3xl"><T k="botpage.feat.title" /></h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-text-dim"><T k="botpage.feat.sub" /></p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f} className="card flex flex-col gap-2 p-5">
              <h3 className="pixel text-base text-text"><T k={`botpage.feat.${f}.title`} /></h3>
              <p className="text-base leading-relaxed text-text-dim"><T k={`botpage.feat.${f}.desc`} /></p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- FECHAMENTO ------------------------------------------------------ */}
      <section
        className="card flex flex-col items-center gap-4 p-6 text-center sm:p-8"
        style={{
          borderColor: "color-mix(in srgb, var(--yellow) 45%, transparent)",
          background: "color-mix(in srgb, var(--yellow) 7%, var(--surface))",
        }}
      >
        <h2 className="pixel text-2xl text-yellow sm:text-3xl"><T k="botpage.final.title" /></h2>
        <p className="max-w-xl text-base leading-relaxed text-text-dim"><T k="botpage.final.desc" /></p>
        <Link href={ctaHref} className="btn btn-yellow">
          <T k={isVip ? "botpage.ctaVip" : "botpage.cta"} /> <ChevronRight size={14} />
        </Link>
      </section>

      <p className="text-center text-sm text-text-dim"><T k="botpage.disclaimer" /></p>
    </div>
  );
}
