import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Icon } from '../../lib/icons';
import { SOMBRA_ALTA } from '../../lib/theme';
import { alternarRisco } from '../../lib/cardDeQuestao';
import { ORIGEM_DO_REFAZER, resultadoDoRefazer, resumoDoRefazer } from '../../lib/refazer';
import MotivoDoErro from './MotivoDoErro';
import { BotaoRiscar, GabaritoComentado } from './CardDeQuestao';
import { SITUACAO } from './situacao';

// Leitura da questão e do gabarito — e, desde a fase 2, o "Refazer" dentro do
// próprio modal: a segunda chance grava como tentativa sem sair da Revisões. O
// componente é .tsx porque nasceu depois da migração gradual (ver CLAUDE.md);
// os .jsx de ícone/card continuam importáveis.

type Estilos = {
  card: CSSProperties;
  pill: (bg: string, fg: string) => CSSProperties;
  btnPrimary: CSSProperties;
  btnOutline: CSSProperties;
  sectionTitle: CSSProperties;
  statNum: CSSProperties;
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

// O que o modal manda para `registrar` (App.jsx) ao confirmar uma resposta:
// a mesma forma que o quiz usa, para os dois caminhos caírem no mesmo POST.
export type RegistroDaTentativa = {
  questaoId: number | string;
  correta: boolean;
  alternativa: number | null;
  tempoSeg: number | null;
  origem: string;
};

type Props = {
  s: Estilos;
  theme: Tema;
  itens: ItemDaRevisao[];
  indiceInicial: number;
  onFechar: () => void;
  modoInicial?: 'ler' | 'refazer';
  registrar?: (dados: RegistroDaTentativa) => Promise<unknown> | void;
  anotarMotivo?: (
    questaoId: unknown,
    tentativaId: unknown,
    dados: { motivo: string | null; nota: string }
  ) => Promise<string | null>;
};

const LETRA = (i: number) => String.fromCharCode(65 + i);

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
  s, theme, itens, indiceInicial, onFechar, modoInicial = 'ler', registrar, anotarMotivo,
}: Props) {
  const idTitulo = useId();
  const fecharRef = useRef<HTMLButtonElement>(null);

  // No refazer, a sequência recebida é a que a entrada definiu (o grupo ou a
  // lista filtrada) e "Próxima" tem de percorrer exatamente ela — por isso o
  // escopo começa em "todas". A leitura pura mantém o recorte por disciplina.
  const [escopo, setEscopo] = useState<'disciplina' | 'todas'>(
    modoInicial === 'refazer' ? 'todas' : 'disciplina',
  );
  const [atualId, setAtualId] = useState<number | string | undefined>(
    () => itens[indiceInicial]?.questao.id ?? itens[0]?.questao.id,
  );

  // 'ler' mostra o gabarito direto; 'refazer' esconde tudo atrás do painel e
  // deixa marcar; 'resultado' é o depois de confirmar — resultado e gabarito.
  const [modo, setModo] = useState<'ler' | 'refazer' | 'resultado'>(
    modoInicial === 'refazer' ? 'refazer' : 'ler',
  );
  const [marcada, setMarcada] = useState<number | null>(null);
  const [riscadas, setRiscadas] = useState<number[]>([]);
  const [resultado, setResultado] = useState<{ acertou: boolean; alternativa: number } | null>(null);
  // Resumo por questão, não por tentativa: voltar com "Anterior" e confirmar a
  // mesma de novo atualiza o veredito dela, sem contá-la duas vezes.
  const [resumo, setResumo] = useState<Record<string, boolean>>({});
  const [mostrandoResumo, setMostrandoResumo] = useState(false);
  // Quando a questão entrou no modo refazer, para o `tempo_seg` da tentativa.
  const inicioDoRefazer = useRef<number>(Date.now());

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

  // Trocar de questão recomeça a seleção, o risco e o cronômetro: sem isto, a
  // alternativa marcada na anterior apareceria marcada na seguinte.
  useEffect(() => {
    setMarcada(null);
    setRiscadas([]);
    setResultado(null);
    inicioDoRefazer.current = Date.now();
  }, [atualId]);

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
  const respostaAntiga = typeof atual.ultima?.resposta === 'number' ? atual.ultima.resposta : null;
  const respostaAgora = resultado ? resultado.alternativa : null;

  const refazendo = modo === 'refazer';
  const chavesDoResumo = Object.keys(resumo);
  const resumoFinal = resumoDoRefazer(
    chavesDoResumo.length,
    chavesDoResumo.filter((id) => resumo[id]).length,
  );

  const irPara = (novoIndice: number) => {
    const alvo = listaDoEscopo[novoIndice];
    if (!alvo) return;
    setAtualId(alvo.questao.id);
    // Numa sessão que já está refazendo, "Próxima" continua refazendo a
    // seguinte; só a leitura pura segue em leitura.
    setModo((atualModo) => (atualModo === 'ler' ? 'ler' : 'refazer'));
  };

  const entrarNoRefazer = () => {
    setMarcada(null);
    setRiscadas([]);
    setResultado(null);
    inicioDoRefazer.current = Date.now();
    setModo('refazer');
  };

  const alternarRiscoDe = (i: number) => setRiscadas((atuais) => alternarRisco(atuais, i));

  // Selecionar texto sobre o enunciado e soltar o mouse em cima de uma
  // alternativa termina uma seleção: isso não é marcar resposta. O clique
  // ignora quando ainda há seleção pendente.
  const selecionar = (i: number) => {
    if (String(window.getSelection()).length > 0) return;
    setMarcada(i);
  };

  const confirmar = () => {
    if (marcada == null) return;
    const acertou = correta !== null && marcada === correta;
    const tempoSeg = Math.max(0, Math.round((Date.now() - inicioDoRefazer.current) / 1000));

    setResultado({ acertou, alternativa: marcada });
    setResumo((atualResumo) => ({ ...atualResumo, [String(questao.id)]: acertou }));
    setModo('resultado');

    // Grava pela função do App (o mesmo POST do quiz), com a origem própria da
    // segunda chance — a tela já mostrou o resultado; o servidor confirma logo
    // atrás, e a questão sai de "Errei" sozinha depois disto.
    registrar?.({
      questaoId: questao.id,
      correta: acertou,
      alternativa: marcada,
      tempoSeg,
      origem: ORIGEM_DO_REFAZER,
    });
  };

  const concluir = () => {
    if (resumoFinal.houveRefeita) setMostrandoResumo(true);
    else onFechar();
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

        {mostrandoResumo ? (
          <div data-testid="resumo-refazer" style={{ flex: 1, overflowY: 'auto', padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#1c1b19' }}>
              <Icon name="repeat" color={theme.primary} size={18} style={undefined} /> Revisão concluída
            </div>
            <div style={{ fontSize: 13.5, color: '#4f4b45', lineHeight: 1.6 }}>
              Você refez {resumoFinal.refeitas} {resumoFinal.refeitas === 1 ? 'questão' : 'questões'}, acertou {resumoFinal.acertos} e {resumoFinal.continuamEmErrei} {resumoFinal.continuamEmErrei === 1 ? 'continua' : 'continuam'} em Errei.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Você refez', valor: resumoFinal.refeitas },
                { label: 'Acertou', valor: resumoFinal.acertos },
                { label: 'Continua em Errei', valor: resumoFinal.continuamEmErrei },
              ].map((st) => (
                <div key={st.label} style={{ padding: 12, borderRadius: 8, border: '1px solid #eeebe5' }}>
                  <div style={{ fontSize: 12.5, color: '#7a766f' }}>{st.label}</div>
                  <div style={{ ...s.statNum, fontSize: 26, marginTop: 4 }}>{st.valor}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              data-testid="resumo-voltar"
              onClick={onFechar}
              style={{ ...s.btnPrimary, alignSelf: 'flex-start' }}
            >
              Voltar para Revisões
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 22px' }}>
              <div data-testid="ver-questao-enunciado" style={{ fontSize: 13.5, color: '#4f4b45', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {questao.enunciado}
              </div>

              {refazendo ? (
                <div role="radiogroup" aria-label="Alternativas" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                  {(questao.alternativas || []).map((texto, i) => {
                    const marcadaAqui = marcada === i;
                    const riscada = riscadas.includes(i);
                    return (
                      <div
                        key={i}
                        role="radio"
                        aria-checked={marcadaAqui}
                        aria-label={`Alternativa ${LETRA(i)}`}
                        tabIndex={0}
                        data-testid={`ver-questao-alternativa-${i}`}
                        onClick={() => selecionar(i)}
                        onKeyDown={(evento) => {
                          // Só o próprio rádio responde: um Espaço na tesoura
                          // (que é um <button> dentro da linha) não pode
                          // riscar e marcar ao mesmo tempo.
                          if (evento.target !== evento.currentTarget) return;
                          // Enter e Espaço marcam, como em qualquer rádio.
                          if (evento.key === 'Enter' || evento.key === ' ' || evento.key === 'Spacebar') {
                            evento.preventDefault();
                            selecionar(i);
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, lineHeight: 1.5,
                          padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                          background: marcadaAqui ? theme.primarySoft : '#fff',
                          border: `1px solid ${marcadaAqui ? theme.primary : '#eeebe5'}`,
                          color: '#1c1b19',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 18, height: 18, borderRadius: '50%', flex: 'none', boxSizing: 'border-box',
                            border: marcadaAqui ? `5px solid ${theme.primary}` : '2px solid #d6d1c8',
                            background: '#fff',
                          }}
                        />
                        <b style={{ flex: 'none' }}>{LETRA(i)})</b>
                        <span style={{ flex: 1, textDecoration: riscada ? 'line-through' : 'none', color: riscada ? '#7a766f' : '#1c1b19' }}>{texto}</span>
                        <BotaoRiscar theme={theme} indice={i} riscada={riscada} onAlternar={alternarRiscoDe} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                  {(questao.alternativas || []).map((texto, i) => {
                    const eGabarito = i === correta;
                    const eResposta = respostaAgora != null ? i === respostaAgora : respostaAntiga != null && i === respostaAntiga;
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

                    let rotulo: string | null = null;
                    if (eGabarito && eResposta) {
                      rotulo = respostaAgora != null ? 'Gabarito · sua resposta agora' : 'Gabarito · sua resposta na última tentativa';
                    } else if (eGabarito) {
                      rotulo = 'Gabarito';
                    } else if (eResposta) {
                      rotulo = respostaAgora != null ? 'Sua resposta agora' : 'Sua resposta na última tentativa';
                    }

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
                        <b style={{ color: cor, flex: 'none' }}>{LETRA(i)})</b>
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
              )}

              {modo === 'resultado' && resultado && (
                <div
                  data-testid="resultado-refazer"
                  style={{
                    marginTop: 16, padding: '10px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: resultado.acertou ? '#E4EEE1' : '#F6E4E1',
                    color: resultado.acertou ? '#355E35' : '#8F2F29',
                  }}
                >
                  <Icon name={resultado.acertou ? 'circle-check' : 'circle-x'} color={resultado.acertou ? '#4A7A4A' : '#B4413A'} size={15} style={undefined} />
                  {resultadoDoRefazer(resultado.acertou)}
                </div>
              )}

              {refazendo ? (
                <div data-testid="gabarito-travado" style={{ marginTop: 18, padding: 14, background: '#faf9f6', borderRadius: 8, border: '1px solid #eeebe5' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1b19' }}>Gabarito e comentário travados</div>
                  <div style={{ fontSize: 12.5, color: '#7a766f', marginTop: 6, lineHeight: 1.5 }}>
                    Marque uma alternativa e confirme para ver o gabarito e o comentário. Riscar não responde.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button
                      type="button"
                      data-testid="ver-sem-responder"
                      onClick={() => setModo('ler')}
                      style={s.btnOutline}
                    >
                      Ver sem responder
                    </button>
                    <button
                      type="button"
                      data-testid="confirmar-resposta"
                      onClick={confirmar}
                      disabled={marcada == null}
                      style={{ ...s.btnPrimary, opacity: marcada == null ? 0.5 : 1 }}
                    >
                      Confirmar resposta
                    </button>
                  </div>
                </div>
              ) : (
                <>
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

                  {/* Só na leitura: depois de confirmar, `atual.ultima` ainda é a
                      tentativa ANTIGA (a sequência está congelada). O motivo
                      ficaria preso nela, e quem acabou de acertar veria
                      "Por que errei?". O erro novo se anota na lista. */}
                  {modo === 'ler' && atual.situacao === 'errou' && atual.ultima?.id != null && anotarMotivo && (
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
                </>
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
                <button type="button" data-testid="ver-questao-concluir" onClick={concluir} style={s.btnOutline}>
                  Concluir
                </button>
              ) : (
                <button type="button" data-testid="ver-questao-proxima" onClick={() => irPara(indice + 1)} style={s.btnOutline}>
                  Próxima
                </button>
              )}
              {modo === 'ler' && (
                <button
                  type="button"
                  data-testid="refazer-no-modal"
                  onClick={entrarNoRefazer}
                  style={{ ...s.btnPrimary, marginLeft: 'auto' }}
                >
                  <Icon name="play" color="#fff" size={13} style={undefined} /> Refazer esta questão
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
