"use client";

// Demo animado (CSS puro, sem gif/asset) de como usar o bookmarklet: arrasta o
// botao pra barra de favoritos -> abre o jogo logado -> clica no favorito. Um
// "navegador" fake com 3 cenas que se alternam em loop de 9s. Respeita
// prefers-reduced-motion (mostra so o estado final "conectado").

import { useT } from "./locale-provider";

const Cursor = () => (
  <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
    <path d="M1 1 L1 13 L4.5 10 L6.5 15 L8.5 14 L6 9 L11 9 Z" fill="#fff" stroke="#0a0f1c" strokeWidth="1" strokeLinejoin="round" />
  </svg>
);

export function BookmarkletDemo() {
  const t = useT();
  return (
    <div className="bmd" aria-hidden="true">
      <style>{CSS}</style>
      <div className="bmd-win">
        <div className="bmd-top">
          <span className="bmd-dot" /><span className="bmd-dot" /><span className="bmd-dot" />
          <span className="bmd-url">poke.idleworld.online</span>
        </div>
        <div className="bmd-favbar">
          <span className="bmd-star-ring" />
          <span className="bmd-star">&#9733; piwdex</span>
        </div>
        <div className="bmd-body">
          <div className="bmd-scene bmd-s1">
            <div className="bmd-chip">&#8613; Conectar piwdex</div>
            <div className="bmd-cap">{t("account.demo.step1")}</div>
          </div>
          <div className="bmd-scene bmd-s2">
            <div className="bmd-game">
              <div className="bmd-game-sprite" />
              <div className="bmd-game-rows">
                <span className="bmd-game-row" />
                <span className="bmd-game-row short" />
              </div>
            </div>
            <div className="bmd-cap">{t("account.demo.step2")}</div>
          </div>
          <div className="bmd-scene bmd-s3">
            <div className="bmd-toast">&#10003; {t("account.demo.done")}</div>
            <div className="bmd-cap">{t("account.demo.step3")}</div>
          </div>
        </div>
        <span className="bmd-cursor"><Cursor /></span>
      </div>
    </div>
  );
}

const CSS = `
.bmd-win{position:relative;border:1px solid var(--border-strong,#24406b);border-radius:8px;overflow:hidden;background:rgba(6,10,20,.92)}
.bmd-top{display:flex;align-items:center;height:22px;padding:0 8px;background:rgba(12,18,34,.96);border-bottom:1px solid rgba(36,64,107,.5)}
.bmd-dot{width:7px;height:7px;border-radius:50%;background:#2a3a5c;margin-right:5px}
.bmd-url{margin-left:6px;font-family:var(--font-mono),monospace;font-size:9px;color:#7f8db0}
.bmd-favbar{position:relative;display:flex;align-items:center;height:22px;padding:0 8px;background:rgba(9,14,26,.96);border-bottom:1px solid rgba(36,64,107,.4)}
.bmd-star{font-family:var(--font-mono),monospace;font-size:9px;color:var(--cyan,#57d3e6);white-space:nowrap;transform-origin:left center;animation:bmd-star 9s infinite}
.bmd-star-ring{position:absolute;left:12px;top:50%;width:16px;height:16px;margin-top:-8px;border-radius:50%;border:1px solid var(--cyan,#57d3e6);opacity:0;animation:bmd-ring 9s infinite}
.bmd-body{position:relative;height:132px}
.bmd-scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0}
.bmd-s1{animation:bmd-s1 9s infinite}
.bmd-s2{animation:bmd-s2 9s infinite}
.bmd-s3{animation:bmd-s3 9s infinite}
.bmd-cap{position:absolute;bottom:8px;left:0;right:0;text-align:center;font-family:var(--font-pixel);font-size:8px;line-height:1.5;color:#8aa0c8}
.bmd-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:6px;background:var(--cyan,#398bf0);color:#04121f;font-family:var(--font-pixel);font-size:8px;box-shadow:0 6px 16px rgba(57,139,240,.4);animation:bmd-chip 1.2s ease-in-out infinite}
.bmd-game{display:flex;align-items:center;gap:12px}
.bmd-game-sprite{width:30px;height:30px;border-radius:4px;background:linear-gradient(135deg,var(--cyan,#398bf0),#7a4bd0);image-rendering:pixelated;box-shadow:0 0 12px rgba(57,139,240,.35)}
.bmd-game-rows{display:flex;flex-direction:column;gap:6px}
.bmd-game-row{width:120px;height:7px;border-radius:3px;background:rgba(90,120,170,.4)}
.bmd-game-row.short{width:72px}
.bmd-toast{padding:6px 12px;border-radius:6px;background:rgba(40,190,130,.14);border:1px solid rgba(70,225,160,.55);color:#4fe0a0;font-family:var(--font-pixel);font-size:8px;opacity:0;animation:bmd-toast 9s infinite}
.bmd-cursor{position:absolute;left:34px;top:26px;opacity:0;line-height:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));animation:bmd-cursor 9s infinite}
@keyframes bmd-s1{0%{opacity:1}30%{opacity:1}34%{opacity:0}100%{opacity:0}}
@keyframes bmd-s2{0%,30%{opacity:0}34%{opacity:1}63%{opacity:1}67%{opacity:0}100%{opacity:0}}
@keyframes bmd-s3{0%,63%{opacity:0}67%{opacity:1}96%{opacity:1}100%{opacity:0}}
@keyframes bmd-star{0%,28%{opacity:0;transform:scale(0)}33%{opacity:1;transform:scale(1.15)}37%{transform:scale(1)}100%{opacity:1;transform:scale(1)}}
@keyframes bmd-ring{0%,67%{opacity:0;transform:scale(.5)}72%{opacity:.9;transform:scale(1)}82%{opacity:0;transform:scale(2)}100%{opacity:0}}
@keyframes bmd-chip{0%,100%{transform:translateY(0)}45%{transform:translateY(-7px)}}
@keyframes bmd-cursor{0%,63%{opacity:0}67%{opacity:1;transform:translate(0,0)}71%{transform:translate(-2px,4px)}75%{transform:translate(0,0)}96%{opacity:1}100%{opacity:0}}
@keyframes bmd-toast{0%,75%{opacity:0}81%{opacity:1}96%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){
  .bmd-s1,.bmd-s2,.bmd-cursor{animation:none;opacity:0}
  .bmd-s3,.bmd-star,.bmd-toast{animation:none;opacity:1;transform:none}
  .bmd-star-ring{display:none}
}
`;
