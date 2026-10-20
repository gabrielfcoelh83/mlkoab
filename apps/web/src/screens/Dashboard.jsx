import { Link002 } from '@/components/ui/skiper-ui/skiper40';
import { Icon } from '../lib/icons';
import {
  metaDiaria,
  sequenciaAtual,
  seriesSemanais,
  respondidasNosUltimosDias,
  recordeDeSequencia,
  variacaoPercentual,
} from '../lib/metrics';
import { prioridadeDeEstudo } from '../lib/disciplinas';
import { NIVEIS, RESPOSTAS_PARA_MEDIR } from '../lib/areas';
import { KpiCard } from '../components/ui/Metricas';
import { TileDaMateria, LadoNivel } from '../components/ui/Materia';

function EmptyHint({ children }) {
  return <div style={{ fontSize: 12.5, color: '#6a665f', padding: '10px 0', lineHeight: 1.5 }}>{children}</div>;
}

const mmss = (seg) => (seg == null ? '—' : `${Math.floor(seg / 60)}m${String(seg % 60).padStart(2, '0')}s`);

// O painel em três camadas: a faixa de métricas (valor, variação contra a
// semana anterior e a curva), o que fazer agora, e a tabela completa por
// matéria no mesmo vocabulário de nível e peso das outras telas. Tudo sai das
// tentativas do servidor; nenhum número é escrito à mão.
export default function Dashboard({ theme, s, go, config, usuarioTentativas, resultados_historico, disciplinas, praticarDisciplina, acervo, dificuldades }) {
  const tentativas = usuarioTentativas || {};
  const resultados = resultados_historico || [];

  const meta = metaDiaria(config || {}, tentativas, resultados);
  const streak = sequenciaAtual(tentativas, resultados);
  const recorde = recordeDeSequencia(tentativas);

  // Janelas de 7 dias: "esta semana" é hoje e os 6 dias antes.
  const semanas = seriesSemanais(tentativas, 12);
  const atual = semanas[semanas.length - 1];
  const anterior = semanas[semanas.length - 2];
  const dias = respondidasNosUltimosDias(tentativas, 14);
  const taxas = semanas.map((x) => x.taxa).filter((x) => x != null);
  const tempos = semanas.map((x) => x.tempoMedioSeg).filter((x) => x != null);

  const prioridade = prioridadeDeEstudo(disciplinas || [], { dificuldades });
  const proxima = prioridade[0] || null;

  const piores = (disciplinas || [])
    .filter((d) => d.tentativas >= RESPOSTAS_PARA_MEDIR && d.pct != null)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 2 }}>
      <div className="grade-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <KpiCard
          testId="kpi-semana"
          rotulo="Questões na semana"
          valor={atual.total}
          variacao={variacaoPercentual(anterior.total, atual.total) != null ? { valor: variacaoPercentual(anterior.total, atual.total) } : null}
          contexto={anterior.total > 0 ? `vs ${anterior.total} na semana anterior` : 'últimos 7 dias'}
          curva={dias}
          corDaCurva={theme.primary}
        />
        <KpiCard
          testId="kpi-taxa"
          rotulo="Taxa de acerto"
          valor={atual.taxa != null ? `${atual.taxa}%` : '—'}
          variacao={atual.taxa != null && anterior.taxa != null ? { valor: atual.taxa - anterior.taxa, texto: `${atual.taxa - anterior.taxa >= 0 ? '+' : '−'}${Math.abs(atual.taxa - anterior.taxa)} pp` } : null}
          contexto={atual.taxa != null ? `${atual.acertos} de ${atual.total} nos últimos 7 dias` : 'sem respostas nos últimos 7 dias'}
          curva={taxas.length >= 2 ? taxas : undefined}
        />
        <KpiCard
          testId="kpi-tempo"
          rotulo="Tempo por questão"
          valor={mmss(atual.tempoMedioSeg)}
          variacao={variacaoPercentual(anterior.tempoMedioSeg, atual.tempoMedioSeg) != null ? { valor: variacaoPercentual(anterior.tempoMedioSeg, atual.tempoMedioSeg), menorEMelhor: true } : null}
          contexto="média dos últimos 7 dias"
          curva={tempos.length >= 2 ? tempos : undefined}
        />
        <KpiCard
          testId="kpi-sequencia"
          rotulo="Sequência"
          valor={`${streak.dias} ${streak.dias === 1 ? 'dia' : 'dias'}`}
          contexto={recorde > 0 ? `seu recorde é ${recorde}` : 'comece hoje'}
          dias={dias.map((n) => n > 0)}
          corDosDias={theme.primary}
        />
      </div>

      <div className="grade-dashboard" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={s.sectionTitle}>
              {proxima ? `Próximo passo: estudar ${proxima.nome}` : 'Próximo passo: praticar questões'}
            </h2>
            <Link002 as="button" onClick={() => go('cronograma')} style={s.link}>Ver a semana</Link002>
          </div>
          <p style={{ ...s.pageSub, margin: '4px 0 14px' }}>
            {proxima
              ? proxima.pontoFraco
                ? 'Você marcou como ponto fraco na sua ficha.'
                : proxima.pct != null
                  ? `${proxima.pct}% de acerto em ${proxima.tentativas} ${proxima.tentativas === 1 ? 'resposta' : 'respostas'}. ${proxima.proximo ? `Para subir: ${proxima.proximo}.` : ''}`
                  : `${proxima.total} ${proxima.total === 1 ? 'questão' : 'questões'} que você ainda não respondeu.`
              : acervo?.estado === 'carregando' ? 'Carregando o acervo.' : 'O acervo ainda não tem questões classificadas.'}
          </p>
          <div style={s.progressTrack}>
            <div style={{ width: `${meta.pct}%`, height: '100%', background: theme.primary, borderRadius: 5, transition: 'width 320ms var(--ease-out)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6a665f', marginTop: 6 }}>
            <span>{meta.respondidas} de {meta.meta} hoje</span>
            <span>{meta.batida ? 'meta de hoje batida' : `${meta.faltam} restantes`}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid #eeebe5', flexWrap: 'wrap' }}>
            {proxima && <TileDaMateria materia={proxima.nome} tamanho={36} />}
            <button style={s.btnPrimary} onClick={() => (proxima ? praticarDisciplina(proxima.nome) : go('questoes'))}>
              Estudar agora <Icon name="chevron-right" color="#fff" size={14} />
            </button>
          </div>
        </div>

        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={s.sectionTitle}>Menor desempenho</h2>
            <Link002 as="button" onClick={() => go('revisoes')} style={s.link}>revisar</Link002>
          </div>
          {piores.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {piores.map((d) => (
                <div key={d.nome}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1c1b19', minWidth: 0 }}><TileDaMateria materia={d.nome} tamanho={22} />{d.nome}</span>
                    <span style={{ color: '#8F2F29', fontWeight: 600 }}>{d.pct}%</span>
                  </div>
                  <div style={{ ...s.progressTrack, marginTop: 6 }}><div style={{ width: d.pct + '%', height: '100%', background: '#B4413A', borderRadius: 5 }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyHint>Com 10 respostas numa matéria, ela entra aqui se estiver entre as mais fracas.</EmptyHint>
          )}
        </div>
      </div>

      {/* Desempenho completo — todas as disciplinas DO ACERVO */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="titulo-desempenho-completo" style={s.sectionTitle}>Desempenho completo</h2>
          <Link002 as="button" onClick={() => go('desempenho')} style={s.link}>Abrir análise</Link002>
        </div>
        {(disciplinas || []).length === 0 ? (
          <EmptyHint>
            {acervo?.estado === 'carregando'
              ? 'Carregando o acervo…'
              : 'Nenhuma disciplina no acervo ainda. As matérias aparecem aqui conforme as provas são carregadas e classificadas.'}
          </EmptyHint>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table aria-labelledby="titulo-desempenho-completo" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6a665f', fontSize: 11.5 }}>
                  <th scope="col" style={{ padding: '8px 10px', fontWeight: 600 }}>Disciplina</th>
                  <th scope="col" style={{ padding: '8px 10px', fontWeight: 600 }}>Nível</th>
                  <th scope="col" style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Respondidas</th>
                  <th scope="col" style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Acerto</th>
                  <th scope="col" style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Vale na prova</th>
                </tr>
              </thead>
              <tbody>
                {disciplinas.map((d) => (
                  <tr key={d.nome} style={{ borderTop: '1px solid #eeebe5' }}>
                    <td style={{ padding: '8px 10px', color: '#1c1b19' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><TileDaMateria materia={d.nome} tamanho={26} />{d.nome}</span>
                    </td>
                    <td style={{ padding: '8px 10px' }}><span title={d.proximo}><LadoNivel nivel={d.nivel} cor={d.cor} comRotulo /></span></td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#4f4b45', fontVariantNumeric: 'tabular-nums' }}>{d.respondidas} de {d.total}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#1c1b19', fontVariantNumeric: 'tabular-nums' }}>
                      {d.tentativas >= RESPOSTAS_PARA_MEDIR ? `${d.pct}%` : <abbr title={`menos de ${RESPOSTAS_PARA_MEDIR} respostas`} style={{ color: '#6a665f', textDecoration: 'none' }}>—</abbr>}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#4f4b45', fontVariantNumeric: 'tabular-nums' }}>{d.peso ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
