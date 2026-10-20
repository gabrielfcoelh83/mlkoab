import { Fragment, useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  adicionarGrifo, apagarGrifo, corDoGrifo, normalizarGrifos, trechosPosicionados,
} from '../../lib/grifos';
import BarraDeGrifo from './BarraDeGrifo';

// Texto que aceita marca-texto. Devolve um <span> com o texto dividido em
// <mark> e trechos sem cor, e cuida da seleção e da barra — inclusive quando
// a seleção começa ou termina DENTRO de um grifo existente, caso em que o
// offset não pode ser lido do nó de texto direto.
//
// A barra é desenhada num portal no body: `position: fixed` dentro de um
// ancestral com `transform` (as animações de entrada) resolveria contra ele,
// e o clique na barra borbulharia para a alternativa do quiz.

export type Grifo = {
  campo: string;
  inicio: number;
  fim: number;
  cor: string;
};

type Props = {
  texto: string;
  campo: string;
  grifos: Grifo[];
  onMudar: (grifos: Grifo[]) => void;
  style?: CSSProperties;
  className?: string;
};

type Selecao = {
  inicio: number;
  fim: number;
  top: number;
  left: number;
};

type Alvo = {
  indice: number;
  top: number;
  left: number;
};

function deslocamento(raiz: HTMLElement, no: Node, offset: number): number | null {
  try {
    // Range do início do campo até a borda da seleção: funciona também quando
    // a borda é um elemento (o <mark>) e não um nó de texto.
    const intervalo = document.createRange();
    intervalo.selectNodeContents(raiz);
    intervalo.setEnd(no, offset);
    return intervalo.toString().length;
  } catch {
    return null;
  }
}

function intervaloDaSelecao(raiz: HTMLElement | null): { inicio: number; fim: number } | null {
  if (!raiz) return null;
  const selecao = window.getSelection();
  if (!selecao || selecao.rangeCount === 0 || selecao.isCollapsed) return null;

  const intervalo = selecao.getRangeAt(0);
  // Seleção que começa aqui e termina fora (ou vice-versa) não é deste campo.
  if (!raiz.contains(intervalo.startContainer) || !raiz.contains(intervalo.endContainer)) return null;

  const inicio = deslocamento(raiz, intervalo.startContainer, intervalo.startOffset);
  const fim = deslocamento(raiz, intervalo.endContainer, intervalo.endOffset);
  if (inicio == null || fim == null || fim <= inicio) return null;
  return { inicio, fim };
}

export default function TextoGrifavel({ texto, campo, grifos, onMudar, style, className }: Props) {
  const raizRef = useRef<HTMLSpanElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [grifoAlvo, setGrifoAlvo] = useState<Alvo | null>(null);
  const [estreito, setEstreito] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 560px)').matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const consulta = window.matchMedia('(max-width: 560px)');
    const aoMudar = () => setEstreito(consulta.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  const fechar = () => {
    setSelecao(null);
    setGrifoAlvo(null);
  };

  // Seleção muda no mouse ou no teclado. A barra só abre se a seleção inteira
  // estiver neste campo; encerrar um clique sobre um grifo abre o "Apagar".
  useEffect(() => {
    const aoSoltar = (evento: Event) => {
      const alvo = evento.target as Node | null;
      if (alvo && barraRef.current?.contains(alvo)) return;

      const selecionado = intervaloDaSelecao(raizRef.current);
      if (!selecionado) {
        // Um clique num grifo é tratado no próprio <mark>; não feche para não
        // apagar a barra que ele vai abrir em seguida.
        const sobreGrifo = alvo instanceof Element && alvo.closest('[data-grifo-indice]');
        if (sobreGrifo) return;
        fechar();
        return;
      }

      const intervalo = window.getSelection()?.getRangeAt(0);
      if (!intervalo) return;
      const retangulo = intervalo.getBoundingClientRect();
      setGrifoAlvo(null);
      setSelecao({
        ...selecionado,
        top: retangulo.top,
        left: retangulo.left + retangulo.width / 2,
      });
    };

    document.addEventListener('mouseup', aoSoltar);
    document.addEventListener('keyup', aoSoltar);
    return () => {
      document.removeEventListener('mouseup', aoSoltar);
      document.removeEventListener('keyup', aoSoltar);
    };
  }, []);

  // No celular a seleção vem dos puxadores nativos, que não disparam mouseup.
  // `selectionchange` cobre isso; só abre com seleção de verdade para não
  // fechar a barra do "Apagar" quando o navegador colapsa a seleção.
  useEffect(() => {
    if (!estreito) return undefined;
    const aoMudarSelecao = () => {
      const selecionado = intervaloDaSelecao(raizRef.current);
      if (!selecionado) return;
      setGrifoAlvo(null);
      setSelecao({ ...selecionado, top: 0, left: window.innerWidth / 2 });
    };
    document.addEventListener('selectionchange', aoMudarSelecao);
    return () => document.removeEventListener('selectionchange', aoMudarSelecao);
  }, [estreito]);

  // Esc fecha a barra. Também fecha ao clicar fora dela e fora do texto.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      if (!barraRef.current) return;
      evento.preventDefault();
      setSelecao(null);
      setGrifoAlvo(null);
    };
    const aoApontar = (evento: PointerEvent) => {
      const alvo = evento.target as Node | null;
      if (!alvo) return;
      if (barraRef.current?.contains(alvo) || raizRef.current?.contains(alvo)) return;
      setSelecao(null);
      setGrifoAlvo(null);
    };

    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoApontar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoApontar);
    };
  }, []);

  const listaCompleta = normalizarGrifos(grifos);
  // Índices da lista completa: o "Apagar" do grifo clicado precisa apontar
  // para a lista que o App guarda, não para a lista filtrada do campo.
  const doCampo = listaCompleta
    .map((grifo, indice) => ({ grifo, indice }))
    .filter(({ grifo }) => grifo.campo === campo);
  const trechos = trechosPosicionados(texto, doCampo.map(({ grifo }) => grifo));

  const indiceCompleto = (indiceDoCampo: number | null) => (
    indiceDoCampo == null ? null : doCampo[indiceDoCampo]?.indice ?? null
  );

  const temGrifoNaSelecao = !!selecao && doCampo.some(({ grifo }) => (
    grifo.inicio < selecao.fim && grifo.fim > selecao.inicio
  ));

  const grifar = (cor: string) => {
    if (!selecao) return;
    onMudar(adicionarGrifo(listaCompleta, {
      campo,
      inicio: selecao.inicio,
      fim: selecao.fim,
      cor,
    }));
    window.getSelection()?.removeAllRanges();
    fechar();
  };

  const apagarSelecao = () => {
    if (!selecao) return;
    const restantes = listaCompleta.filter((grifo) => !(
      grifo.campo === campo && grifo.inicio < selecao.fim && grifo.fim > selecao.inicio
    ));
    onMudar(restantes);
    window.getSelection()?.removeAllRanges();
    fechar();
  };

  const apagarAlvo = () => {
    if (!grifoAlvo) return;
    onMudar(apagarGrifo(listaCompleta, grifoAlvo.indice));
    fechar();
  };

  const clicarGrifo = (evento: ReactMouseEvent<HTMLElement>, indice: number) => {
    // Terminar uma seleção sobre um grifo não é clicar nele.
    if (String(window.getSelection() ?? '').length > 0) return;
    evento.stopPropagation();
    const retangulo = evento.currentTarget.getBoundingClientRect();
    setSelecao(null);
    setGrifoAlvo({
      indice,
      top: retangulo.top,
      left: retangulo.left + retangulo.width / 2,
    });
  };

  const posicao = selecao || grifoAlvo;
  const modo = selecao ? 'criar' : 'apagar';

  return (
    <>
      <span
        ref={raizRef}
        className={className}
        data-grifavel={campo}
        style={style}
      >
        {trechos.map((trecho, i) => {
          if (trecho.cor == null) return <Fragment key={i}>{trecho.texto}</Fragment>;
          const indice = indiceCompleto(trecho.indice);
          return (
            <mark
              key={i}
              data-grifo-cor={trecho.cor}
              data-grifo-inicio={trecho.inicio}
              data-grifo-fim={trecho.fim}
              data-grifo-indice={indice ?? undefined}
              onClick={(evento) => (indice == null ? undefined : clicarGrifo(evento, indice))}
              style={{
                background: corDoGrifo(trecho.cor),
                color: '#1c1b19',
                borderRadius: 2,
                padding: '0 1px',
                // Um grifo atravessando linha não perde o fundo no vão.
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
              }}
            >
              {trecho.texto}
            </mark>
          );
        })}
      </span>

      {(selecao || grifoAlvo) && createPortal(
        <BarraDeGrifo
          modo={modo}
          posicao={posicao}
          estreito={estreito}
          podeApagar={temGrifoNaSelecao}
          onGrifar={grifar}
          onApagar={selecao ? apagarSelecao : apagarAlvo}
          onFechar={fechar}
          referencia={barraRef}
        />,
        document.body,
      )}
    </>
  );
}
