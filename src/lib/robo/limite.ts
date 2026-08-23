/**
 * Freio de tentativa, em memoria.
 *
 * Serve o login: sem ele, uma conta com senha fraca cai por forca bruta e o
 * unico registro disso e o log do Postgres. Nao pretende ser defesa de rede — e
 * o degrau que transforma "milhares de tentativas por minuto" em "cinco".
 *
 * Em MEMORIA de proposito, e isso e uma escolha consciente com uma condicao: o
 * `railway.json` trava `numReplicas: 1`. Com duas replicas, cada uma contaria
 * metade e o freio afrouxaria pela metade sem avisar. Se um dia o robo escalar
 * pra duas, isto tem que virar tabela ou Redis — e o comentario esta aqui pra
 * que a decisao seja tomada de novo, e nao herdada por engano.
 *
 * Restart zera a contagem. Tudo bem: o processo do robo nao reinicia a toda
 * hora (foi justamente pra isso que ele ganhou servico proprio).
 */

interface Janela {
  tentativas: number;
  ate: number;
}

const janelas = new Map<string, Janela>();

/** Faxina preguicosa: sem ela o Map cresce pra sempre com chave de quem passou
 *  uma vez e nunca mais voltou. Roda quando o Map fica grande, e nao por timer —
 *  timer em modulo de servidor sobrevive ao request e segura o processo. */
function faxina(agora: number) {
  if (janelas.size < 500) return;
  for (const [k, v] of janelas) if (v.ate <= agora) janelas.delete(k);
}

export interface Veredito {
  ok: boolean;
  /** segundos ate poder tentar de novo (so quando `ok` e false) */
  esperaSeg: number;
}

/**
 * Consome uma tentativa da chave. `ok: false` = estourou a cota.
 *
 * A janela e DESLIZANTE a partir da primeira tentativa: quem estourou espera o
 * resto dela, e nao um castigo novo a cada nova batida — senao quem insiste em
 * loop nunca mais consegue entrar, nem depois de lembrar a senha.
 */
export function consumir(chave: string, max = 8, janelaSeg = 300): Veredito {
  const agora = Date.now();
  faxina(agora);

  const atual = janelas.get(chave);
  if (!atual || atual.ate <= agora) {
    janelas.set(chave, { tentativas: 1, ate: agora + janelaSeg * 1000 });
    return { ok: true, esperaSeg: 0 };
  }

  atual.tentativas += 1;
  if (atual.tentativas > max) {
    return { ok: false, esperaSeg: Math.ceil((atual.ate - agora) / 1000) };
  }
  return { ok: true, esperaSeg: 0 };
}

/** Login deu certo: a conta deixa de estar sob suspeita. */
export function liberar(chave: string) {
  janelas.delete(chave);
}
