import { redirect } from "next/navigation";

// A Conta virou uma ABA do /vip (a visao da conta do jogo depende da sessao de jogo,
// que e VIP). A rota /conta continua viva so como atalho: manda pra aba Conta do VIP.
// Deslogado/sem-VIP cai no gate/paywall do proprio /vip.
export default function ContaPage() {
  redirect("/vip#conta");
}
