// Icones da navegacao: set de LINHA uniforme (viewBox 24x24, traço 2px, currentColor),
// todos no mesmo grid — entao alinham perfeito e herdam a cor do link (ativo/hover). A
// estetica pixel fica no CONTEUDO (sprites/dados); o chrome do menu e limpo.

function Base({ size = 22, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Pokebola (Pokedex).
export const NavDex = ({ size }: { size?: number }) => (
  <Base size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h6" />
    <path d="M15 12h6" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

// Bolsa (Itens & drops).
export const NavItems = ({ size }: { size?: number }) => (
  <Base size={size}>
    <path d="M5 7h14l-1 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 7Z" />
    <path d="M8.5 7a3.5 3.5 0 0 1 7 0" />
  </Base>
);

// Alvo (Hunt).
export const NavHunt = ({ size }: { size?: number }) => (
  <Base size={size}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
  </Base>
);

// Calculadora.
export const NavCalc = ({ size }: { size?: number }) => (
  <Base size={size}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M8 6h8" />
    {[9, 12.5, 16].map((cx) =>
      [13, 17].map((cy) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.6" fill="currentColor" stroke="none" />
      )),
    )}
  </Base>
);

// Treinador (Conta).
export const NavAccount = ({ size }: { size?: number }) => (
  <Base size={size}>
    <circle cx="12" cy="8" r="4" />
    <path d="M5 21a7 7 0 0 1 14 0" />
  </Base>
);

// Ovo (Breeding).
export const NavBreed = ({ size }: { size?: number }) => (
  <Base size={size}>
    <path d="M12 3c3.6 0 6.5 5.4 6.5 9.5a6.5 6.5 0 0 1-13 0C5.5 8.4 8.4 3 12 3Z" />
  </Base>
);

// Beaker / laboratorio (Laboratorio da Eevee).
export const NavLab = ({ size }: { size?: number }) => (
  <Base size={size}>
    <path d="M9 3h6" />
    <path d="M10 3v6l-4.4 8.4A2 2 0 0 0 7.4 21h9.2a2 2 0 0 0 1.8-3.6L14 9V3" />
    <path d="M7.7 15h8.6" />
  </Base>
);

// Cabeca de robo (Robo).
export const NavRobo = ({ size }: { size?: number }) => (
  <Base size={size}>
    <rect x="5" y="8" width="14" height="10" rx="2" />
    <path d="M12 4v4" />
    <circle cx="12" cy="3.2" r="1.1" />
    <path d="M9.5 12.5h.01M14.5 12.5h.01" />
    <path d="M10 15.5h4" />
  </Base>
);

// Estrela (VIP). `filled` pinta o miolo (VIP ativo); sem ele fica so o contorno (apagada).
export const NavVip = ({ size, filled }: { size?: number; filled?: boolean }) => (
  <Base size={size}>
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"
      fill={filled ? "currentColor" : "none"}
    />
  </Base>
);

// Porta com seta saindo (Sair / logout).
export const NavLogout = ({ size }: { size?: number }) => (
  <Base size={size}>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Base>
);

// Porta com seta entrando (Entrar / login).
export const NavLogin = ({ size }: { size?: number }) => (
  <Base size={size}>
    <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l4 4-4 4" />
    <path d="M14 12H3" />
  </Base>
);
