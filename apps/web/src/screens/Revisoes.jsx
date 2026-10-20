import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { normalizar } from '../lib/texto';
import { agruparPorDisciplina, refeitasHoje } from '../lib/revisao';
import { TIPOS_DE_MARCADOR, contarPorTipo, dadosDoMarcador } from '../lib/marcadores';
import { congelarSequencia } from '../lib/refazer';
import MotivoDoErro from '../components/ui/MotivoDoErro';
import VerQuestao from '../components/ui/VerQuestao';
import BotaoMarcador from '../components/ui/BotaoMarcador';

// A tela serve aos erros: a lista abre em "Errei" e cada grupo de disciplina
// pode ser refeito de uma vez. As abas "Para revisar" e "Nunca respondi"
// saíram — a primeira repetia erradas e marcadas, a segunda não é material de
// revisão. Um `rev.tab` antigo salvo no navegador cai em "Errei" pelo fallback
// de `ABAS[0]`, exceto o antigo "favoritas", que vira "Marcadores".

const ABAS = [
  { key: 'errei', label: 'Errei', lista: (r) => r.errei },
  { key: 'marcadores', label: 'Marcadores', lista: (r) => r.marcadas },
  { key: 'menor', label: 'Menor desempenho', lista: (r) => r.menorDesempenho },
];

const CHAVE_DA_LEGENDA = 'ma-questoes-marcadores-legenda-v1';

const temaDaQuestao = (q) => q.topico || q.tema || '';

const tituloDaQuestao = (q) => temaDaQuestao(q)
  || (q.exame ? `${q.exame}º Exame · questão ${q.numero}` : (q.numero ? `Questão ${q.numero}` : 'Sem classificação'));

const disciplinaDaQuestao = (q) => q.disciplina?.trim() || 'Sem classificação';

function metaDoCartao(item, abaKey) {
  const q = item.questao;
  const partes = [];
  if (q.exame) partes.push(`${q.exame}º Exame`);
  if (q.numero) partes.push(`questão ${q.numero}`);
  partes.push(`${item.acertos}/${item.tentativas} ${item.tentativas === 1 ? 'tentativa' : 'tentativas'}`);
  if (abaKey === 'marcadores') {
    partes.push(item.situacao === 'errou'
      ? 'errou na última'
      : item.situacao === 'acertou' ? 'acertou na última' : 'sem tentativa');
  }
  return partes.join(' · ');
}

function metaDoGrupo(abaKey, itensDoGrupo) {
  const n = itensDoGrupo.length;
  if (abaKey === 'errei') {
    const semMotivo = itensDoGrupo.filter((item) => !item.ultima?.motivo).length;
    const base = `${n} ${n === 1 ? 'errada' : 'erradas'}`;
    // O "sem motivo" só aparece quando há algum: zero vira ruído no cabeçalho.
    return semMotivo > 0 ? `${base} · ${semMotivo} sem motivo` : base;
  }
  if (abaKey === 'marcadores') return `${n} ${n === 1 ? 'marcada' : 'marcadas'}`;
  return `${n} ${n === 1 ? 'questão' : 'questões'}`;
}

// Ladrilho do ícone: fundo com um véu da cor e o ícone na própria cor, em vez
// de ícone branco sobre degradê saturado.
function iw(_from, to) {
  return { width: 36, height: 36, borderRadius: 8, background: `${to}14`, color: to, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' };
}

function dot(c) {
  return { width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' };
}

export default function Revisoes({ theme, s, rev, setRev, revisao, disciplinas, registrar, anotarMotivo, usuarioTentativas, marcadores, definirMarcador, removerMarcador }) {
  const resumo = revisao.resumo;

  // Um `rev.tab` antigo ("favoritas") abre a aba nova sem reescrever o estado
  // salvo; o clique em qualquer aba já grava a chave atual.
  const abaKey = rev.tab === 'favoritas' ? 'marcadores' : rev.tab;
  const aba = ABAS.find((a) => a.key === abaKey) || ABAS[0];
  const itens = aba.lista(revisao) || [];

  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todas');
  const [modal, setModal] = useState(null);
  const [legendaAberta, setLegendaAberta] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_DA_LEGENDA) !== '1';
    } catch {
      return true;
    }
  });

  // A legenda é aberta na primeira visita à aba Marcadores; depois disso, o
  // estado escolhido pela pessoa manda. A flag é gravada assim que a aba abre,
  // mesmo que ela feche o bloco em seguida.
  useEffect(() => {
    if (aba.key !== 'marcadores') return;
    try {
      localStorage.setItem(CHAVE_DA_LEGENDA, '1');
    } catch {
      // sem localStorage a legenda abre de novo; não é motivo para quebrar a tela
    }
  }, [aba.key]);

  const contagem = contarPorTipo(itens.map((item) => item.marcador).filter(Boolean));
  const tipoAtivo = filtroTipo === 'todas' || contagem[filtroTipo] > 0 ? filtroTipo : 'todas';

  const disciplinasDaAba = [...new Set(itens.map((item) => disciplinaDaQuestao(item.questao)))];
  // Aba trocada pode não ter a disciplina que estava filtrada; nesse caso o
  // filtro volta a "todas" sem precisar de efeito que limpe o estado.
  const filtroAtivo = filtro === 'todas' || disciplinasDaAba.includes(filtro) ? filtro : 'todas';

  const termo = normalizar(busca.trim());
  const filtrados = itens.filter((item) => {
    if (filtroAtivo !== 'todas' && disciplinaDaQuestao(item.questao) !== filtroAtivo) return false;
    if (aba.key === 'marcadores' && tipoAtivo !== 'todas' && item.marcador?.tipo !== tipoAtivo) return false;
    if (!termo) return true;
    return normalizar(item.questao.enunciado).includes(termo)
      || normalizar(temaDaQuestao(item.questao)).includes(termo);
  });

  const grupos = agruparPorDisciplina(filtrados);
  const refeitas = refeitasHoje(usuarioTentativas || {});

  const stats = [
    {
      iconWrap: iw('#B4413A', '#9E3630'), icon: 'circle-x',
      value: resumo.erros, label: 'Errei na última vez',
      contexto: `${resumo.errosSemMotivo} sem motivo anotado`,
    },
    {
      iconWrap: iw('#B07A1F', '#94661A'), icon: 'repeat',
      value: refeitas.refeitas, label: 'Refeitas hoje',
      contexto: refeitas.acertos > 0
        ? `${refeitas.acertos} ${refeitas.acertos === 1 ? 'acerto' : 'acertos'} na segunda chance`
        : 'segunda chance de hoje',
    },
    {
      iconWrap: iw('#4A7A4A', '#3E6B3E'), icon: 'check',
      value: resumo.acertos, label: 'Acertei na última vez',
      contexto: 'já saíram de Errei',
    },
  ];

  // A rosca mede o acervo inteiro: acertadas, erradas e ainda em aberto. A
  // anterior era `conic-gradient(#4A7A4A 0% 68%, ...)` — um desenho fixo.
  const totalAcervo = Math.max(1, resumo.acervo);
  const fatiaAcertos = Math.round((resumo.acertos / totalAcervo) * 100);
  const fatiaErros = Math.round((resumo.erros / totalAcervo) * 100);

  const piores = (disciplinas || [])
    .filter((d) => d.pct != null)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  // O modal recebe uma cópia da sequência tirada na abertura: gravar uma
  // tentativa muda `usuarioTentativas` e a questão pode sair de "Errei" no
  // meio da sessão, e sem a cópia a lista sumiria debaixo do modal (pulando ou
  // fechando sozinho). `modo` decide se ele abre lendo ou já refazendo.
  const abrirModal = (lista, indice, modo) => {
    const sequencia = congelarSequencia(lista, indice);
    if (sequencia.itens.length === 0) return;
    setModal({ itens: sequencia.itens, indice: sequencia.indice, modo });
  };

  const abrirLeitura = (indice) => abrirModal(filtrados, indice, 'ler');
  const abrirRefazer = (lista, indice) => abrirModal(lista, indice, 'refazer');

  const vazioDaAba = {
    errei: 'Nenhuma questão errada na última tentativa. Quando você errar alguma, ela aparece aqui.',
    marcadores: 'Você ainda não marcou nenhuma questão. Use a bandeira ao lado de uma questão para dizer por que ela deve voltar.',
    menor: 'Ainda não há histórico para ordenar por desempenho.',
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {stats.map((st) => (
              <div key={st.label} style={s.card}>
                <div style={{ fontSize: 12.5, color: '#7a766f' }}>{st.label}</div>
                <div style={{ ...s.statNum, fontSize: 30, marginTop: 6 }}>{st.value}</div>
                <div data-testid={`stat-contexto-${st.label}`} style={{ fontSize: 11.5, color: '#7a766f', marginTop: 4 }}>{st.contexto}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {ABAS.map((t) => {
              const quantas = (t.lista(revisao) || []).length;
              return (
                <button
                  key={t.key}
                  data-testid={`aba-${t.key}`}
                  onClick={() => setRev({ tab: t.key })}
                  style={{
                    background: aba.key === t.key ? theme.primarySoft : '#fff',
                    color: aba.key === t.key ? theme.primaryDark : '#4f4b45',
                    border: aba.key === t.key ? 'none' : '1px solid rgba(0,0,0,.08)',
                    borderRadius: 10, padding: '9px 14px', fontSize: 12.5, fontWeight: 600,
                  }}
                >
                  {t.label} <span style={{ opacity: 0.6 }}>{quantas}</span>
                </button>
              );
            })}

            {filtrados.length > 0 && (
              <button
                data-testid="revisar-tudo"
                style={{ ...s.btnPrimary, marginLeft: 'auto' }}
                onClick={() => abrirRefazer(filtrados, 0)}
              >
                <Icon name="play" color="#fff" size={13} /> Refazer {filtrados.length === 1 ? 'a questão' : `as ${filtrados.length}`}
              </button>
            )}
          </div>

          {aba.key === 'marcadores' && (
            <div data-testid="filtros-marcador" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                data-testid="filtro-marcador-todas"
                aria-pressed={tipoAtivo === 'todas'}
                onClick={() => setFiltroTipo('todas')}
                style={{
                  background: tipoAtivo === 'todas' ? theme.primarySoft : '#fff',
                  color: tipoAtivo === 'todas' ? theme.primaryDark : '#4f4b45',
                  border: tipoAtivo === 'todas' ? 'none' : '1px solid #e6e2da',
                  borderRadius: 8, padding: '7px 11px', fontSize: 12, fontWeight: 600,
                }}
              >
                Todas <span style={{ opacity: 0.65, fontVariantNumeric: 'tabular-nums' }}>{contagem.todas}</span>
              </button>

              {TIPOS_DE_MARCADOR.map((tipo) => {
                const ativo = tipoAtivo === tipo.tipo;
                return (
                  <button
                    key={tipo.tipo}
                    type="button"
                    data-testid={`filtro-marcador-${tipo.tipo}`}
                    aria-pressed={ativo}
                    onClick={() => setFiltroTipo(tipo.tipo)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: ativo ? `${tipo.cor}14` : '#fff',
                      color: tipo.cor,
                      border: ativo ? `1px solid ${tipo.cor}55` : '1px solid #e6e2da',
                      borderRadius: 8, padding: '7px 11px', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <Icon name={tipo.icone} color={tipo.cor} size={12} />
                    {tipo.rotulo}
                    <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{contagem[tipo.tipo]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {aba.key === 'marcadores' && (
            <details
              data-testid="como-funcionam-marcadores"
              open={legendaAberta}
              onToggle={(evento) => setLegendaAberta(evento.currentTarget.open)}
              style={{ ...s.card, padding: '13px 16px' }}
            >
              <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: '#1c1b19' }}>
                Como funcionam os marcadores
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {TIPOS_DE_MARCADOR.map((tipo) => (
                  <div key={tipo.tipo} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ ...dot(tipo.cor), marginTop: 5 }} aria-hidden="true" />
                    <Icon name={tipo.icone} color={tipo.cor} size={14} style={{ marginTop: 1 }} />
                    <div style={{ fontSize: 12.5, color: '#4f4b45', lineHeight: 1.45 }}>
                      <b style={{ color: '#1c1b19' }}>{tipo.rotulo}</b> — {tipo.descricao}
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #eeebe5', paddingTop: 10, marginTop: 2, fontSize: 12, color: '#5f5b55', lineHeight: 1.55 }}>
                  Um marcador por questão: escolher outro motivo substitui o anterior.
                  Dúvida aceita uma nota curta. Os marcadores ficam salvos na sua conta.
                </div>
              </div>
            </details>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="search"
              data-testid="busca-revisao"
              aria-label="Buscar por enunciado ou tema"
              placeholder="Buscar por enunciado ou tema"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                flex: '1 1 240px', minWidth: 0, font: 'inherit', fontSize: 13, color: '#1c1b19',
                border: '1px solid #e6e2da', borderRadius: 7, padding: '9px 12px', background: '#fff',
              }}
            />
            <select
              data-testid="filtro-disciplina"
              aria-label="Filtrar por disciplina"
              value={filtroAtivo}
              onChange={(e) => setFiltro(e.target.value)}
              style={{
                flex: '0 1 240px', font: 'inherit', fontSize: 13, color: '#1c1b19',
                border: '1px solid #e6e2da', borderRadius: 7, padding: '9px 12px', background: '#fff',
              }}
            >
              <option value="todas">Todas as disciplinas</option>
              {disciplinasDaAba.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {itens.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px 20px', color: '#7a766f', fontSize: 13.5, lineHeight: 1.6 }}>
              {vazioDaAba[aba.key]}
            </div>
          ) : filtrados.length === 0 ? (
            <div data-testid="revisao-sem-filtro" style={{ ...s.card, textAlign: 'center', padding: '40px 20px', color: '#7a766f', fontSize: 13.5, lineHeight: 1.6 }}>
              Nenhuma questão com esse filtro.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {grupos.map((grupo, gi) => (
                <div key={grupo.disciplina} data-testid="grupo-revisao" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <h3 data-testid="grupo-disciplina" style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1c1b19' }}>{grupo.disciplina}</h3>
                    <span data-testid="grupo-meta" style={{ fontSize: 12, color: '#7a766f' }}>{metaDoGrupo(aba.key, grupo.itens)}</span>
                    <button
                      data-testid={`refazer-grupo-${gi}`}
                      style={{ ...s.btnOutline, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => abrirRefazer(grupo.itens, 0)}
                    >
                      <Icon name="play" color="#1c1b19" size={12} /> Refazer {grupo.itens.length === 1 ? 'a questão' : `as ${grupo.itens.length}`}
                    </button>
                  </div>

                  {grupo.itens.map((item) => {
                    const q = item.questao;
                    const dados = item.marcador ? dadosDoMarcador(item.marcador.tipo) : null;
                    // O motivo é da tentativa errada; sem id (resposta ainda não
                    // confirmada pelo servidor) não há onde gravá-lo.
                    const podeAnotar = item.situacao === 'errou' && item.ultima?.id != null && anotarMotivo;

                    return (
                      <div key={q.id} data-testid={`revisao-item-${q.id}`} style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="revisao-cabecalho" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1b19' }}>{tituloDaQuestao(q)}</div>
                            <div data-testid={`revisao-meta-${q.id}`} style={{ fontSize: 11.5, color: '#7a766f', marginTop: 3 }}>{metaDoCartao(item, aba.key)}</div>
                            <div
                              data-testid={`revisao-enunciado-${q.id}`}
                              style={{
                                fontSize: 13, color: '#4f4b45', marginTop: 6, lineHeight: 1.5,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              }}
                            >
                              {q.enunciado}
                            </div>
                          </div>
                          <div className="revisao-acoes" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
                            {definirMarcador && (
                              <BotaoMarcador
                                s={s}
                                questaoId={q.id}
                                marcador={item.marcador}
                                onSalvar={definirMarcador}
                                onApagar={removerMarcador}
                              />
                            )}
                            <button
                              data-testid={`revisar-${q.id}`}
                              style={{ ...s.btnOutline, display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}
                              onClick={() => abrirRefazer(filtrados, filtrados.findIndex((x) => String(x.questao.id) === String(q.id)))}
                            >
                              <Icon name="play" color="#1c1b19" size={12} /> Refazer
                            </button>
                          </div>
                        </div>
                        {item.marcador && dados && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span
                              data-testid={`marcador-chip-${q.id}`}
                              style={{
                                ...s.pill(`${dados.cor}14`, dados.cor),
                                display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
                              }}
                            >
                              <Icon name={dados.icone} color={dados.cor} size={11} /> {dados.rotulo}
                            </span>
                            {item.marcador.tipo === 'duvida' && item.marcador.nota && (
                              <div data-testid={`marcador-nota-texto-${q.id}`} style={{ fontSize: 12, color: '#4f4b45', lineHeight: 1.5 }}>
                                Sua dúvida: {item.marcador.nota}
                              </div>
                            )}
                          </div>
                        )}
                        {podeAnotar && (
                          // `key` pela tentativa: errar de novo traz outra tentativa, e
                          // o formulário recomeça vazio em vez de herdar o estado da
                          // anterior.
                          <MotivoDoErro
                            key={item.ultima.id}
                            theme={theme}
                            s={s}
                            questaoId={q.id}
                            tentativa={item.ultima}
                            anotarMotivo={anotarMotivo}
                          />
                        )}
                        <button
                          data-testid={`ver-questao-${q.id}`}
                          onClick={() => abrirLeitura(filtrados.findIndex((x) => String(x.questao.id) === String(q.id)))}
                          style={{ ...s.link, alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Ver questão e gabarito
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={s.card}>
            <h2 style={s.sectionTitle}>Onde você está no acervo</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: `conic-gradient(#4A7A4A 0% ${fatiaAcertos}%, #B4413A ${fatiaAcertos}% ${fatiaAcertos + fatiaErros}%, #e6e2da ${fatiaAcertos + fatiaErros}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1b19' }}>{resumo.pct != null ? `${resumo.pct}%` : '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={dot('#4A7A4A')}></span>Acertei <b style={{ marginLeft: 'auto' }}>{resumo.acertos}</b></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={dot('#B4413A')}></span>Errei <b style={{ marginLeft: 'auto' }}>{resumo.erros}</b></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={dot('#cfcac2')}></span>Em aberto <b style={{ marginLeft: 'auto' }}>{resumo.emAberto}</b></div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: '#7a766f', marginTop: 12, lineHeight: 1.5 }}>
              Conta a ÚLTIMA tentativa de cada uma das {resumo.acervo} questões do acervo — quem errou e depois acertou já saiu da lista de revisão.
            </div>
          </div>

          <div style={s.card}>
            <h2 style={s.sectionTitle}>Disciplinas com menor desempenho</h2>
            {piores.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 14 }}>
                {piores.map((d) => (
                  <div key={d.nome}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#1c1b19', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{d.nome}</span>
                      <span style={{ color: '#7a766f' }}>{d.pct}%</span>
                    </div>
                    <div style={{ ...s.progressTrack, marginTop: 5 }}><div style={{ width: d.pct + '%', height: '100%', background: '#B4413A', borderRadius: 5 }} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: '#7a766f', marginTop: 12, lineHeight: 1.5 }}>
                Nenhuma disciplina tem resposta registrada ainda.
              </div>
            )}
          </div>

          <div style={{ ...s.card, borderLeft: `3px solid ${theme.accent}`, borderRadius: 8, padding: '16px 18px', color: '#1c1b19' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="lightbulb" color={theme.accent} size={18} />Sobre os marcadores
            </div>
            <div style={{ fontSize: 12.5, marginTop: 8, color: '#5f5b55', lineHeight: 1.5 }}>
              Os marcadores ficam salvos na sua conta e aparecem em qualquer aparelho.
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <VerQuestao
          s={s}
          theme={theme}
          itens={modal.itens}
          indiceInicial={modal.indice}
          modoInicial={modal.modo}
          onFechar={() => setModal(null)}
          registrar={registrar}
          anotarMotivo={anotarMotivo}
          marcadores={marcadores}
          definirMarcador={definirMarcador}
          removerMarcador={removerMarcador}
        />
      )}
    </>
  );
}
