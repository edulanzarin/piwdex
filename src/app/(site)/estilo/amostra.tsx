"use client";

import { useState } from "react";
import {
  ArtCard,
  Badge,
  Button,
  ExploreLink,
  Frame,
  RuleTitle,
  DisplayTitle,
  Eyebrow,
  Reveal,
  Checkbox,
  DataList,
  DataRow,
  Divider,
  Metric,
  MetricCell,
  MetricGrid,
  SectionTitle,
  Chip,
  Empty,
  Input,
  Note,
  Panel,
  FieldLabel,
  Segmented,
  Segments,
  Select,
  Skeleton,
  StatBar,
  StatTile,
  Sprite,
  Switch,
  Tabs,
  Tooltip,
} from "@/components/ui";

/**
 * O corpo da amostra.
 *
 * Cliente porque metade das primitivas tem estado (aba, seletor, interruptor), e
 * primitiva mostrada DESLIGADA nao se julga: o que decide um redesenho e o
 * hover, o foco e o ativo, que so existem quando da pra clicar.
 */

/** Um bloco da amostra: titulo, uma linha do que ele responde, e as pecas. */
function Bloco({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="pix text-[15px] text-text">{titulo}</h2>
        <p className="text-[13px] text-text-mute">{nota}</p>
      </div>
      <div className="panel p-5">{children}</div>
    </section>
  );
}

/** A fileira, que e como quase toda primitiva se compara: lado a lado. */
function Fileira({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export function Amostra() {
  const [aba, setAba] = useState<"um" | "dois" | "tres">("um");
  const [modo, setModo] = useState<"grade" | "tabela">("grade");
  const [tipo, setTipo] = useState<"todos" | "fogo" | "agua">("todos");
  const [ligado, setLigado] = useState(true);
  const [marcado, setMarcado] = useState(true);
  const [texto, setTexto] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-16">
      <header className="flex flex-col gap-2">
        <h1 className="pix text-[24px] text-text">Sistema de design</h1>
        <p className="max-w-2xl text-[14px] text-text-dim">
          Console macio: a personalidade retro fica na paleta, no brilho e no sprite; a
          geometria e moderna. Raio, elevacao e respiro saem de token, e trocar a decisao
          e mexer num arquivo so.
        </p>
      </header>

      <Bloco
        titulo="Botao"
        nota="Um solido so, e ele e a acao principal. Os outros quatro sao quietos de proposito — cinco botoes igualmente vistosos nao formam hierarquia."
      >
        <div className="flex flex-col gap-4">
          <Fileira>
            <Button variant="primary">Principal</Button>
            <Button variant="solido" style={{ backgroundColor: "var(--color-t-dex)" }}>
              Solido
            </Button>
            <Button variant="neon">Neon</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="danger">Perigo</Button>
            <Button variant="outline" disabled>
              Desligado
            </Button>
            <Button variant="outline" active>
              Ativo
            </Button>
          </Fileira>
          <Fileira>
            <Button size="sm" variant="primary">
              Pequeno
            </Button>
            <Button size="md" variant="primary">
              Medio
            </Button>
            <Button size="lg" variant="primary">
              Grande
            </Button>
          </Fileira>
        </div>
      </Bloco>

      <Bloco
        titulo="Superficie"
        nota="Hierarquia por profundidade, nao por borda. Cada degrau da escada de elevacao sobe a sombra e nao a linha."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {(["elev-1", "elev-2", "elev-3"] as const).map((e, i) => (
            <div
              key={e}
              className="rounded-pix-lg border border-line bg-surface-2 p-4"
              style={{ boxShadow: `var(--shadow-lip), var(--shadow-${e})` }}
            >
              <p className="pix text-[12px] text-text-dim">Elevacao {i + 1}</p>
              <p className="mt-1 text-[13px] text-text-mute">
                {i === 0 && "Peca em repouso: card, campo."}
                {i === 1 && "Peca que responde: card no hover, botao."}
                {i === 2 && "Bloco que flutua: painel, barra."}
              </p>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Raio"
        nota="Tres degraus e uma pilula. Controle pede raio menor que bloco, senao o botao dentro do painel vira bolha dentro de bolha."
      >
        <Fileira>
          {[
            ["xs", "6px", "var(--radius-xs)"],
            ["pix", "10px", "var(--radius-pix)"],
            ["pix-lg", "14px", "var(--radius-pix-lg)"],
            ["glass", "18px", "var(--radius-glass)"],
            ["pill", "999px", "var(--radius-pill)"],
          ].map(([nome, px, token]) => (
            <div key={nome} className="flex flex-col items-center gap-2">
              <div
                className="h-16 w-16 border border-line-strong bg-surface-2"
                style={{ borderRadius: token }}
              />
              <span className="pix text-[10px] text-text-mute">{nome}</span>
              <span className="text-[10px] text-text-mute">{px}</span>
            </div>
          ))}
        </Fileira>
      </Bloco>

      <Bloco titulo="Entrada" nota="Uma casca so pra tudo que aceita entrada: mesma altura, mesmo foco, mesmo poco escuro.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Campo de texto</FieldLabel>
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Bulbasaur"
              onClear={texto ? () => setTexto("") : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Seletor</FieldLabel>
            <Select
              value={tipo}
              onChange={setTipo}
              options={[
                { value: "todos", label: "Todos os tipos" },
                { value: "fogo", label: "Fogo" },
                { value: "agua", label: "Agua" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Campo invalido</FieldLabel>
            <Input value="341" onChange={() => {}} invalid />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Campo desligado</FieldLabel>
            <Input value="" onChange={() => {}} disabled placeholder="Indisponivel" />
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Escolha" nota="Segmentado para poucas opcoes visiveis, abas para secao, interruptor para o que liga.">
        <div className="flex flex-col gap-5">
          <Segmented
            value={modo}
            onChange={setModo}
            options={[
              { value: "grade", label: "Grade" },
              { value: "tabela", label: "Tabela" },
            ]}
          />
          <Tabs
            value={aba}
            onChange={setAba}
            items={[
              { value: "um", label: "Cacada", count: 12 },
              { value: "dois", label: "Automacao" },
              { value: "tres", label: "Registro", count: 3 },
            ]}
          />
          <Fileira>
            <Switch
              checked={ligado}
              onChange={(e) => setLigado(e.target.checked)}
              label="Auto-captura"
              hint="Liga o Auto-Helper do jogo"
            />
            <Checkbox
              checked={marcado}
              onChange={(e) => setMarcado(e.target.checked)}
              label="So os que eu ainda nao tenho"
            />
          </Fileira>
        </div>
      </Bloco>

      <Bloco titulo="Rotulo" nota="Chip carrega estado ou categoria. O tom diz o que e, e nunca so a cor — quem nao distingue cor le a palavra.">
        <Fileira>
          <Chip tone="neutral">Neutro</Chip>
          <Chip tone="accent">Acento</Chip>
          <Chip tone="neon">Neon</Chip>
          <Chip tone="ok">Rodando</Chip>
          <Chip tone="warn">Na fila</Chip>
          <Chip tone="danger">Recusado</Chip>
          <Chip tone="accent" onRemove={() => {}}>
            Removivel
          </Chip>
        </Fileira>
      </Bloco>

      <Bloco titulo="Dado" nota="Barra em blocos, e nao continua: a leitura de stat de jogo e comparativa, e bloco se conta com o olho.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2.5">
            <StatBar label="HP" value={39} max={255} />
            <StatBar label="Ataque" value={52} max={255} />
            <StatBar label="Defesa" value={43} max={255} />
            <StatBar label="Velocidade" value={65} max={255} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="XP por hora" value="184 mil" ratio={0.78} />
            <StatTile label="Ouro por hora" value="92 mil" ratio={0.41} />
            <StatTile label="Abates" value="1.204" ratio={0.62} />
            <StatTile label="Shiny" value="2" ratio={0.12} />
          </div>
        </div>
        <div className="mt-5">
          <Segments ratio={0.62} label="Progresso do nivel" />
        </div>
      </Bloco>

      <Bloco titulo="Aviso" nota="Quatro tons, e cada um so aparece quando ha o que fazer a respeito.">
        <div className="flex flex-col gap-3">
          <Note tone="muted">O catalogo esta em snapshot: a fonte do jogo nao respondeu.</Note>
          <Note tone="accent">A rota considera o tipo do dia e os bonus ativos na conta.</Note>
          <Note tone="warn">Sem Ultra Ball na bolsa. O jogo nao vai capturar nada.</Note>
          <Note tone="danger">O jogo recusou a conta. Reconectar nao desfaz isso.</Note>
        </div>
      </Bloco>

      <Bloco titulo="Espera e vazio" nota="Os quatro estados desenhados. Vazio que nao diz o que fazer e uma tela que desiste junto com a pessoa.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Empty
            title="Nenhum pokemon com esses filtros"
            hint="Tente afrouxar o nivel ou tirar um tipo."
            action={<Button variant="outline">Limpar filtros</Button>}
          />
        </div>
      </Bloco>

      <Bloco titulo="Painel" nota="O bloco que carrega tudo. Titulo, acoes no canto e corpo — a moldura padrao de qualquer secao.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel title="Sessao" actions={<Chip tone="ok">Rodando</Chip>}>
            <p className="text-[13px] text-text-dim">
              Conectada ha 4 horas, no shard 12. O socket e a sessao: abrir o jogo numa aba
              tira a caçada do robo.
            </p>
          </Panel>
          <Panel
            title="Com tooltip"
            actions={
              <Tooltip content="A explicacao curta, que so aparece a pedido.">
                <span className="pix text-[11px] text-text-mute">?</span>
              </Tooltip>
            }
          >
            <p className="text-[13px] text-text-dim">
              Painel com acao no canto. A borda so aparece onde a superficie nao resolveu.
            </p>
          </Panel>
        </div>
      </Bloco>

      <Bloco
        titulo="Selo"
        nota="Estado do sistema, e nao categoria. Por isso e pilula com ponto, e nao chip: o ponto se le de canto de olho, antes da palavra."
      >
        <Fileira>
          <Badge tone="ok" pulse>
            Ao vivo
          </Badge>
          <Badge tone="neutral">Snapshot</Badge>
          <Badge tone="accent">Novo</Badge>
          <Badge tone="warn">Na fila</Badge>
          <Badge tone="danger">Recusado</Badge>
          <Badge tone="info" dot={false}>
            Sem ponto
          </Badge>
        </Fileira>
      </Bloco>

      <Bloco
        titulo="Metrica"
        nota="Contagem sem teto. O irmao dela e o StatTile, que mede contra um maximo — pedir maximo aqui obrigaria a inventar um, e maximo inventado a tela passa a afirmar."
      >
        <div className="flex flex-col gap-5">
          <MetricGrid>
            <MetricCell value="482" label="especies" tint="var(--color-t-dex)" />
            <MetricCell value="428" label="itens" tint="var(--color-t-itens)" />
            <MetricCell value="347" label="locais de caca" tint="var(--color-t-hunt)" />
            <MetricCell value="2.657" label="registros de drop" tint="var(--color-t-meta)" />
          </MetricGrid>
          <Fileira>
            <Metric size="sm" value="12" label="Pequeno" />
            <Metric size="md" value="1.204" label="Medio" />
            <Metric size="lg" value="184" suffix="mil/h" label="Grande" tint="var(--color-neon)" />
          </Fileira>
        </div>
      </Bloco>

      <Bloco
        titulo="Par rotulo e valor"
        nota="A linha mais repetida do site. O valor vai a direita e no mono: com valor a esquerda, 9 e 1.204 comecam juntos e terminam em lugares diferentes."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <DataList>
            <DataRow label="Especie" value="Charmander" />
            <DataRow label="Nivel da hunt" value="14" />
            <DataRow label="XP por abate" value="62" />
            <DataRow label="Ouro esperado" value="1.204" hint="valor por abate" />
            <DataRow label="Total por hora" value="184.320" emphasis />
          </DataList>
          <div className="flex flex-col gap-3">
            <SectionTitle size="sm">Titulo de secao</SectionTitle>
            <p className="text-[13px] text-text-mute">
              O fio corre da palavra ate a borda e morre em transparente. De ponta a ponta
              com opacidade cheia, ele dividiria a pagina em duas.
            </p>
            <Divider />
            <p className="text-[13px] text-text-mute">Fio solto, pra dentro de painel.</p>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Titulo de cena"
        nota="Sobrelinha pequena e nome grande em italico. O italico e de familia propria: a Lexend nao tem um, e o sintetizado torce a haste em corpo grande."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow tint="var(--color-t-dex)">Conheca cada</Eyebrow>
            <DisplayTitle size="xl" tint="var(--color-t-dex)">
              Pokedex
            </DisplayTitle>
          </div>
          <div className="flex flex-col gap-2">
            <Eyebrow>Escolha onde</Eyebrow>
            <DisplayTitle size="md" className="text-text">
              Cacar
            </DisplayTitle>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Revelacao no scroll"
        nota="Dispara ao entrar em cena e se desliga na primeira vez. Reanimar a cada passagem faz reler uma frase virar perseguir a frase."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {(["sobe", "esquerda", "cresce"] as const).map((e, i) => (
            <Reveal key={e} efeito={e} delay={i * 90}>
              <div className="rounded-pix border border-line bg-surface-2 p-4">
                <p className="pix text-[12px] text-text-dim">{e}</p>
                <p className="mt-1 text-[12px] text-text-mute">
                  Rola pra fora e volta pra ver de novo — ele so anima uma vez.
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Titulo de capitulo"
        nota="Fio dos dois lados e tracking muito largo. Ele PARA a pagina — um por tela costuma ser o certo, dois ja e ritmo de slides."
      >
        <div className="flex flex-col gap-8 py-2">
          <RuleTitle>Mais recente</RuleTitle>
          <RuleTitle tint="var(--color-t-dex)">Em destaque</RuleTitle>
        </div>
      </Bloco>

      <Bloco
        titulo="Moldura de fio"
        nota="Contorno, e nao superficie. O Panel tem fundo e elevacao pra separar do que passa atras; a moldura emoldura o que ja esta legivel."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Frame className="p-5">
            <p className="pix text-[12px] text-text-dim">Simples</p>
            <p className="mt-1 text-[12px] text-text-mute">Um fio, e respiro.</p>
          </Frame>
          <Frame dupla className="p-5">
            <p className="pix text-[12px] text-text-dim">Dupla</p>
            <p className="mt-1 text-[12px] text-text-mute">A segunda linha faz virar placa.</p>
          </Frame>
          <Frame cantos tint="var(--color-t-hunt)" className="p-5">
            <p className="pix text-[12px] text-text-dim">Cantos</p>
            <p className="mt-1 text-[12px] text-text-mute">So os quatro cantos marcados.</p>
          </Frame>
        </div>
        <div className="mt-5 flex flex-wrap gap-6">
          <ExploreLink href="#">Explorar</ExploreLink>
          <ExploreLink href="#" tint="var(--color-t-meta)">
            Ver todos
          </ExploreLink>
        </div>
      </Bloco>

      <Bloco
        titulo="Cartao de arte"
        nota="Arte encostando nas bordas e placa solida embaixo. A placa nao flutua sobre a imagem: nome sobre arte some em metade dos casos de uma grade."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Pokédex", "pokedex", "var(--color-t-dex)"],
            ["Itens", "itens", "var(--color-t-itens)"],
            ["Hunt", "hunt", "var(--color-t-hunt)"],
            ["Meta", "meta", "var(--color-t-meta)"],
          ].map(([nome, arte, cor]) => (
            <ArtCard
              key={nome}
              href="#"
              name={nome}
              eyebrow="Ferramenta"
              tint={cor}
              art={
                <Sprite
                  src={`/images/icons/${arte}.svg`}
                  alt=""
                  size={120}
                  className="[--sprite:96px]"
                />
              }
            />
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Cor" nota="Acento marca ESTADO e sai da frente. Cor com significado fica onde informa: ferramenta, tipo, raridade.">
        <div className="flex flex-col gap-4">
          <div>
            <p className="pix mb-2 text-[11px] text-text-mute">Superficie</p>
            <Fileira>
              {["bg", "bg-soft", "surface", "surface-2", "surface-3"].map((c) => (
                <div key={c} className="flex flex-col items-center gap-1.5">
                  <div
                    className="h-12 w-20 rounded-pix border border-line"
                    style={{ background: `var(--color-${c})` }}
                  />
                  <span className="text-[10px] text-text-mute">{c}</span>
                </div>
              ))}
            </Fileira>
          </div>
          <div>
            <p className="pix mb-2 text-[11px] text-text-mute">Ferramenta</p>
            <Fileira>
              {["dex", "itens", "calc", "hunt", "breed", "meta", "robo"].map((c) => (
                <div key={c} className="flex flex-col items-center gap-1.5">
                  <div
                    className="h-12 w-20 rounded-pix"
                    style={{ background: `var(--color-t-${c})` }}
                  />
                  <span className="text-[10px] text-text-mute">{c}</span>
                </div>
              ))}
            </Fileira>
          </div>
        </div>
      </Bloco>
    </div>
  );
}
