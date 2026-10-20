import { useState } from 'react';
import { Icon } from '../../lib/icons';
import { questoesDisponiveis, tempoDeProvaMinutos } from '../../lib/simulado';

const QUANTIDADES = [10, 20, 30, 40, 50, 60, 70, 80];

// O formulário do Simulado Geral: quantas questões, sorteadas do acervo na
// proporção em que a prova cobra cada matéria.
//
// A opção "Por disciplina" saiu: simulado simula a prova inteira. Treinar uma
// matéria é o caderno em Questões, o "Praticar" de Disciplinas ou o treino de
// uma matéria dentro da apostila de um simulado.
//
// `questoes` é o acervo carregado, de onde sai a contagem: pedir 80 de um
// acervo de 12 abria uma prova de 12 sem dizer por quê.
export default function ConfigSimulado({ s, onConfirm, questoes = [] }) {
  const [quantidade, setQuantidade] = useState(80);

  const disponiveis = questoesDisponiveis(questoes, { tipo: 'geral' }).length;
  const efetiva = Math.min(quantidade, disponiveis);
  const invalido = disponiveis === 0;

  return (
    <div style={{ ...s.card, padding: '32px 32px', maxWidth: 620, margin: '0 auto' }}>
      <h2 style={{ ...s.pageTitle, fontSize: 24 }}>Simulado Geral</h2>
      <p style={{ ...s.pageSub, lineHeight: 1.55, margin: '6px 0 0' }}>
        Questões dos Exames de Ordem distribuídas como a prova cobra cada matéria, primeiro as que você ainda não fez.
        Sem gabarito durante a prova, como no dia.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#f8f7f3', borderRadius: 10 }}>
          <label htmlFor="simulado-quantidade" style={{ fontSize: 13, fontWeight: 600, color: '#1c1b19' }}>Quantidade de questões</label>
          <select
            id="simulado-quantidade"
            data-testid="qtd-questoes"
            value={quantidade}
            onChange={(e) => setQuantidade(parseInt(e.target.value, 10))}
            style={{ padding: '8px 14px', border: '1px solid #e6e2da', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff' }}
          >
            {QUANTIDADES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {!invalido && quantidade > disponiveis && (
          <div data-testid="aviso-quantidade" style={{ fontSize: 12.5, color: '#7A5A12', background: '#F5EEDC', borderRadius: 10, padding: '10px 14px', lineHeight: 1.5 }}>
            O acervo tem {disponiveis} {disponiveis === 1 ? 'questão' : 'questões'}: a prova terá {disponiveis}.
          </div>
        )}

        <div style={{ fontSize: 12.5, color: '#6a665f' }}>
          {efetiva} {efetiva === 1 ? 'questão' : 'questões'} · tempo de prova de cerca de {tempoDeProvaMinutos(efetiva)} minutos
        </div>

        <button
          data-testid="iniciar-simulado"
          onClick={() => onConfirm({ tipo: 'geral', quantidade })}
          disabled={invalido}
          style={{ ...s.btnPrimary, justifyContent: 'center', padding: 12, fontSize: 14, opacity: invalido ? 0.5 : 1, cursor: invalido ? 'not-allowed' : 'pointer' }}
        >
          <Icon name="play" color="#fff" size={14} /> Iniciar simulado
        </button>
        {invalido && (
          <div data-testid="motivo-desabilitado" role="status" style={{ fontSize: 12.5, color: '#7A5A12', textAlign: 'center', marginTop: -8, lineHeight: 1.5 }}>
            O acervo ainda não tem questões carregadas.
          </div>
        )}
      </div>
    </div>
  );
}
