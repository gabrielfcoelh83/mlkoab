import { Icon } from '../lib/icons';
import { temasDaDisciplina } from '../lib/disciplinas';
import { AREAS, iconeDaMateria, RESPOSTAS_PARA_MEDIR } from '../lib/areas';
import { TileDaMateria, LadoNivel } from '../components/ui/Materia';
import ColunasDaProva from '../components/ui/ColunasDaProva';

// A lista era fixa: oito matérias com "35h 20m estudadas" e "85% de
// aproveitamento" escritos no código. Abrir uma delas mostrava cinco tópicos
// genéricos ("Fundamentos", "Princípios gerais", "Casos práticos") com
// percentuais gerados por `(nome.length * 7 + i * 13) % 100` — literalmente o
// tamanho do nome da disciplina virando nota.
//
// Agora: as disciplinas são as do acervo, os temas são os que a classificação
// atribuiu a cada questão, e os percentuais são as suas respostas.


// Três blocos: "Foco agora" (onde se perde mais ponto), o mapa da prova em
// colunas e a lista por área, recolhível, com uma linha curta por matéria.
// O simulado por matéria saiu: simulado simula a prova inteira. Treinar uma
// matéria é o "Praticar" daqui ou o caderno em Questões.
export default function Disciplinas({ theme, s, data, disc, setDisc, disciplinas, usuarioTentativas, praticarDisciplina, revisarQuestoes }) {
  const lista = disciplinas || [];
  const questoes = data.QUESTOES || [];
  const aberta = lista.find((d) => d.nome === disc.openNome) || null;

  if (!aberta) {
    if (lista.length === 0) {
      return (
        <div style={{ ...s.card, textAlign: 'center', padding: '48px 24px', color: '#6a665f', fontSize: 13.5, lineHeight: 1.6 }}>
          O acervo ainda não tem questões carregadas.
          <br />As disciplinas aparecem aqui conforme as provas entram.
        </div>
      );
    }

    // Foco agora: as matérias que mais custam na prova (peso × o que se erra).
    // Sem nenhuma matéria medida, cai na que mais vale entre as não iniciadas.
    const medidas = lista.filter((d) => d.perda != null && d.perda > 0).sort((x, y) => y.perda - x.perda);
    const foco = (medidas.length > 0
      ? medidas
      : lista.filter((d) => d.peso != null).sort((x, y) => y.peso - x.peso)
    ).slice(0, 3);

    const grupos = [
      ...AREAS.map((area) => ({ chave: area.chave, nome: area.nome, cor: area.cor, itens: lista.filter((d) => d.area === area.chave) })),
      { chave: 'outras', nome: 'Outras', cor: '#6a665f', itens: lista.filter((d) => d.area == null) },
    ].filter((g) => g.itens.length > 0);
    const recolhidas = new Set(disc.recolhidas || []);
    const alternar = (chave) => {
      const proximas = new Set(recolhidas);
      if (proximas.has(chave)) proximas.delete(chave); else proximas.add(chave);
      setDisc({ recolhidas: [...proximas] });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section style={s.card} data-testid="foco-agora">
          <h2 style={s.sectionTitle}>Foco agora</h2>
          <p style={{ ...s.pageSub, margin: '4px 0 14px' }}>
            {medidas.length > 0
              ? 'As matérias em que você mais deixa questões na prova, pelo que valem e pelo seu acerto.'
              : 'Ainda sem acerto medido: comece pelas matérias que mais valem na prova.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {foco.map((d, i) => (
              <div key={d.nome} style={{ border: '1px solid #eeebe5', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <TileDaMateria materia={d.nome} tamanho={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1c1b19' }}>{d.nome}</div>
                    <div style={{ fontSize: 12, color: '#6a665f' }}>
                      {d.perda != null ? `deixa cerca de ${String(d.perda).replace('.', ',')} de ${d.peso}` : `vale ${d.peso} na prova`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4f4b45' }}>
                  <LadoNivel nivel={d.nivel} cor={d.cor} comRotulo />
                </div>
                <div style={{ fontSize: 12, color: '#6a665f', lineHeight: 1.45 }}>{d.proximo}</div>
                <button
                  data-testid={`foco-praticar-${i}`}
                  onClick={() => praticarDisciplina(d.nome)}
                  style={i === 0 ? { ...s.btnPrimary, justifyContent: 'center', marginTop: 'auto' } : { ...s.btnOutline, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 'auto' }}
                >
                  <Icon name="play" color={i === 0 ? '#fff' : '#1c1b19'} size={12} /> Praticar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section style={s.card} data-testid="mapa-da-prova">
          <h2 style={s.sectionTitle}>Mapa da prova</h2>
          <div style={{ marginTop: 6 }}>
            <ColunasDaProva materias={lista} />
          </div>
        </section>

        <section style={{ ...s.card, padding: '8px 0' }} data-testid="lista-disciplinas">
          {grupos.map((g) => {
            const aberto = !recolhidas.has(g.chave);
            const peso = g.itens.reduce((t, d) => t + (d.peso || 0), 0);
            return (
              <div key={g.chave} style={{ borderTop: g === grupos[0] ? 'none' : '1px solid #eeebe5' }}>
                <button
                  type="button"
                  aria-expanded={aberto}
                  data-testid={`area-${g.chave}`}
                  onClick={() => alternar(g.chave)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <i style={{ width: 9, height: 9, borderRadius: 2, background: g.cor, display: 'block', flex: 'none' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1c1b19' }}>{g.nome}</span>
                  <span style={{ fontSize: 12, color: '#6a665f' }}>
                    {g.itens.length} {g.itens.length === 1 ? 'matéria' : 'matérias'}{peso > 0 ? ` · vale ${peso} na prova` : ''}
                  </span>
                  <Icon name="chevron-down" color="#6a665f" size={16} style={{ marginLeft: 'auto', transform: aberto ? 'none' : 'rotate(-90deg)', transition: 'transform 160ms var(--ease-out)' }} />
                </button>
                {aberto && g.itens.map((d) => (
                  <div key={d.nome} className="linha-disciplina" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1.1fr) 64px 70px auto', gap: 12, alignItems: 'center', padding: '8px 20px' }}>
                    <button
                      data-testid="ver-temas"
                      onClick={() => setDisc({ openNome: d.nome })}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
                    >
                      <TileDaMateria materia={d.nome} tamanho={28} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1c1b19', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: '#6a665f' }}>{d.respondidas} de {d.total} respondidas</span>
                      </span>
                    </button>
                    <span title={d.proximo}><LadoNivel nivel={d.nivel} cor={d.cor} comRotulo /></span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: d.pct == null ? '#6a665f' : '#1c1b19', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {d.tentativas >= RESPOSTAS_PARA_MEDIR ? `${d.pct}%` : '—'}
                    </span>
                    <span style={{ fontSize: 12, color: '#6a665f', textAlign: 'right' }}>{d.peso != null ? `vale ${d.peso}` : ''}</span>
                    <button
                      data-testid="praticar-disciplina"
                      onClick={() => praticarDisciplina(d.nome)}
                      style={{ ...s.btnOutline, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px' }}
                    >
                      <Icon name="play" color="#1c1b19" size={11} /> Praticar
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  const temas = temasDaDisciplina(questoes, usuarioTentativas, aberta.nome);
  const naoRevisadas = aberta.semRevisao;

  return (
    <div style={s.card}>
      <button style={{ background: 'none', border: 'none', color: theme.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => setDisc({ openNome: null })}>
        ← Voltar às disciplinas
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 56, height: 56, borderRadius: 10, background: `${aberta.cor}1e`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon name={iconeDaMateria(aberta.nome)} color={aberta.cor} size={28} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#1c1b19' }}>{aberta.nome}</div>
          <div style={{ fontSize: 13, color: '#6a665f' }}>
            {aberta.total} questões · {aberta.respondidas} respondidas
            {aberta.pct != null ? ` · ${aberta.pct}% de acerto` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={s.btnPrimary} onClick={() => praticarDisciplina(aberta.nome)}>
            <Icon name="play" color="#fff" size={13} /> Praticar {aberta.nome.split(' ').slice(-1)[0]}
          </button>
        </div>
      </div>

      <div style={{ ...s.progressTrack, marginTop: 16 }}>
        <div style={{ width: `${aberta.pct != null ? aberta.pct : aberta.cobertura}%`, height: '100%', background: aberta.cor, borderRadius: 5 }} />
      </div>

      {/* Enquanto a classificação não passou por revisão humana, quem lê
          precisa saber — é a mesma etiqueta que aparece na explicação. */}
      {naoRevisadas > 0 && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#F5EEDC', color: '#94661A', borderRadius: 10, fontSize: 12, lineHeight: 1.5 }}>
          {naoRevisadas === aberta.total
            ? 'A separação por matéria e tema desta disciplina foi feita por IA e ainda não passou por revisão humana.'
            : `${naoRevisadas} de ${aberta.total} questões desta disciplina foram classificadas por IA e ainda não passaram por revisão humana.`}
          {' '}O enunciado, as alternativas e o gabarito continuam sendo os oficiais da FGV.
        </div>
      )}

      <h2 style={{ ...s.sectionTitle, marginTop: 22 }}>Temas</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {temas.map((t) => (
          <div key={t.nome} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 14px', background: '#faf9f6', borderRadius: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1b19' }}>{t.nome}</div>
              <div style={{ fontSize: 11.5, color: '#6a665f', marginTop: 2 }}>
                {t.total} {t.total === 1 ? 'questão' : 'questões'}
                {t.tentativas > 0 ? ` · ${t.acertos}/${t.tentativas} respostas certas` : ' · sem respostas'}
              </div>
              <div style={{ ...s.progressTrack, marginTop: 6, maxWidth: 260 }}>
                <div style={{ width: `${t.pct ?? 0}%`, height: '100%', background: aberta.cor, borderRadius: 5 }} />
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.pct == null ? '#6a665f' : '#1c1b19', width: 44, textAlign: 'right' }}>
              {t.pct == null ? '—' : `${t.pct}%`}
            </div>
            <button
              style={s.btnOutline}
              onClick={() => revisarQuestoes(questoes.filter((q) => (q.disciplina || 'Sem classificação') === aberta.nome && (q.topico || 'Sem tema') === t.nome))}
            >
              Estudar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
