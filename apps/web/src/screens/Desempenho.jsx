import { LabeledBars } from '../lib/charts';
import { KpiCard, GraficoArea, GraficoBarras, CartaoDeGrafico } from '../components/ui/Metricas';
import { TileDaMateria } from '../components/ui/Materia';
import { Icon } from '../lib/icons';
import { tempoPorDisciplina, formatarDuracao, seriesSemanais } from '../lib/metrics';

// A série de evolução era esta constante, igual para todo mundo:
//   const SERIES = { '7': [60, 66, 63, 70, 68, 74, 73], ... }
// Quem nunca tinha respondido nada via a mesma curva ascendente de quem
// estudava há meses. Agora cada ponto é uma semana de tentativas reais.

const SEMANAS = { '6': 6, '12': 12 };

function Vazio({ children }) {
  return <div style={{ fontSize: 12.5, color: '#6a665f', padding: '14px 0', lineHeight: 1.5 }}>{children}</div>;
}

// "Direito Processual Civil" não cabe embaixo de uma barra de 40px.
function abreviar(nome) {
  return nome
    .replace(/^Direito(s)? (Processual )?(d[aoe]s? )?/i, (m) => (/Processual/i.test(m) ? 'Proc. ' : ''))
    .slice(0, 12);
}

export default function Desempenho({ theme, s, perf, setPerf, usuarioTentativas, disciplinas, data, revisao, revisarQuestoes }) {
  const tentativas = usuarioTentativas || {};
  const questoes = data.QUESTOES || [];
  const lista = disciplinas || [];

  const comAtividade = lista.filter((d) => d.tentativas > 0);
  const dominadas = comAtividade.filter((d) => d.status === 'domina');
  const fracas = comAtividade.filter((d) => d.status === 'necessita');

  const totalTentativas = comAtividade.reduce((soma, d) => soma + d.tentativas, 0);
  const totalAcertos = comAtividade.reduce((soma, d) => soma + d.acertos, 0);
  const taxaGeral = totalTentativas > 0 ? Math.round((totalAcertos / totalTentativas) * 100) : null;

  const semanas = SEMANAS[perf.period] || 6;
  const serie = seriesSemanais(tentativas, semanas);
  const pontos = serie.filter((e) => e.taxa != null);
  const taxas = pontos.map((e) => e.taxa);
  const ultima = pontos[pontos.length - 1] || null;
  const penultima = pontos[pontos.length - 2] || null;
  const noPeriodo = serie.reduce((t, e) => t + e.total, 0);
  const porNivel = [1, 2, 3, 4].map((n) => lista.filter((d) => d.classificada !== false && d.nivel === n).length);

  const tempos = tempoPorDisciplina(tentativas, questoes).slice(0, 7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="grade-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <KpiCard
          rotulo="Taxa de acertos geral"
          valor={taxaGeral != null ? `${taxaGeral}%` : '—'}
          variacao={ultima && penultima ? { valor: ultima.taxa - penultima.taxa, texto: `${ultima.taxa - penultima.taxa >= 0 ? '+' : '−'}${Math.abs(ultima.taxa - penultima.taxa)} pp` } : null}
          contexto={totalTentativas > 0 ? `${totalAcertos} de ${totalTentativas} respostas` : 'sem respostas ainda'}
          curva={taxas.length >= 2 ? taxas : undefined}
          corDaCurva={theme.primary}
        />
        <KpiCard rotulo={`Respondidas em ${semanas} semanas`} valor={noPeriodo} contexto={`${comAtividade.length} de ${lista.length} matérias praticadas`} curva={serie.map((e) => e.total)} />
        <KpiCard rotulo="Matérias em Domínio" valor={porNivel[3]} contexto="80% de acerto ou mais, com 10 respostas" />
        <KpiCard rotulo="Matérias em Base" valor={porNivel[1]} contexto={`abaixo de 50% · ${porNivel[0]} ainda iniciando`} />
      </div>

      {fracas.length > 0 && (
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <h2 style={s.sectionTitle}><Icon name="trending-down" color="#B4413A" size={18} />Onde você mais perde ponto</h2>
            {revisao?.errei?.length > 0 && (
              <button
                style={s.btnOutline}
                onClick={() => revisarQuestoes(revisao.errei.map((x) => x.questao))}
              >
                Revisar as {revisao.errei.length} erradas
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {fracas.sort((a, b) => a.pct - b.pct).map((d) => (
              <div key={d.nome} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <TileDaMateria materia={d.nome} tamanho={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#1c1b19', fontWeight: 500 }}>{d.nome}</span>
                    <span style={{ color: '#B4413A', fontWeight: 700 }}>{d.pct}%</span>
                  </div>
                  <div style={{ ...s.progressTrack, marginTop: 5 }}><div style={{ width: d.pct + '%', height: '100%', background: '#B4413A', borderRadius: 5 }} /></div>
                </div>
                <span style={{ fontSize: 11.5, color: '#6a665f', width: 90, textAlign: 'right' }}>
                  {d.acertos}/{d.tentativas} respostas
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dominadas.length > 0 && (
        <div style={s.card}>
          <h2 style={s.sectionTitle}><Icon name="trending-up" color="#4A7A4A" size={18} />Você domina {dominadas.length} {dominadas.length === 1 ? 'disciplina' : 'disciplinas'}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {dominadas.sort((a, b) => b.pct - a.pct).map((d) => (
              <span key={d.nome} style={s.pill('#E4EEE1', '#355E35')}>{d.nome} · {d.pct}%</span>
            ))}
          </div>
        </div>
      )}

      <CartaoDeGrafico
        titulo="Evolução semana a semana"
        sub="Respondidas e acertos em janelas de 7 dias, terminando hoje."
        acoes={(
          <div role="radiogroup" aria-label="Período" style={{ display: 'flex', gap: 6 }}>
            {Object.keys(SEMANAS).map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={perf.period === p}
                onClick={() => setPerf({ period: p })}
                style={{ background: perf.period === p ? theme.primarySoft : 'transparent', color: perf.period === p ? theme.primaryDark : '#6a665f', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600 }}
              >
                {p} semanas
              </button>
            ))}
          </div>
        )}
      >
        {noPeriodo > 0 ? (
          <div className="grade-graficos" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 20, alignItems: 'end' }}>
            <GraficoArea
              rotulos={serie.map((e) => e.rotulo)}
              series={[
                { rotulo: 'Respondidas', valores: serie.map((e) => e.total), cor: '#1c1b19' },
                { rotulo: 'Acertos', valores: serie.map((e) => e.acertos), cor: theme.primary },
              ]}
              descricao={`Respondidas e acertos por semana nas últimas ${semanas} semanas: ${noPeriodo} respondidas no total`}
            />
            <GraficoBarras
              rotulos={serie.slice(-6).map((e) => e.rotulo)}
              series={[
                { rotulo: 'Acertos', valores: serie.slice(-6).map((e) => e.acertos), cor: '#4A7A4A' },
                { rotulo: 'Erros', valores: serie.slice(-6).map((e) => e.erros), cor: '#B4413A' },
              ]}
              descricao="Acertos e erros nas últimas 6 semanas"
            />
          </div>
        ) : (
          <Vazio>Nenhuma resposta registrada nas últimas semanas. Responda questões para o gráfico começar a existir.</Vazio>
        )}
      </CartaoDeGrafico>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Acertos e erros por disciplina</h2>
          {comAtividade.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {[...comAtividade].sort((a, b) => b.tentativas - a.tentativas).map((d) => (
                <div key={d.nome}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: '#1c1b19' }}>{d.nome}</span>
                    <span style={{ color: '#6a665f' }}>{d.acertos} acertos · {d.tentativas - d.acertos} erros</span>
                  </div>
                  <div style={{ display: 'flex', height: 9, borderRadius: 5, overflow: 'hidden', background: '#eeebe5' }}>
                    <div style={{ width: d.pct + '%', background: '#4A7A4A' }} />
                    <div style={{ width: (100 - d.pct) + '%', background: '#B4413A' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Vazio>Nada respondido ainda. Cada barra aqui é uma disciplina em que você já respondeu ao menos uma questão.</Vazio>
          )}
        </div>

        <div style={s.card}>
          <h2 style={s.sectionTitle}>Tempo médio por questão</h2>
          {tempos.length ? (
            <>
              <div style={{ marginTop: 16 }}>
                <LabeledBars
                  points={tempos.map((t) => t.mediaSeg)}
                  labels={tempos.map((t) => abreviar(t.disciplina))}
                  fullLabels={tempos.map((t) => t.disciplina)}
                  format={formatarDuracao}
                  color={theme.accent}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                {tempos.map((t) => (
                  <div key={t.disciplina} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#4f4b45', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{t.disciplina}</span>
                    <span style={{ fontWeight: 600, color: '#1c1b19' }}>{formatarDuracao(t.mediaSeg)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Vazio>
              O tempo é cronometrado entre a questão aparecer e você clicar na alternativa. Responda algumas para esta comparação fazer sentido.
            </Vazio>
          )}
        </div>
      </div>
    </div>
  );
}
