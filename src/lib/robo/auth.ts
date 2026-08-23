import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { findUserByEmail, getUserById, normEmail, vipAtivo } from "@/lib/robo/users";
import { consumir, liberar } from "@/lib/robo/limite";

/**
 * O login do piwdex: Auth.js v5 com sessao JWT (sem tabela de sessao) por cima
 * do nosso Postgres em SQL puro. So email/senha — sem OAuth.
 *
 * ## Por que o cookie tem nome proprio
 *
 * `piwdex.session-token`, e nao o `authjs.session-token` padrao. Em
 * desenvolvimento o cookie IGNORA a porta: a sessao de qualquer outro app
 * next-auth rodando em `localhost` chegaria aqui com o nome padrao, e o piwdex
 * tentaria decifra-la com o segredo errado — "no matching decryption secret",
 * numa tela que nao tem nada a ver com o problema. Nome proprio isola de vez.
 */

const secureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = secureCookies ? "__Secure-" : "";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/entrar" },
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}piwdex.session-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: secureCookies },
    },
    callbackUrl: {
      name: `${cookiePrefix}piwdex.callback-url`,
      options: { sameSite: "lax", path: "/", secure: secureCookies },
    },
    csrfToken: {
      name: `${secureCookies ? "__Host-" : ""}piwdex.csrf-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: secureCookies },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const senha = typeof credentials?.senha === "string" ? credentials.senha : "";
        if (!email || !senha) return null;

        // O freio conta por CONTA ALVO, nao por quem tenta: quem ataca troca de
        // IP a vontade, mas o email que ele quer arrombar continua o mesmo.
        const chave = `login:${normEmail(email)}`;
        if (!consumir(chave).ok) return null;

        const user = await findUserByEmail(email);
        // `bcrypt.compare` roda mesmo sem usuario, contra um hash descartavel:
        // sem isso, "email inexistente" responde na hora e "senha errada"
        // demora os ~80ms do bcrypt, e essa diferenca de tempo revela quais
        // emails tem conta aqui.
        const hash = user?.senha_hash ?? "$2a$10$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalidoinva";
        const ok = await bcrypt.compare(senha, hash);
        if (!user || !ok) return null;

        liberar(chave);
        return { id: user.id, name: user.nome ?? undefined, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;

      // Revalida a cada request. E o que faz a assinatura VENCER sozinha: sem
      // esta releitura, quem entrou VIP seguiria VIP ate deslogar, porque o JWT
      // e assinado uma vez e nao sabe que a data passou.
      if (token.uid) {
        const u = await getUserById(token.uid as string);
        if (!u) return null; // conta removida: derruba a sessao
        token.name = u.nome;
        token.email = u.email;
        token.vip = vipAtivo(u.vip, u.vip_ate);
        token.admin = u.is_admin;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      session.user.vip = !!token.vip;
      session.user.admin = !!token.admin;
      return session;
    },
  },
});
