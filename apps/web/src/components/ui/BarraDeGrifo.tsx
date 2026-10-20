import type { CSSProperties, RefObject } from 'react';
import { CORES_DO_GRIFO } from '../../lib/grifos';

// A barra do marca-texto. Existe separada do texto porque a posição dela
// depende da seleção (ou do grifo clicado), não do conteúdo.

export type PosicaoDaBarra = { top: number; left: number } | null;

type Props = {
  modo: 'criar' | 'apagar';
  posicao: PosicaoDaBarra;
  estreito: boolean;
  podeApagar: boolean;
  onGrifar: (cor: string) => void;
  onApagar: () => void;
  onFechar: () => void;
  referencia: RefObject<HTMLDivElement | null>;
};

const base: CSSProperties = {
  position: 'fixed',
  zIndex: 900,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: '#fff',
  border: '1px solid #e6e2da',
  borderRadius: 10,
  padding: '6px 8px',
  boxShadow: '0 8px 24px rgba(28,27,25,.16)',
};

const botaoApagar: CSSProperties = {
  border: '1px solid #e6e2da',
  borderRadius: 8,
  background: '#fff',
  color: '#4f4b45',
  fontSize: 12.5,
  fontWeight: 600,
  padding: '6px 10px',
  cursor: 'pointer',
};

export default function BarraDeGrifo({
  modo, posicao, estreito, podeApagar, onGrifar, onApagar, onFechar, referencia,
}: Props) {
  if (!posicao) return null;

  // No celular a barra é uma faixa no rodapé: flutuar sobre a seleção briga
  // com o menu nativo do navegador. No desktop ela fica acima do trecho.
  const estilo: CSSProperties = estreito
    ? {
      ...base,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      borderRadius: 0,
      borderTop: '1px solid #e6e2da',
      borderLeft: 'none',
      borderRight: 'none',
      borderBottom: 'none',
      padding: '10px 14px calc(10px + env(safe-area-inset-bottom))',
      boxShadow: '0 -8px 24px rgba(28,27,25,.16)',
    }
    : {
      ...base,
      top: Math.max(8, posicao.top - 48),
      left: Math.min(Math.max(8, posicao.left), (window.innerWidth || 1024) - 8),
      transform: 'translateX(-50%)',
      maxWidth: 'calc(100vw - 16px)',
    };

  return (
    <div
      ref={referencia}
      role="toolbar"
      aria-label="Marca-texto"
      data-testid="barra-de-grifo"
      data-modo={modo}
      style={estilo}
      // Sem isto, o mousedown na barra tira o foco da seleção e, no quiz,
      // o clique poderia chegar à alternativa e marcar a resposta.
      onMouseDown={(evento) => {
        evento.preventDefault();
        evento.stopPropagation();
      }}
      onClick={(evento) => evento.stopPropagation()}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') {
          evento.preventDefault();
          evento.stopPropagation();
          onFechar();
        }
      }}
    >
      {modo === 'criar' && CORES_DO_GRIFO.map((c) => (
        <button
          key={c.chave}
          type="button"
          data-testid={`grifar-${c.chave}`}
          aria-label={c.aria}
          title={c.aria}
          onClick={() => onGrifar(c.chave)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: `1px solid ${c.borda}`,
            background: c.cor,
            cursor: 'pointer',
            flex: 'none',
          }}
        />
      ))}
      <button
        type="button"
        data-testid="apagar-grifo"
        onClick={onApagar}
        disabled={modo === 'criar' && !podeApagar}
        style={{
          ...botaoApagar,
          opacity: modo === 'criar' && !podeApagar ? 0.45 : 1,
          cursor: modo === 'criar' && !podeApagar ? 'not-allowed' : 'pointer',
        }}
      >
        Apagar
      </button>
    </div>
  );
}
