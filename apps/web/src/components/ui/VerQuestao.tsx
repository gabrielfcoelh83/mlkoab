import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Icon } from '../../lib/icons';
import { SOMBRA_ALTA } from '../../lib/theme';
import MotivoDoErro from './MotivoDoErro';
import { GabaritoComentado } from './CardDeQuestao';
import { SITUACAO } from './situacao';

// Leitura da questão e do gabarito, sem responder: refazer de dentro do modal
// é a fase 2. O componente é .tsx porque nasceu depois da migração gradual
// (ver CLAUDE.md); os .jsx de ícone/card continuam importáveis.

type Estilos = {
  card: CSSProperties;
  pill: (bg: string, fg: string) => CSSProperties;
  btnPrimary: CSSProperties;
  btnOutline: CSSProperties;
  sectionTitle: CSSProperties;
};

type Tema = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
};

export type TentativaDaRevisao = {
  id?: string | number | null;
  data?: string | null;
  resposta?: number | null;
  correta?: boolean;
  motivo?: string | null;
  motivo_nota?: string | null;
};

export type QuestaoDaRevisao = {
  id: number | string;
  disciplina?: string | null;
  topico?: string | null;
  tema?: string | null;
  enunciado?: string | null;
  alternativas?: string[];
  correta?: number | null;
  exame?: number | null;
  numero?: number | null;
  explicacao?: string | null;
};

export type ItemDaRevisao = {
  questao: QuestaoDaRevisao;
  situacao: 'errou' | 'acertou' | 'em-aberto';
  acertos?: number;
  tentativas?: number;
  ultima?: TentativaDaRevisao | null;
};

type Props = {
  s: Estilos;
  theme: Tema;
  itens: ItemDaRevisao[];
  indiceInicial: number;
  onFechar: () => void;
  revisarQuestoes: (questoes: QuestaoDaRevisao[]) => void;
  anotarMotivo?: (
    questaoId: unknown,
    tentativaId: unknown,
    dados: { motivo: string | null; nota: string }
  ) => Promise<string | null>;
};

const temaDaQuestao = (q: QuestaoDaRevisao) => q.topico || q.tema || '';

const tituloDaQuestao = (q: QuestaoDaRevisao) =>
  temaDaQuestao(q)
  || (q.exame ? `${q.exame}º Exame · questão ${q.numero}` : `Questão ${q.numero}`);

const rotuloDaUltima = (situacao: ItemDaRevisao['situacao']) => {
  if (situacao === 'errou') return 'Última tentativa: errou';
  if (situacao === 'acertou') return 'Última tentativa: acertou';
  return 'Sem tentativa registrada';
};

export default function VerQuestao({
  s, theme, itens, indiceInicial, onFechar, revisarQuestoes, anotarMotivo,
}: Props) {
  const idTitulo = useId();
  const fecharRef = useRef<HTMLButtonElement>(null);
  const [escopo, setEscopo] = useState<'disciplina' | 'todas'>('disciplina');
  const [atualId, setAtualId] = useState<number | string | undefined>(
    () => itens[indiceInicial]?.questao.id ?? itens[0]?.questao.id,
  );

  // O foco entra no fechar e volta para quem abriu o modal. `activeElement` é
  // lido na montagem: quando o efeito roda, o clique já tirou o foco do botão.
  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    fecharRef.current?.focus();
    return () => anterior?.focus?.();
  }, []);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        onFechar();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const atual = useMemo(
    () => itens.find((item) => String(item.questao.id) === String(atualId)) || itens[0],
    [itens, atualId],
  );

  const disciplinaAtual = atual?.questao.disciplina?.trim() || 'Sem classificação';

  const listaDoEscopo = useMemo(
    () => (escopo === 'todas'
      ? itens
      : itens.filter((item) => (item.questao.disciplina?.trim() || 'Sem classificação') === disciplinaAtual)),
    [itens, escopo, disciplinaAtual],
  );

  if (!atual) return null;

  const questao = atual.questao;
  const sit = SITUACAO[atual.situacao];
  const indice = Math.max(0, listaDoEscopo.findIndex((item) => String(item.questao.id) === String(questao.id)));
  const posicao = indice + 1;
  const total = listaDoEscopo.length;
  const ehUltima = indice >= total - 1;

  const procedencia = [disciplinaAtual];
  if (questao.exame) procedencia.push(`${questao.exame}º Exame`);
  if (questao.numero) procedencia.push(`questão ${questao.numero}`);

  const correta = typeof questao.correta === 'number' ? questao.correta : null;
  const resposta = typeof atual.ultima?.resposta === 'number' ? atual.ultima.resposta : null;

  const irPara = (novoIndice: number) => {
    const alvo = listaDoEscopo[novoIndice];
    if (alvo) setAtualId(alvo.questao.id);
  };

  const refazer = () => {
    onFechar();
    revisarQuestoes([questao]);
  };

  return (
    <div
      className="ver-questao-fundo"
      style={{
        position: 'fixed', inset: 0, zIndex: 600, padding: 24,
        background: 'rgba(28,27,25,.42)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        data-testid="ver-questao-modal"
        className="ver-questao-painel"
        style={{
          ...s.card,
          width: 'min(760px, 100%)',
          maxHeight: 'calc(100vh - 48px)',
          padding: 0,
          boxShadow: SOMBRA_ALTA,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 24px 16px', borderBottom: '1px solid #eeebe5' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={idTitulo} style={{ ...s.sectionTitle, fontSize: 18 }}>
              {tituloDaQuestao(questao)}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={s.pill(sit.bg, sit.fg)}>{rotuloDaUltima(atual.situacao)}</span>
              <span style={{ fontSize: 12.5, color: '#7a766f' }}>{procedencia.join(' · ')}</span>
              <span style={{ fontSize: 12, color: '#7a766f', fontVariantNumeric: 'tabular-nums' }}>{posicao} de {total}</span>
            </div>
          </div>
          <button
            ref={fecharRef}
            type="button"
            data-testid="fechar-ver-questao"
            aria-label="Fechar"
            title="Fechar"
            onClick={onFechar}
            style={{ ...s.btnOutline, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0, flex: 'none' }}
          >
            <Icon name="x" color="#4f4b45" size={16} style={undefined} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 22px' }}>
          <div data-testid="ver-questao-enunciado" style={{ fontSize: 13.5, color: '#4f4b45', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {questao.enunciado}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            {(questao.alternativas || []).map((texto, i) => {
              const eGabarito = i === correta;
              const eResposta = resposta != null && i === resposta;
              let fundo = '#fff';
              let borda = '#eeebe5';
              let cor = '#4f4b45';
              if (eGabarito) {
                fundo = '#E4EEE1';
                borda = '#4A7A4A60';
                cor = '#355E35';
              } else if (eResposta) {
                fundo = '#F6E4E1';
                borda = '#B4413A60';
                cor = '#8F2F29';
              }

              const rotulo = eGabarito && eResposta
                ? 'Gabarito · sua resposta na última tentativa'
                : eGabarito
                  ? 'Gabarito'
                  : eResposta
                    ? 'Sua resposta na última tentativa'
                    : null;

              return (
                <div
                  key={i}
                  data-testid={`ver-questao-alternativa-${i}`}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.5,
                    padding: '8px 10px', borderRadius: 8, background: fundo,
                    border: `1px solid ${borda}`, color: '#1c1b19',
                  }}
                >
                  {eGabarito ? (
                    <Icon name="check" color="#4A7A4A" size={14} style={undefined} />
                  ) : eResposta ? (
                    <Icon name="x" color="#B4413A" size={14} style={undefined} />
                  ) : (
                    <span aria-hidden="true" style={{ width: 14, flex: 'none' }} />
                  )}
                  <b style={{ color: cor, flex: 'none' }}>{String.fromCharCode(65 + i)})</b>
                  <span style={{ flex: 1 }}>{texto}</span>
                  {rotulo && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: cor, flex: 'none', textAlign: 'right' }}>
                      {rotulo}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {questao.explicacao && (
            <GabaritoComentado
              s={s}
              questao={questao}
              compacto
              className={undefined}
              style={{ marginTop: 18, padding: 12, background: '#faf9f6', borderRadius: 8 }}
              children={undefined}
            />
          )}

          {atual.situacao === 'errou' && atual.ultima?.id != null && anotarMotivo && (
            <div style={{ marginTop: 18 }}>
              {/* `key` pela tentativa: Anterior/Próxima trocam a questão sem
                  desmontar o modal, e sem a chave o rascunho de uma questão
                  (motivo marcado, nota escrita) apareceria na seguinte. */}
              <MotivoDoErro
                key={String(atual.ultima.id)}
                theme={theme}
                s={s}
                questaoId={questao.id}
                tentativa={atual.ultima}
                anotarMotivo={anotarMotivo}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: '1px solid #eeebe5' }}>
            <span style={{ fontSize: 12, color: '#7a766f' }}>Navegar em:</span>
            <button
              type="button"
              data-testid="navegar-disciplina"
              aria-pressed={escopo === 'disciplina'}
              onClick={() => setEscopo('disciplina')}
              style={{
                background: escopo === 'disciplina' ? theme.primarySoft : '#fff',
                color: escopo === 'disciplina' ? theme.primaryDark : '#4f4b45',
                border: escopo === 'disciplina' ? 'none' : '1px solid #e6e2da',
                borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600,
              }}
            >
              {disciplinaAtual} ({itens.filter((item) => (item.questao.disciplina?.trim() || 'Sem classificação') === disciplinaAtual).length})
            </button>
            <button
              type="button"
              data-testid="navegar-todas"
              aria-pressed={escopo === 'todas'}
              onClick={() => setEscopo('todas')}
              style={{
                background: escopo === 'todas' ? theme.primarySoft : '#fff',
                color: escopo === 'todas' ? theme.primaryDark : '#4f4b45',
                border: escopo === 'todas' ? 'none' : '1px solid #e6e2da',
                borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600,
              }}
            >
              Todas desta lista ({itens.length})
            </button>
          </div>
        </div>

        <div
          className="ver-questao-rodape"
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '14px 24px', borderTop: '1px solid #eeebe5' }}
        >
          <button
            type="button"
            data-testid="ver-questao-anterior"
            onClick={() => irPara(indice - 1)}
            disabled={indice <= 0}
            style={{ ...s.btnOutline, opacity: indice <= 0 ? 0.45 : 1 }}
          >
            Anterior
          </button>
          {ehUltima ? (
            <button type="button" data-testid="ver-questao-concluir" onClick={onFechar} style={s.btnOutline}>
              Concluir
            </button>
          ) : (
            <button type="button" data-testid="ver-questao-proxima" onClick={() => irPara(indice + 1)} style={s.btnOutline}>
              Próxima
            </button>
          )}
          <button
            type="button"
            data-testid="refazer-no-modal"
            onClick={refazer}
            style={{ ...s.btnPrimary, marginLeft: 'auto' }}
          >
            <Icon name="play" color="#fff" size={13} style={undefined} /> Refazer esta questão
          </button>
        </div>
      </div>
    </div>
  );
}
