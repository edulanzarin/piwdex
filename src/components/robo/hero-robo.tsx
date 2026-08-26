import type { CSSProperties, ReactNode } from "react";
import { DisplayTitle, Eyebrow, Sprite } from "@/components/ui";
import { arteRobo, COR_ROBO, telaRobo } from "@/lib/telas-robo";

/**
 * A chegada de uma tela do robô, e o cabeçalho de uma aba do cockpit.
 *
 * São duas peças no mesmo arquivo porque são a mesma peça em dois pesos, e
 * separá-las garantiria que uma recebesse um ajuste e a outra não — foi
 * exatamente o que aconteceu com entrar/criar-conta antes de virarem um
 * componente só.
 *
 * ## Por que a área logada ganhou chegada
 *
 * A dex inteira abre com faixa, arte grande e uma frase; o robô abria com um
 * `<h1>` de 17px em cima de um formulário. Não era sobriedade de área de
 * trabalho — era a passada visual que nunca chegou aqui, e o efeito é o de
 * atravessar uma porta e cair nos fundos do prédio. Quem paga pelo robô chega
 * vindo da dex, e a diferença de tratamento entre a parte grátis e a parte paga
 * saía invertida.
 *
 * ## Os dois pesos
 *
 * `HeroRobo` é para tela que a pessoa ABRE — entrar, conectar, assinatura. Ela
 * tem espaço, e a chegada responde onde estou / o que isso faz.
 *
 * `CabecalhoAba` é para dentro do cockpit, que é tela de trabalho: a arte cai
 * pra 44px, some a sobrelinha e o título desce a corpo de seção. Repetir a faixa
 * inteira em seis abas empurraria o conteúdo vivo pra baixo da dobra seis vezes,
 * e a informação que interessa ali é a que muda sozinha, não a que apresenta.
 */
export function HeroRobo({
  tela,
  acoes,
}: {
  /** a rota, como está no registro (`/conectar`) */
  tela: string;
  acoes?: ReactNode;
}) {
  const t = telaRobo(tela);
  const Icone = t.Icone;

  return (
    <header
      className="panel relative overflow-hidden px-5 py-6 sm:px-8 sm:py-9"
      style={
        {
          "--tint": COR_ROBO,
          borderColor: `color-mix(in oklab, ${COR_ROBO} 22%, var(--color-line))`,
        } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(52% 120% at 12% 50%, color-mix(in oklab, ${COR_ROBO} 18%, transparent), transparent 72%)`,
        }}
      />

      <div className="flex flex-wrap items-center gap-5 sm:gap-8">
        <span className="anim-in shrink-0" style={{ "--d": "40ms" } as CSSProperties}>
          <Sprite
            src={arteRobo(t.arte)}
            alt=""
            size={104}
            priority
            className="[--sprite:76px] drop-shadow-[0_14px_28px_rgba(0,0,0,0.5)] sm:[--sprite:112px]"
            fallback={<Icone size={52} strokeWidth={1.5} style={{ color: COR_ROBO }} />}
          />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <span className="anim-in" style={{ "--d": "90ms" } as CSSProperties}>
            <Eyebrow tint={`color-mix(in oklab, ${COR_ROBO} 72%, white)`}>{t.chamada} robô</Eyebrow>
          </span>

          <span className="anim-in" style={{ "--d": "150ms" } as CSSProperties}>
            <DisplayTitle as="h1" size="md" tint={COR_ROBO}>
              {t.nome}
            </DisplayTitle>
          </span>

          <p
            className="anim-in max-w-2xl text-[14px] leading-relaxed text-text-dim sm:text-[15px]"
            style={{ "--d": "215ms" } as CSSProperties}
          >
            {t.linha}
          </p>
        </div>

        {acoes ? (
          <div
            className="anim-in flex shrink-0 items-center gap-3"
            style={{ "--d": "270ms" } as CSSProperties}
          >
            {acoes}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** O degrau abaixo: abre uma aba do cockpit sem roubar a dobra dela. */
export function CabecalhoAba({
  aba,
  acoes,
}: {
  /** a chave da aba, como está no registro (`cacada`) */
  aba: string;
  acoes?: ReactNode;
}) {
  const t = telaRobo(aba);
  const Icone = t.Icone;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line pb-3 sm:gap-4">
      <Sprite
        src={arteRobo(t.arte)}
        alt=""
        size={44}
        className="shrink-0 [--sprite:38px] sm:[--sprite:44px]"
        fallback={<Icone size={24} strokeWidth={1.5} style={{ color: COR_ROBO }} />}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="pix text-[13px]" style={{ color: COR_ROBO }}>
          {t.nome}
        </h2>
        <p className="text-[13px] leading-relaxed text-text-mute">{t.linha}</p>
      </div>
      {acoes ? <div className="flex shrink-0 items-center gap-2">{acoes}</div> : null}
    </div>
  );
}
