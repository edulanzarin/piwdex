import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { findUserByEmail, findOrCreateGoogleUser, getUserById } from "@/lib/users";

// Login do piwdex: Auth.js v5 com sessao JWT (sem tabela de sessao) por cima do
// nosso Postgres em SQL puro. Google so entra se as credenciais existirem no
// ambiente — assim o app sobe mesmo sem OAuth configurado (email/senha funciona).
const googleEnabled = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

const vipActive = (vip: boolean, ate: string | null) =>
  vip && (!ate || new Date(ate).getTime() > Date.now());

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/entrar" },
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
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
        if (!user || !user.senha_hash) return null; // usuario so-Google nao loga por senha
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
    async signIn({ account, profile }) {
      if (account?.provider === "google") return !!profile?.email; // sem email, rejeita
      return true;
    },
    async jwt({ token, user, account, profile }) {
      // Login por credentials: o id do banco ja vem em user.id.
      if (user?.id && account?.provider !== "google") token.uid = user.id;

      // Login Google: resolve/cria o usuario no banco e guarda o id.
      if (account?.provider === "google" && profile?.email) {
        const u = await findOrCreateGoogleUser({
          sub: account.providerAccountId,
          email: profile.email,
          nome: (profile.name as string) ?? null,
          avatar: (profile.picture as string) ?? null,
        });
        token.uid = u.id;
      }

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
