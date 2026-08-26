"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Pokeball, Sprite } from "@/components/ui";
import { arteRobo } from "@/lib/telas-robo";
import { SITE_URL } from "@/lib/site";
import { sair } from "@/lib/robo/acoes-auth";

/**
 * A navegacao do robo.
 *
 * Mesma gramatica da barra da dex — fixa no topo, rotulo em caixa alta, barra de
 * 2px acendendo na cor da area —, com tres diferencas que vem do lugar:
 *
 * 1. **A cor e uma so.** Na dex, cada ferramenta tem a sua, e a cor responde
 *    "onde estou". Aqui sao tres telas de um fluxo unico, e pintar cada uma de
 *    um matiz inventaria seis identidades pra um painel so.
 * 2. **Tem saida pra dex.** O robo mora noutro dominio; sem um link explicito, a
 *    unica forma de voltar seria digitar o endereco.
 * 3. **Muda com a sessao.** Deslogado, os tres links levariam todos pro mesmo
 *    login — uma barra de opcoes falsas. Deslogado ela mostra uma opcao so.
 */
const TELAS = [
  { href: "/painel", nome: "Painel" },
  { href: "/conectar", nome: "Conectar" },
  { href: "/assinatura", nome: "Assinatura" },
] as const;

const COR = "var(--color-t-robo)";

export function RoboNav({ nome }: { nome?: string | null }) {
  const path = usePathname();
  const logado = nome !== undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-bg/92 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_-1px_0_0_rgb(255_255_255/0.04)]">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-1 px-3 sm:px-5">
        <Link href={logado ? "/painel" : "/entrar"} className="group mr-3 flex shrink-0 items-center gap-2">
          {/* A marca do robo e o ROBO, e nao a pokebola da dex.
              Ela estava aqui por herança: a barra nasceu copiada da barra da
              dex, e a bola veio junto. Só que a bola é a marca do site inteiro
              — ela abre a dex, o painel e as ~910 fichas —, então usá-la aqui
              fazia a única tela que precisa se anunciar como OUTRO endereço
              (bot.piwdex.com.br) se anunciar com o símbolo do endereço de onde
              a pessoa acabou de sair. */}
          <Sprite
            src={arteRobo("robo")}
            alt=""
            size={28}
            priority
            className="shrink-0 [--sprite:26px] transition-transform duration-150 group-hover:rotate-6"
            fallback={
              <Pokeball size={26} className="text-[var(--color-t-robo)]" />
            }
          />
          {/* A marca ganha o sufixo do subdominio em vez de virar outro nome: e o
              mesmo produto, noutro endereco. */}
          <span className="pix text-[15px] normal-case text-text">
            PIW<span className="text-accent">dex</span>
            <span className="text-text-mute"> / robô</span>
          </span>
        </Link>

        {logado ? (
          <nav className="flex items-center">
            {TELAS.map((t) => {
              const on = path === t.href || path.startsWith(`${t.href}/`);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "pix group relative flex items-center px-2.5 py-2 text-[12px] transition-colors sm:px-3",
                    on ? "text-text" : "text-text-mute hover:text-text-dim",
                  )}
                >
                  <span style={on ? { color: COR } : undefined}>{t.nome}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-2 -bottom-px h-0.5 origin-center transition-transform duration-150 ease-out",
                      on ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50",
                    )}
                    style={{ backgroundColor: COR, boxShadow: on ? `0 0 10px 0 ${COR}` : undefined }}
                  />
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          {/* Link absoluto, e nao `<Link>`: a dex esta noutro dominio, e o
              roteador do Next nao atravessa origem. */}
          <a href={SITE_URL} className="tap pix text-[11px] text-text-mute transition-colors hover:text-accent">
            ← dex
          </a>
          {logado ? (
            <form action={sair}>
              <button
                type="submit"
                className="tap pix text-[11px] text-text-mute transition-colors hover:text-danger"
              >
                sair
              </button>
            </form>
          ) : (
            <Link href="/entrar" className="tap pix text-[11px] text-accent transition-colors hover:text-text">
              entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
