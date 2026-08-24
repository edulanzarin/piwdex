import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ItemEntry } from "@/lib/items";
import { killsPerUnit } from "@/lib/items";
import { RARITY_COLOR } from "@/lib/typing";
import { assetIconUrl, spriteUrl } from "@/lib/sprites";
import { IconCoin, Pokeball, Sprite, Tooltip } from "@/components/ui";
import { ITEM_CATEGORY_ART, IconLevel, IconLoot, IconShop, ItemCategoryIcon } from "@/components/game-icons";
import { ITEM_CATEGORY_LABEL, ITEM_ORIGIN_LABEL, RARITY_LABEL, compact, num} from "@/lib/labels";

/**
 * A cor do card.
 *
 * Sai da FAIXA (`e.tier`), que e a mesma escada de seis degraus da dex — ver
 * `itemTier`. Item sem faixa publicada fica no cinza de texto apagado, e isso e
 * a resposta certa: sem chance no catalogo nao ha degrau, e pintar de uma cor
 * qualquer inventaria um que a fonte nao da.
 */
const tintOf = (e: ItemEntry): string =>
  e.tier ? RARITY_COLOR[e.tier] : "var(--color-text-mute)";

/**
 * Card de item.
 *
 * O que ele responde sem clique: o que e o item, quanto o Mark paga, **de onde
 * vem** e quao dificil e tirar um. As duas ultimas sao a razao da pagina
 * existir — o catalogo do jogo diz "o Bulbasaur dropa Bulb" e nunca o
 * contrario, entao "quem dropa isso?" nao tem resposta em lugar nenhum.
 *
 * A linha de baixo e sempre a MESMA pergunta ("de onde vem"), respondida no
 * nivel que o dado permite: a melhor fonte farmavel com nome e nivel; ou o
 * aviso de que so cai de quem nao se caca; ou a origem (loja/exclusivo).
 */

/**
 * Chance formatada.
 *
 * Duas armadilhas do dado real, e as duas viram regra aqui:
 *
 * 1. **Chance minuscula nao pode virar "0%".** 44 linhas do catalogo caem
 *    abaixo de 0,01% — o Corsola dropa Air Tank a 0,00001%. Arredondar isso
 *    pra zero AFIRMA que nao cai, que e falso, e apaga justamente o numero que
 *    so o piwdex mostra. Por isso as casas crescem conforme o valor encolhe, e
 *    abaixo da resolucao a resposta e "<0,0001%", nunca "0%".
 * 2. **Zero LITERAL fica zero.** 346 linhas (todas de Strange Pheromone) vem
 *    com `chance: 0` na fonte. Isso e o que o catalogo diz, entao e o que a
 *    tela mostra — quem explica o caso e a ficha do item, nao um numero
 *    inventado aqui.
 */
export function pctText(p: number): string {
  if (p <= 0) return "0%";
  if (p < 0.0001) return "<0,0001%";
  const s = p < 0.01 ? num(p, 4) : p < 1 ? num(p, 3) : num(p, 2);
  return `${s.replace(".", ",").replace(/,?0+$/, "")}%`;
}

/**
 * "1 a cada N abates" — a chance traduzida pro gesto de quem farma.
 *
 * O topo da escala precisa de tres frases, nao de duas: 100% e "todo abate",
 * 95% arredonda pra um abate mas NAO e todo abate, e o resto e a contagem. Com
 * duas frases so, ou 95% vira a promessa falsa de "todo abate", ou vira o
 * "1 a cada 1 abates" que nao e portugues.
 */
export function killsText(e: ItemEntry): string | null {
  const s = e.bestFarm ?? e.best;
  if (!s) return null;
  const n = killsPerUnit(s);
  if (!Number.isFinite(n)) return null;
  if (s.chancePct >= 100) return "cai em todo abate";
  const r = Math.max(1, Math.round(n));
  return r === 1
    ? "cai em quase todo abate"
    : `1 a cada ${r.toLocaleString("pt-BR")} abates`;
}

/** A linha "de onde vem", no melhor nivel de detalhe que o dado permite. */
function Origem({ e }: { e: ItemEntry }) {
  if (e.bestFarm) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Sprite src={spriteUrl(e.bestFarm.id)} alt={e.bestFarm.name} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-text-dim">{e.bestFarm.name}</span>
          <span className="pix text-[11px] text-text-mute">
            nv {e.bestFarm.level || "—"} · {pctText(e.bestFarm.chancePct)}
          </span>
        </span>
      </span>
    );
  }
  if (e.best) {
    // Cai de alguem, mas de ninguem que apareca no mapa: farmar isso e esperar
    // a evolucao ou o cassino, nao escolher uma cacada.
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Sprite src={spriteUrl(e.best.id)} alt={e.best.name} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-text-mute">{e.best.name}</span>
          <span className="pix text-[11px] text-warn">sem ponto no mapa</span>
        </span>
      </span>
    );
  }
  // Sem fonte nenhuma, o rodape diz o CAMINHO, e nao a palavra da origem.
  //
  // Ele dizia "Exclusivo" / "Loja" — as mesmas palavras que o epiteto acima do
  // nome passou a carregar quando o item nao tem faixa. Duas vezes a mesma
  // palavra no mesmo card, a 60px de distancia, e o rodape gastava a linha dele
  // sem acrescentar nada. Agora ele responde a pergunta seguinte: se nao cai de
  // ninguem, de onde vem entao.
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-text-mute">
      {e.origin === "shop" ? <IconShop size={15} /> : <IconLoot size={15} />}
      {e.origin === "shop"
        ? `compra por ${compact(e.goldPrice)} de ouro`
        : "altar, clã, evento ou shiny"}
    </span>
  );
}

export function ItemCard({
  e,
  index = 0,
  priority,
}: {
  e: ItemEntry;
  /** posicao no grid — vira o atraso da entrada em cascata */
  index?: number;
  priority?: boolean;
}) {
  const kills = killsText(e);
  const tint = tintOf(e);

  return (
    <Link
      href={`/itens/${e.id}`}
      style={{ ["--i" as string]: index, ["--tint" as string]: tint }}
      className={cn(
        // Mesma silhueta do card de especie: painel de arte, placa, dado. Os dois
        // vivem em grades irmas e sao lidos na mesma sessao — forma diferente pra
        // funcao igual faz a segunda grade parecer outro site.
        "panel-card anim-enter group relative flex flex-col overflow-hidden",
        "transition-[border-color,box-shadow,transform] duration-200",
        // A borda de hover sai da FAIXA, e nao mais da cor da ferramenta. Sessenta
        // cards acendendo todos no mesmo verde diziam so "isto e a tela de itens",
        // que a pessoa ja sabe; acendendo na cor do degrau, o hover repete a
        // informacao que o card inteiro esta dando. E o mesmo gesto do card da dex.
        "hover:-translate-y-0.5 hover:border-[color:var(--tint)]",
        "hover:shadow-elev-3 focus-visible:border-[color:var(--tint)]",
      )}
    >
      {/* ---- o painel de ARTE ----
          A categoria e o selo de raro flutuam nos cantos dele. A linha de
          cabecalho que existia antes gastava 28px de altura em cada um dos 48
          cards da tela pra dizer duas coisas que cabem no canto de uma area que
          ja existe. */}
      <div className="relative grid aspect-[5/4] w-full place-items-center overflow-hidden bg-bg-soft">
        <span
          aria-hidden="true"
          /* Caixa FIXA no tamanho MAIOR, e so `transform` anima. Animar h/w num
             elemento com `blur-2xl` rasteriza o desfoque a cada quadro, e sao ate
             48 destes na tela. */
          className="absolute h-24 w-24 origin-center scale-[0.833] rounded-full blur-2xl transition-transform duration-300 ease-out group-hover:scale-100"
          style={{ backgroundColor: tint, opacity: 0.18 }}
        />
        <Sprite
          src={assetIconUrl(e.icon)}
          alt={e.name}
          size={72}
          priority={priority}
          /* Aqui a reserva tem TAMANHO DE FIGURA (o slot e de 72px), entao ela
             pode ser arte pixel de verdade em vez de um glifo de linha de 30px
             perdido no meio da caixa. Nos slots miudos deste mesmo arquivo (14,
             15, 16px) o lucide continua, que e onde ele ganha. */
          fallback={
            <Sprite
              src={ITEM_CATEGORY_ART[e.category]}
              alt=""
              size={56}
              fallback={<ItemCategoryIcon category={e.category} size={30} />}
            />
          }
          className="relative transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-110"
        />

        {/* A CATEGORIA, so a palavra — o icone dela subiu pro medalhao da costura,
            logo abaixo, e ter os dois seria o mesmo fato duas vezes a 40px de
            distancia.
            A palavra fica, e aqui a regra se separa da dex de proposito: la o
            disco de tipo dispensa texto porque tipo de pokemon e canone do jogo,
            e quem chega ja sabe o que e o disco roxo. Categoria de item e
            taxonomia DESTE site — ninguem chega sabendo qual glifo e "Clã".

            O SELO DE RARO saiu deste canto.
            Ele lia o booleano `rare` do jogo, que esta ligado em 206 dos 428
            itens e nao concorda com dificuldade nenhuma: 31 dos 85 itens mais
            faceis do catalogo o carregavam. Ao lado da faixa derivada ele viraria
            uma segunda resposta pra mesma pergunta, e a errada. O fato continua
            existindo — ele so voltou pro lugar onde e um fato e nao um veredito,
            que e a ficha. */}
        <span className="pix absolute top-2 left-2.5 text-[10px] text-text-mute">
          {ITEM_CATEGORY_LABEL[e.category]}
        </span>
      </div>

      {/* ---- a PLACA, no arranjo do card da dex ----

          Superficie propria e fio em cima, solida e nao flutuando sobre a arte:
          nome sobre icone some sempre que o icone tem area clara ali.

          O que ela ganhou nesta passada e o que a fazia parecer de outro site: o
          MEDALHAO montado na costura e o EPITETO acima do nome. Sao as duas
          pecas que o card de especie ja tinha, e sem elas a placa do item era um
          retangulo com uma linha de texto — arte e placa viravam dois blocos
          empilhados que por acaso tem a mesma largura, em vez de uma peca so. */}
      <div className="relative flex flex-col items-center gap-1 border-t border-line bg-surface-2/70 px-3.5 pt-6 pb-3.5 text-center transition-colors duration-200 group-hover:bg-surface-3/70">
        {/* O MEDALHAO carrega a CATEGORIA, que e o que se procura primeiro depois
            do nome — o mesmo papel que o disco de tipo faz no card de especie.
            O anel dele sai da FAIXA: um acento por card, e dois fatos em dois
            canais (o glifo diz o que e, o anel diz quao raro). Pintar a categoria
            de uma cor propria seria inventar cor de dado onde a fonte nao tem
            nenhuma. */}
        <span
          aria-hidden="true"
          className="absolute -top-5 left-1/2 flex -translate-x-1/2 items-center"
        >
          <span
            className={cn(
              "grid h-10 w-10 place-items-center rounded-pill border-2 bg-surface shadow-elev-2",
              "transition-transform duration-300 ease-out motion-safe:group-hover:scale-110",
            )}
            style={{ borderColor: tint, color: tint }}
            title={ITEM_CATEGORY_LABEL[e.category]}
          >
            <ItemCategoryIcon category={e.category} size={20} />
          </span>
        </span>

        {/* O EPITETO: a faixa dita acima do nome, na cor dela.
            Item sem faixa nao fica com a linha vazia nem herda um degrau que a
            fonte nao deu — ele diz de ONDE vem, que e o que se sabe dele. A
            altura da linha nao muda, entao a grade nao desalinha. */}
        <span className="pix text-[9px] tracking-[0.18em]" style={{ color: tint }}>
          {e.tier ? RARITY_LABEL[e.tier] : ITEM_ORIGIN_LABEL[e.origin]}
        </span>
        <h3
          className="w-full truncate text-[16px] leading-tight font-bold text-text transition-colors group-hover:text-[color:var(--tint)]"
          title={e.name}
        >
          {e.name}
        </h3>
      </div>

      {/* ---- os numeros ----

          DOIS, e nao tres como na dex. Tentei tres pra espelhar o card de
          especie e o card reprovou na largura: no `xl` a coluna do grid da ~218px
          ao card, e "OURO/ABATE" em pix nao cabe num terco disso — os tres
          rotulos se atropelavam. Espelhar a dex vale ate onde o DADO deixa, e o
          vocabulario dos itens nao tem tres palavras de cinco letras.

          Ouro por abate nao foi cortado: ele desceu pro rodape, onde tem a linha
          inteira. Ver ali embaixo. */}
      <dl className="grid grid-cols-2 gap-2 px-3.5 pt-3 text-center">
        <div className="flex flex-col gap-1">
          {/* O rotulo muda com a GRANDEZA: "Ouro" e o preco de loja, "NPC" e o
              que o Mark paga por unidade. Sao eixos diferentes, e o mesmo rotulo
              pros dois faz o card se contradizer entre itens. */}
          <dt className="pix flex items-center justify-center gap-1 text-[11px] text-text-mute">
            <IconCoin size={15} />
            {e.goldPrice > 0 ? "Ouro" : "NPC"}
          </dt>
          <dd
            className={cn(
              "num text-[20px] leading-none font-bold",
              e.goldPrice > 0 ? "text-neon" : e.npcPrice > 0 ? "text-warn" : "text-text-mute",
            )}
          >
            {e.goldPrice > 0 ? compact(e.goldPrice) : e.npcPrice > 0 ? compact(e.npcPrice) : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-l border-line">
          {/* CONTAGEM de espécies, não porcentagem. O ícone de % que estava aqui
              fazia o card afirmar outra coisa — "14%" em vez de "14 pokémons
              dropam" — e o rótulo "fontes" sozinho não desfazia a leitura. O
              símbolo tem de concordar com a grandeza, senão ele manda mais que
              o texto. */}
          <dt className="pix flex items-center justify-center gap-1 text-[11px] text-text-mute">
            <Pokeball size={13} className="text-text-mute" />
            Dropam
          </dt>
          <dd className="num text-[20px] leading-none font-bold text-text">
            {e.sources || "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-col gap-2 border-t border-line px-3.5 pt-3 pb-3">
        <Origem e={e} />
        {/* O CUSTO e o RENDIMENTO na mesma linha, e e de proposito que sejam
            vizinhos: "1 a cada 12 abates" sozinho e so trabalho, e o que decide
            parar pra pegar e o par — quantos abates custa e quanto cada abate
            paga por causa dele. Era a unica resposta da tela que so existia na
            tabela, entao quem ficava no modo grade nunca a via.
            `justify-between` e nao um separador: a segunda metade some quando o
            item nao se farma, e um "·" orfao ficaria pendurado. */}
        {kills || e.goldPerKill > 0 ? (
          <span className="pix flex items-baseline justify-between gap-2 text-[11px]">
            <span className="min-w-0 truncate text-text-mute">{kills}</span>
            {e.goldPerKill > 0 ? (
              <span className="shrink-0 text-warn tabular">
                +{compact(Math.round(e.goldPerKill))} ouro/abate
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * Linha da tabela — o mesmo dado, mas COMPARAVEL.
 *
 * Aqui aparece a coluna que o card nao tem espaco pra abrir: ouro por abate. E
 * o numero que decide se vale parar pra pegar o item, e ele so faz sentido lado
 * a lado com os outros.
 */
export function ItemRow({ e }: { e: ItemEntry }) {
  return (
    <tr
      style={{ ["--tint" as string]: tintOf(e) }}
      className="group border-b border-line transition-colors last:border-0 hover:bg-surface-2/70"
    >
      <td className="px-3 py-2">
        <Link href={`/itens/${e.id}`} className="flex items-center gap-2">
          <Sprite
            src={assetIconUrl(e.icon)}
            alt={e.name}
            size={32}
            fallback={<ItemCategoryIcon category={e.category} size={16} />}
          />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium text-text group-hover:text-[color:var(--tint)]">
              {e.name}
            </span>
          </span>
        </Link>
      </td>
      {/* A coluna de RARIDADE, na mesma forma da linha da dex: a palavra do
          degrau, na cor dele. Ela toma o lugar do selo de raro que ficava colado
          embaixo do nome — selo nao ordena, e numa tabela a pergunta e sempre
          "mais que quem". */}
      <td className="px-3 py-2">
        {e.tier ? (
          <span className="pix text-[11px]" style={{ color: RARITY_COLOR[e.tier] }}>
            {RARITY_LABEL[e.tier]}
          </span>
        ) : (
          <Tooltip content="O catálogo não publica chance pra este item — sem chance não há faixa, e cravar uma seria inventar o degrau.">
            <span className="pix text-[11px] text-text-mute">—</span>
          </Tooltip>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="pix flex items-center gap-1.5 text-[11px] text-text-dim">
          <ItemCategoryIcon category={e.category} size={14} />
          {ITEM_CATEGORY_LABEL[e.category]}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-[14px] tabular">
        <span className={e.npcPrice > 0 ? "text-warn" : "text-text-mute"}>
          {e.npcPrice > 0 ? compact(e.npcPrice) : "—"}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-neon tabular">
        {e.goldPrice > 0 ? compact(e.goldPrice) : "—"}
      </td>
      <td
        className="px-3 py-2 text-right text-[14px] text-text-dim tabular"
        title={e.sources ? `${e.sources} espécies dropam este item` : undefined}
      >
        {e.sources || "—"}
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-ok tabular">
        {e.best ? pctText(e.best.chancePct) : "—"}
      </td>
      <td className="px-3 py-2">
        {e.bestFarm ? (
          /* O nivel vai JUNTO do nome, e nao so na coluna de nivel minimo: as
             duas colunas falam de pokemons diferentes (a melhor fonte de Wool
             Ball e um Zangoose de 470; o nivel minimo, um Meowth de 20) e lidas
             lado a lado afirmam um "Zangoose nivel 20" que nao existe. */
          <Link
            href={`/dex/${e.bestFarm.id}`}
            className="flex items-center gap-1.5 text-[13px] text-text-dim hover:text-accent"
          >
            <Sprite src={spriteUrl(e.bestFarm.id)} alt={e.bestFarm.name} size={26} />
            <span className="min-w-0">
              <span className="block truncate">{e.bestFarm.name}</span>
              <span className="pix text-[11px] text-text-mute">nv {e.bestFarm.level || "—"}</span>
            </span>
          </Link>
        ) : (
          <span className="text-[13px] text-text-mute">
            {e.sources ? "não se caça" : "—"}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-text-dim tabular">
        <span className="flex items-center justify-end gap-1">
          {e.minFarmLevel != null ? <IconLevel size={14} /> : null}
          {e.minFarmLevel ?? "—"}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-[14px] tabular">
        {e.goldPerKill > 0 ? (
          <Tooltip
            content={`Na melhor fonte farmável (${e.bestFarm?.name}), este item soma ~${compact(
              Math.round(e.goldPerKill),
            )} de ouro a cada abate.`}
          >
            <span className="text-warn">{compact(Math.round(e.goldPerKill))}</span>
          </Tooltip>
        ) : (
          <span className="text-text-mute">—</span>
        )}
      </td>
    </tr>
  );
}
