import { Icon } from '../lib/icons';
import { dadosDoMarcador } from '../lib/marcadores';
import BotaoMarcador from '../components/ui/BotaoMarcador';

export default function Favoritos({ theme, s, revisao, revisarQuestoes, definirMarcador, removerMarcador }) {
  const marcadas = revisao?.marcadas || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h2 style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="flag" color={theme.primary} size={20} />Questões com marcador
          </h2>
          <div style={{ fontSize: 13, color: '#7a766f', marginTop: 4 }}>
            {marcadas.length > 0
              ? `${marcadas.length} ${marcadas.length === 1 ? 'questão marcada' : 'questões marcadas'} · guardadas na sua conta`
              : 'Marque questões com a bandeira para revisá-las rapidamente aqui.'}
          </div>
        </div>
        {marcadas.length > 0 && (
          <button style={s.btnPrimary} onClick={() => revisarQuestoes(marcadas.map((x) => x.questao))}>
            <Icon name="play" color="#fff" size={13} /> Revisar todas
          </button>
        )}
      </div>

      {marcadas.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', color: '#7a766f', fontSize: 13.5, padding: '40px 20px', lineHeight: 1.6 }}>
          Você ainda não marcou nenhuma questão.
          <br />A bandeira aparece ao lado da questão, no quiz e em Revisões.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {marcadas.map((item) => {
            const q = item.questao;
            const dados = item.marcador ? dadosDoMarcador(item.marcador.tipo) : null;
            return (
              <div key={q.id} data-testid={`favorito-item-${q.id}`} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 16 }}>
                {definirMarcador && (
                  <BotaoMarcador
                    s={s}
                    questaoId={q.id}
                    marcador={item.marcador}
                    onSalvar={definirMarcador}
                    onApagar={removerMarcador}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* A questão do acervo oficial pode ainda não ter disciplina;
                      o cabeçalho antigo mostrava `undefined` nesse caso. */}
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1b19' }}>
                    {q.disciplina || (q.exame ? `${q.exame}º Exame de Ordem` : 'Sem classificação')}
                  </div>
                  <div style={{ fontSize: 13, color: '#4f4b45', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.enunciado}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {q.topico && <span style={s.pill('#f1efea', '#7a766f')}>{q.topico}</span>}
                    {item.tentativas > 0
                      ? <span style={s.pill('#f1efea', '#7a766f')}>{item.acertos}/{item.tentativas} · {item.pct}%</span>
                      : <span style={s.pill('#f1efea', '#7a766f')}>ainda não respondida</span>}
                    {item.marcador && dados && (
                      <span style={{ ...s.pill(`${dados.cor}14`, dados.cor), display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Icon name={dados.icone} color={dados.cor} size={11} /> {dados.rotulo}
                      </span>
                    )}
                  </div>
                  {item.marcador?.tipo === 'duvida' && item.marcador.nota && (
                    <div style={{ fontSize: 12, color: '#4f4b45', marginTop: 6, lineHeight: 1.5 }}>
                      Sua dúvida: {item.marcador.nota}
                    </div>
                  )}
                </div>
                <button style={{ ...s.btnOutline, display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }} onClick={() => revisarQuestoes([q])}>
                  <Icon name="play" color="#1c1b19" size={13} /> Revisar agora
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
