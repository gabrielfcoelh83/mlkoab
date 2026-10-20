import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../lib/icons';
import { MUDO, SOMBRA_ALTA, TINTA } from '../../lib/theme';

// Diálogo flutuante, centrado na tela, para o pop-up da matéria em Revisões e
// a apostila do simulado. No celular ocupa a tela inteira (classe
// `dialogo-painel` em index.css). Esc e o clique no fundo fecham; o foco vai
// para o botão de fechar ao abrir e volta para quem abriu ao fechar.

type Props = {
  titulo: ReactNode;
  sub?: ReactNode;
  acoes?: ReactNode;
  onFechar: () => void;
  children: ReactNode;
  largura?: number;
  testId?: string;
};

export default function Dialogo({ titulo, sub, acoes, onFechar, children, largura = 760, testId }: Props) {
  const idTitulo = useId();
  const fecharRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  // O `onFechar` costuma chegar como função nova a cada render. Com ele nas
  // dependências, o efeito rodava de novo a cada render e o foco voltava ao
  // botão de fechar, tirando-o de onde a pessoa estava.
  const fecharAtual = useRef(onFechar);
  useEffect(() => { fecharAtual.current = onFechar; }, [onFechar]);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();

    const aoTeclar = (evento: KeyboardEvent) => {
      // Outro diálogo aberto por cima (a questão aberta de dentro do pop-up):
      // as teclas são dele, senão o Esc fecharia os dois de uma vez.
      const outros = [...document.querySelectorAll('[aria-modal="true"]')].filter((d) => d !== painelRef.current);
      if (outros.length > 0) return;
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        fecharAtual.current();
        return;
      }
      // Tab preso no painel: sem isso o foco escapava para a tela atrás.
      if (evento.key !== 'Tab' || !painelRef.current) return;
      const focaveis = painelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      anterior?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="dialogo-fundo"
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 500, padding: 24,
        background: 'rgba(28,27,25,.42)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        data-testid={testId}
        className="dialogo-painel"
        onClick={(evento) => evento.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, boxShadow: SOMBRA_ALTA,
          width: `min(${largura}px, 100%)`, maxHeight: 'calc(100vh - 48px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div className="dialogo-cabecalho" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 22px 14px', borderBottom: '1px solid #eeebe5' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={idTitulo} style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TINTA, letterSpacing: '-0.01em' }}>{titulo}</h2>
            {sub && <div style={{ fontSize: 12.5, color: MUDO, marginTop: 4 }}>{sub}</div>}
          </div>
          {acoes && <div className="dialogo-acoes" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>{acoes}</div>}
          <button
            ref={fecharRef}
            type="button"
            aria-label="Fechar"
            title="Fechar"
            data-testid="fechar-dialogo"
            onClick={onFechar}
            style={{
              width: 34, height: 34, flex: 'none', borderRadius: 7, border: '1px solid #e6e2da', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
            }}
          >
            <Icon name="x" color="#4f4b45" size={16} style={undefined} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 22px 22px', display: 'flex', flexDirection: 'column', gap: 12, background: '#faf9f6' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
