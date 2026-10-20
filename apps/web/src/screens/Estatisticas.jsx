import { estatisticasDoPeriodo, formatarDuracao } from '../lib/metrics';
import { KpiCard, Rosca } from '../components/ui/Metricas';
import { TileDaMateria } from '../components/ui/Materia';

// Esta tela era inteira uma vitrine. Os quatro cartões de cima liam
//   const mult = { '7d': 0.25, '30d': 1, 'all': 3.4 }[range]
// e mostravam `1248 * mult` questões resolvidas, 73% de acerto e "+12% vs. o
// período anterior" — para qualquer conta, inclusive uma criada há um minuto.
// O seletor de disciplina não filtrava nada, e a rosca de dificuldade dividia
// o acervo em fácil/média/difícil, dado que a FGV não publica.
//
// Agora todo número vem de `estatisticasDoPeriodo`, que filtra as tentativas
// de verdade e só mostra comparação quando existe período anterior com dados.

const PERIODOS = { '7d': 7, '30d': 30, all: null };

export default function Estatisticas({ theme, s, data, filtros, setFiltros, usuarioTentativas, disciplinas }) {
  const questoes = data.QUESTOES || [];
  const lista = disciplinas || [];
  const dias = PERIODOS[filtros.range];
  const disciplinaFiltro = filtros.disc === 'Todas' ? null : filtros.disc;

  const est = estatisticasDoPeriodo(usuarioTentativas || {}, { questoes, dias, disciplina: disciplinaFiltro });

  // Cobertura: quantas questões distintas do acervo já foram respondidas.
  // Substitui a rosca de dificuldade, que media uma coisa que não existe.
  const acervoFiltrado = disciplinaFiltro
    ? questoes.filter((q) => (q.disciplina || 'Sem classificação') === disciplinaFiltro)
    : questoes;
  const respondidasNoAcervo = disciplinaFiltro
    ? (lista.find((d) => d.nome === disciplinaFiltro)?.respondidas || 0)
    : lista.reduce((soma, d) => soma + d.respondidas, 0);
  const coberturaPct = acervoFiltrado.length > 0
    ? Math.round((respondidasNoAcervo / acervoFiltrado.length) * 100)
    : 0;

  // Distribuição das RESPOSTAS por disciplina no período — substitui a barra
  // de bancas ("FGV 48%, CEBRASPE 39%") num acervo que só tem FGV.
  const porDisciplina = [...lista]
    .filter((d) => d.tentativas > 0 && (!disciplinaFiltro || d.nome === disciplinaFiltro))
    .sort((a, b) => b.tentativas - a.tentativas)
    .slice(0, 8);
  const maiorVolume = Math.max(1, ...porDisciplina.map((d) => d.tentativas));

  // Variação contra o período anterior de mesmo tamanho; `null` quando não há
  // período anterior com dados, e aí o cartão cala em vez de inventar "+100%".
  const comparado = dias != null ? `vs os ${dias} dias anteriores` : 'desde o início';
  const metrics = [
    { label: 'Respostas registradas', value: est.tentativas.toLocaleString('pt-BR'), variacao: est.delta.tentativas != null ? { valor: est.delta.tentativas } : null },
    { label: 'Taxa de acertos', value: est.pct != null ? `${est.pct}%` : '—', variacao: est.delta.pct != null ? { valor: est.delta.pct, texto: `${est.delta.pct >= 0 ? '+' : '−'}${Math.abs(est.delta.pct)} pp` } : null },
    { label: 'Tempo respondendo', value: formatarDuracao(est.tempoTotalSeg) || '—', variacao: est.delta.tempoTotalSeg != null ? { valor: est.delta.tempoTotalSeg } : null },
    { label: 'Dias ativos', value: est.diasAtivos, variacao: est.delta.diasAtivos != null ? { valor: est.delta.diasAtivos } : null },
  ];

  const seletor = { fontSize: 13, border: '1px solid rgba(0,0,0,.1)', borderRadius: 9, padding: '8px 12px', color: '#1c1b19', background: '#fff', minWidth: 200 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ ...s.card, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label htmlFor="estat-periodo" style={{ fontSize: 11.5, color: '#6a665f' }}>Período</label>
          <select id="estat-periodo" style={seletor} value={filtros.range} onChange={(e) => setFiltros({ range: e.target.value })}>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="all">Desde o início</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label htmlFor="estat-disciplina" style={{ fontSize: 11.5, color: '#6a665f' }}>Disciplina</label>
          <select id="estat-disciplina" style={seletor} value={filtros.disc} onChange={(e) => setFiltros({ disc: e.target.value })}>
            {['Todas', ...lista.map((d) => d.nome)].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 11.5, color: '#6a665f', marginLeft: 'auto', maxWidth: 320, lineHeight: 1.5 }}>
          Tudo nesta tela conta apenas as respostas que você registrou. O
          tempo é o que passou entre a questão abrir e a alternativa ser clicada.
        </div>
      </div>

      <div className="grade-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {metrics.map((m) => (
          <KpiCard key={m.label} rotulo={m.label} valor={m.value} variacao={m.variacao} contexto={m.variacao ? comparado : 'sem período anterior para comparar'} />
        ))}
      </div>

      {est.tentativas === 0 && (
        <div style={{ ...s.card, textAlign: 'center', padding: '32px 20px', color: '#6a665f', fontSize: 13.5, lineHeight: 1.6 }}>
          Nenhuma resposta registrada {filtros.range === 'all' ? 'até agora' : `nos últimos ${dias} dias`}
          {disciplinaFiltro ? ` em ${disciplinaFiltro}` : ''}.
          <br />Os números acima só existem depois que você responde questões.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Cobertura do acervo</h2>
          <div style={{ fontSize: 12, color: '#6a665f', marginTop: 4 }}>
            Questões distintas que você já respondeu ao menos uma vez.
          </div>
          <div style={{ marginTop: 16 }}>
            <Rosca
              fatias={[
                { rotulo: 'Respondidas', valor: respondidasNoAcervo, cor: theme.primary },
                { rotulo: 'Ainda não', valor: Math.max(0, acervoFiltrado.length - respondidasNoAcervo), cor: '#d9d5cc' },
              ]}
              centro={`${coberturaPct}%`}
              rotuloCentral="do acervo"
              descricao={`Você respondeu ${respondidasNoAcervo} de ${acervoFiltrado.length} questões do acervo${disciplinaFiltro ? ` de ${disciplinaFiltro}` : ''}`}
            />
          </div>
        </div>

        <div style={s.card}>
          <h2 style={s.sectionTitle}>Onde você mais respondeu</h2>
          {porDisciplina.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 16 }}>
              {porDisciplina.map((d) => (
                <div key={d.nome}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1c1b19', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '78%' }}><TileDaMateria materia={d.nome} tamanho={22} />{d.nome}</span>
                    <span style={{ color: '#6a665f' }}>{d.tentativas}</span>
                  </div>
                  <div style={{ ...s.progressTrack, marginTop: 5 }}>
                    <div style={{ width: Math.round((d.tentativas / maiorVolume) * 100) + '%', height: '100%', background: d.cor, borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: '#6a665f', marginTop: 14, lineHeight: 1.5 }}>
              Nada respondido ainda. Esta lista mostra em quais matérias você
              mais praticou, em número de respostas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
