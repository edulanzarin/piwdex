import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { findUserByEmail, getUserById } from "@/lib/users";

// Login do piwdex: Auth.js v5 com sessao JWT (sem tabela de sessao) por cima do
// nosso Postgres em SQL puro. So email/senha (bcryptjs) — sem OAuth.
const vipActive = (vip: boolean, ate: string | null) =>
  vip && (!ate || new Date(ate).getTime() > Date.now());

// Cookies namespaced ("piwdex.*"): no localhost o cookie ignora a porta, entao a
// sessao de outro app next-auth (prospects, navedesk...) chegaria como
// "authjs.session-token" e o piwdex tentaria descriptografar com o segredo errado
// ("no matching decryption secret"). Nome proprio isola de vez.
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

        const user = await findUserByEmail(email);
        if (!user || !user.senha_hash) return null;
        const ok = await bcrypt.compare(senha, user.senha_hash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.nome ?? undefined,
          email: user.email,
          image: user.avatar_url ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Login por credentials: o id do banco ja vem em user.id.
      if (user?.id) token.uid = user.id;

      // Revalida a cada request: se o usuario sumiu (removido/banco recriado)
      // derruba a sessao; e mantem nome/avatar/vip frescos.
      if (token.uid) {
        const u = await getUserById(token.uid as string);
        if (!u) return null;
        token.name = u.nome;
        token.email = u.email;
        token.picture = u.avatar_url;
        token.vip = vipActive(u.vip, u.vip_ate);
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      session.user.vip = !!token.vip;
      return session;
    },
  },
});
