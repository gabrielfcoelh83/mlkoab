import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Icon } from '../lib/icons';
import {
  THEMES, TEMA_PADRAO, chaveDeTema, aplicarTemaNoDocumento, FONTE_TITULO, MUDO, TINTA,
} from '../lib/theme';
import { loadState } from '../lib/storage';

// A tela de endereço não encontrado — o 404.
//
// Ela NÃO mora dentro do `App`: quem manda para cá é o host, quando o caminho
// pedido não existe, e a resposta precisa continuar sendo um 404 de verdade —
// um SPA que responde 200 em qualquer rota não tem como dar isso. Por isso a
// tela tem HTML próprio (`404.html`, na raiz) e entrada própria
// (`entrada-404.jsx`): quem chega aqui não tem sessão, nem menu, nem API.
//
// O desenho é o "Papel e tinta" de sempre: os algarismos ficam como marca
// d'água de tinta diluída atrás do recado, o título em serifa, e as ações são
// os mesmos `Button` do resto do app. A paleta é a que a pessoa escolheu em
// Configurações, lida do estado salvo — a página de erro de quem usa Oliva não
// precisa ser bordô.

// Os três algarismos como um único caminho (viewBox 362x145), da versão de
// exemplo que o próprio shadcn publica. `currentColor` porque quem decide a cor
// é a marca d'água.
const ALGARISMOS = 'M62.6 142c-2.133 0-3.2-1.067-3.2-3.2V118h-56c-2 0-3-1-3-3V92.8c0-1.333.4-2.733 1.2-4.2L58.2 4c.8-1.333 2.067-2 3.8-2h28c2 0 3 1 3 3v85.4h11.2c.933 0 1.733.333 2.4 1 .667.533 1 1.267 1 2.2v21.2c0 .933-.333 1.733-1 2.4-.667.533-1.467.8-2.4.8H93v20.8c0 2.133-1.067 3.2-3.2 3.2H62.6zM33 90.4h26.4V51.2L33 90.4zM181.67 144.6c-7.333 0-14.333-1.333-21-4-6.666-2.667-12.866-6.733-18.6-12.2-5.733-5.467-10.266-13-13.6-22.6-3.333-9.6-5-20.667-5-33.2 0-12.533 1.667-23.6 5-33.2 3.334-9.6 7.867-17.133 13.6-22.6 5.734-5.467 11.934-9.533 18.6-12.2 6.667-2.8 13.667-4.2 21-4.2 7.467 0 14.534 1.4 21.2 4.2 6.667 2.667 12.8 6.733 18.4 12.2 5.734 5.467 10.267 13 13.6 22.6 3.334 9.6 5 20.667 5 33.2 0 12.533-1.666 23.6-5 33.2-3.333 9.6-7.866 17.133-13.6 22.6-5.6 5.467-11.733 9.533-18.4 12.2-6.666 2.667-13.733 4-21.2 4zm0-31c9.067 0 15.6-3.733 19.6-11.2 4.134-7.6 6.2-17.533 6.2-29.8s-2.066-22.2-6.2-29.8c-4.133-7.6-10.666-11.4-19.6-11.4-8.933 0-15.466 3.8-19.6 11.4-4 7.6-6 17.533-6 29.8s2 22.2 6 29.8c4.134 7.467 10.667 11.2 19.6 11.2zM316.116 142c-2.134 0-3.2-1.067-3.2-3.2V118h-56c-2 0-3-1-3-3V92.8c0-1.333.4-2.733 1.2-4.2l56.6-84.6c.8-1.333 2.066-2 3.8-2h28c2 0 3 1 3 3v85.4h11.2c.933 0 1.733.333 2.4 1 .666.533 1 1.267 1 2.2v21.2c0 .933-.334 1.733-1 2.4-.667.533-1.467.8-2.4.8h-11.2v20.8c0 2.133-1.067 3.2-3.2 3.2h-27.2zm-29.6-51.6h26.4V51.2l-26.4 39.2z';

export default function NaoEncontrada({
  titulo = 'Página não encontrada',
  descricao = 'O endereço que você abriu não existe ou mudou de lugar.',
}) {
  // A paleta escolhida em Configurações vive no estado salvo; lê-la aqui é o
  // que faz esta página não destoar de quem já usa o app. Quem nunca escolheu
  // vê o Bordô, o padrão.
  const [theme] = useState(() => THEMES[chaveDeTema(loadState({ theme: TEMA_PADRAO }).theme)]);

  useEffect(() => {
    aplicarTemaNoDocumento(theme);
    // O papel também no fundo do documento: o `100vh` do contêiner não cobre a
    // sobra que aparece quando a barra do navegador do celular recolhe.
    document.body.style.background = theme.bg;
  }, [theme]);

  // "Voltar" devolve para onde a pessoa estava. Quem abriu o endereço direto
  // (link colado, favorito velho) não tem histórico nesta aba, e voltar sairia
  // do site: sem histórico, o botão vai para o início.
  const voltar = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  };

  return (
    <div
      data-testid="nao-encontrada"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.bg,
        padding: 'clamp(24px, 6vh, 72px) clamp(18px, 5vw, 32px)',
      }}
    >
      {/* `.tela` é a entrada escalonada do app (index.css): marca d'água,
          título, recado e ações entram em sequência, 80ms entre um e outro —
          e sob movimento reduzido sobra só a opacidade, como no resto do app. */}
      <div className="tela" style={{ width: '100%' }}>
        <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
          {/* A marca d'água encosta no título (`margin` negativo): os
              algarismos ficam atrás do recado em vez de virarem um bloco
              separado acima dele. */}
          <svg
            viewBox="0 0 362 145"
            aria-hidden="true"
            style={{
              display: 'block',
              width: 'min(520px, 82%)',
              height: 'auto',
              margin: '0 auto clamp(-34px, -4vw, -14px)',
              color: TINTA,
              opacity: 0.05,
            }}
          >
            <path fill="currentColor" d={ALGARISMOS} />
          </svg>

          <h1
            style={{
              margin: 0,
              fontFamily: FONTE_TITULO,
              fontSize: 'clamp(30px, 5.2vw, 52px)',
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: theme.primary,
              textWrap: 'balance',
            }}
          >
            {titulo}
          </h1>

          <p
            style={{
              margin: '14px auto 0',
              maxWidth: 420,
              fontSize: 15,
              lineHeight: 1.65,
              color: MUDO,
              textWrap: 'pretty',
            }}
          >
            {descricao}
          </p>

          {/* No celular os botões ficam empilhados e ocupam a largura inteira —
              o dedo acerta sem mirar; a partir de `sm` ficam lado a lado, com
              o "Voltar" à esquerda, como numa barra de ações. Na ordem do DOM
              o "Voltar" vem primeiro (é o que se lê primeiro), e a ordem
              visual inverte no celular para a ação principal ficar em cima. */}
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-2">
            <Button asChild variant="outline" size="lg" className="group order-2 w-full sm:order-1 sm:w-auto">
              <button type="button" data-testid="voltar-da-404" onClick={voltar}>
                <span className="transition-transform group-hover:-translate-x-0.5" aria-hidden="true">
                  <Icon name="chevron-left" size={16} style={{ opacity: 0.6 }} />
                </span>
                Voltar
              </button>
            </Button>
            <Button asChild size="lg" className="order-1 w-full sm:order-2 sm:w-auto">
              <a href="/" data-testid="ir-para-o-inicio">Ir para o início</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
