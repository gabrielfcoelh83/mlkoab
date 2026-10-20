import { useState } from 'react';
import { MOTIVOS_DO_ERRO, NOTA_DO_MOTIVO_MAX, rotuloDoMotivo } from '../../lib/revisao';

// "Justificativa" (antes "Por que errei?") — a anotação do Caderno de Erros, presa à última tentativa
// (a errada). Opcional: fechado, é um link discreto; aberto, os motivos da
// lista e uma nota livre. Salvar sem nada escolhido apaga a anotação.
//
// Mora num componente próprio porque o cartão da lista e o modal "Ver questão
// e gabarito" mostram o mesmo formulário: duplicar deixaria as duas cópias
// divergindo no primeiro ajuste de texto.
export default function MotivoDoErro({ theme, s, questaoId, tentativa, anotarMotivo }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState(tentativa.motivo || null);
  const [nota, setNota] = useState(tentativa.motivo_nota || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const temAnotacao = Boolean(tentativa.motivo || tentativa.motivo_nota);

  const abrir = () => {
    // Reabre com o que está salvo, não com o rascunho de uma edição cancelada.
    setMotivo(tentativa.motivo || null);
    setNota(tentativa.motivo_nota || '');
    setErro(null);
    setAberto(true);
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    const falha = await anotarMotivo(questaoId, tentativa.id, { motivo, nota });
    setSalvando(false);
    if (falha) setErro(falha);
    else setAberto(false);
  };

  if (!aberto) {
    return temAnotacao ? (
      <div data-testid={`motivo-${questaoId}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', fontSize: 12.5 }}>
        <span style={{ color: '#6a665f' }}>Justificativa:</span>
        {tentativa.motivo && <span style={s.pill('#F6E4E1', '#8F2F29')}>{rotuloDoMotivo(tentativa.motivo)}</span>}
        {tentativa.motivo_nota && <span style={{ color: '#4f4b45', fontStyle: 'italic' }}>{tentativa.motivo_nota}</span>}
        <button data-testid={`motivo-editar-${questaoId}`} onClick={abrir} style={{ background: 'none', border: 'none', color: theme.primaryDark, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          Editar
        </button>
      </div>
    ) : (
      <button data-testid={`motivo-abrir-${questaoId}`} onClick={abrir} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: theme.primaryDark, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
        + Justificativa <span style={{ fontWeight: 400, color: '#6a665f' }}>(opcional)</span>
      </button>
    );
  }

  return (
    <div data-testid={`motivo-form-${questaoId}`} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1c1b19' }}>Por que você errou esta questão?</div>
      <div role="radiogroup" aria-label="Motivo do erro" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MOTIVOS_DO_ERRO.map((m) => {
          const escolhido = motivo === m.valor;
          return (
            <button
              key={m.valor}
              role="radio"
              aria-checked={escolhido}
              data-testid={`motivo-opcao-${m.valor}`}
              // Clicar no escolhido desmarca: dá para salvar só a nota.
              onClick={() => setMotivo(escolhido ? null : m.valor)}
              style={{
                background: escolhido ? theme.primarySoft : '#fff',
                color: escolhido ? theme.primaryDark : '#4f4b45',
                border: escolhido ? 'none' : '1px solid rgba(0,0,0,.08)',
                borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {m.rotulo}
            </button>
          );
        })}
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6a665f' }}>
        Anotação (opcional)
        <textarea
          data-testid={`motivo-nota-${questaoId}`}
          value={nota}
          maxLength={NOTA_DO_MOTIVO_MAX}
          rows={2}
          placeholder="Ex.: troquei usucapião ordinária e extraordinária"
          onChange={(e) => setNota(e.target.value)}
          style={{ font: 'inherit', fontSize: 13, color: '#1c1b19', border: '1px solid rgba(0,0,0,.12)', borderRadius: 8, padding: '8px 10px', resize: 'vertical' }}
        />
        <span style={{ alignSelf: 'flex-end' }}>{nota.length}/{NOTA_DO_MOTIVO_MAX}</span>
      </label>
      {erro && <div role="alert" style={{ fontSize: 12.5, color: '#8F2F29' }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button data-testid={`motivo-salvar-${questaoId}`} disabled={salvando} onClick={salvar} style={{ ...s.btnPrimary, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button disabled={salvando} onClick={() => setAberto(false)} style={s.btnOutline}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
