import type { DefaultSession } from "next-auth";

// Extensoes do piwdex na sessao/JWT: id do usuario no nosso banco + flag VIP.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      vip: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    vip?: boolean;
  }
}
