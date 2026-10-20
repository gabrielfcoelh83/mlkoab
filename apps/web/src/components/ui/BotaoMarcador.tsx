import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Icon } from '../../lib/icons';
import {
  NOTA_DO_MARCADOR_MAX,
  TIPOS_DE_MARCADOR,
  dadosDoMarcador,
} from '../../lib/marcadores';

// A bandeira que substitui a estrela. O menu é um popover: a escolha é o
// motivo, então não pode ser um clique cego no ícone — é o motivo que faz a
// questão voltar em Revisões › Marcadores.

export type MarcadorDaQuestao = {
  questaoId: string | number;
  tipo: string;
  nota?: string | null;
};

export type DadosDoMarcador = {
  tipo: string;
  nota?: string | null;
};

type Estilos = {
  btnOutline: CSSProperties;
  btnPrimary: CSSProperties;
};

type Props = {
  s: Estilos;
  questaoId: number | string;
  marcador?: MarcadorDaQuestao | null;
  onSalvar: (questaoId: number | string, dados: DadosDoMarcador) => Promise<unknown> | void;
  onApagar?: (questaoId: number | string) => Promise<unknown> | void;
  tamanho?: number;
};

const CHAVE_DA_DICA = 'ma-questoes-marcador-dica-v1';
const CINZA_DA_BANDEIRA = '#cfcac2';

function dicaPendente() {
  try {
    return localStorage.getItem(CHAVE_DA_DICA) !== '1';
  } catch {
    return true;
  }
}

function marcarDicaVista() {
  try {
    localStorage.setItem(CHAVE_DA_DICA, '1');
  } catch {
    // modo privado ou quota: a dica volta na próxima abertura, sem quebrar nada
  }
}

const coresFixas = {
  texto: '#1c1b19',
  mudo: '#7a766f',
  linha: '#e6e2da',
  papel: '#faf9f6',
};

export default function BotaoMarcador({
  s, questaoId, marcador, onSalvar, onApagar, tamanho = 19,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<'opcoes' | 'nota'>('opcoes');
  const [nota, setNota] = useState('');
  const [mostrarDica, setMostrarDica] = useState(false);

  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const campoNotaRef = useRef<HTMLTextAreaElement>(null);
  const opcoesRef = useRef<Array<HTMLButtonElement | null>>([]);

  const dados = marcador ? dadosDoMarcador(marcador.tipo) : null;
  const cor = dados?.cor || CINZA_DA_BANDEIRA;

  const fechar = (devolverFoco = true) => {
    setAberto(false);
    setEtapa('opcoes');
    if (devolverFoco) botaoRef.current?.focus();
  };

  const abrir = () => {
    if (aberto) {
      fechar();
      return;
    }

    const primeiraVez = dicaPendente();
    setMostrarDica(primeiraVez);
    if (primeiraVez) marcarDicaVista();
    setEtapa('opcoes');
    setAberto(true);
  };

  const escolher = (tipo: string) => {
    if (tipo === 'duvida') {
      setNota(marcador?.tipo === 'duvida' ? (marcador.nota || '') : '');
      setEtapa('nota');
      return;
    }

    void onSalvar(questaoId, { tipo, nota: null });
    fechar();
  };

  const salvarDuvida = () => {
    const texto = nota.trim();
    void onSalvar(questaoId, { tipo: 'duvida', nota: texto || null });
    fechar();
  };

  const apagar = () => {
    if (!onApagar) return;
    void onApagar(questaoId);
    fechar();
  };

  // O foco entra na opção marcada (ou na primeira) ao abrir; na etapa da nota,
  // vai para o campo. Sem isso, quem abriu pelo teclado ficaria no gatilho e as
  // setas não teriam para onde ir.
  useEffect(() => {
    if (!aberto) return;
    if (etapa === 'nota') {
      campoNotaRef.current?.focus();
      return;
    }

    const selecionada = opcoesRef.current.find(
      (opcao) => opcao?.getAttribute('aria-checked') === 'true',
    );
    (selecionada || opcoesRef.current[0])?.focus();
  }, [aberto, etapa]);

  // Clicar fora fecha. O foco não volta para o gatilho aqui: quem clicou noutro
  // controle quer continuar ali.
  useEffect(() => {
    if (!aberto) return undefined;

    const aoClicarFora = (evento: MouseEvent) => {
      if (raizRef.current && !raizRef.current.contains(evento.target as Node)) {
        setAberto(false);
        setEtapa('opcoes');
      }
    };

    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  const focaveisDoMenu = () => Array.from(
    menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || [],
  );

  const aoTeclarMenu = (evento: ReactKeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      fechar();
      return;
    }

    // Na etapa da nota, as setas pertencem ao cursor do texto.
    if (evento.target instanceof HTMLInputElement || evento.target instanceof HTMLTextAreaElement) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) return;

    const focaveis = focaveisDoMenu();
    if (focaveis.length === 0) return;

    const atual = focaveis.indexOf(document.activeElement as HTMLButtonElement);
    let proximo = 0;
    if (evento.key === 'End') proximo = focaveis.length - 1;
    else if (evento.key === 'ArrowDown') proximo = atual < 0 ? 0 : (atual + 1) % focaveis.length;
    else if (evento.key === 'ArrowUp') proximo = atual <= 0 ? focaveis.length - 1 : atual - 1;

    evento.preventDefault();
    evento.stopPropagation();
    focaveis[proximo]?.focus();
  };

  return (
    <div ref={raizRef} style={{ position: 'relative', display: 'inline-flex', flex: 'none' }} onKeyDown={aoTeclarMenu}>
      <button
        ref={botaoRef}
        type="button"
        data-testid={`marcador-${questaoId}`}
        data-marcador-botao={String(questaoId)}
        data-tipo={marcador?.tipo || 'nenhum'}
        data-cor={dados?.cor || ''}
        aria-label={dados ? `Marcador: ${dados.rotulo}. Trocar` : 'Marcar por que esta questão deve voltar'}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={dados ? `Marcador: ${dados.rotulo}` : 'Marcar esta questão'}
        onClick={abrir}
        style={{
          background: 'none', border: 'none', padding: 2, display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none',
        }}
      >
        <Icon
          name="flag"
          color={cor}
          size={tamanho}
          style={marcador ? { fill: cor } : undefined}
        />
      </button>

      {aberto && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Marcador da questão"
          data-testid={`menu-marcador-${questaoId}`}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 700,
            width: 318, maxWidth: 'calc(100vw - 40px)', background: '#fff',
            border: `1px solid ${coresFixas.linha}`, borderRadius: 10,
            boxShadow: '0 8px 24px rgba(28,27,25,.12)', padding: 10,
          }}
        >
          {etapa === 'opcoes' ? (
            <>
              {mostrarDica && (
                <div
                  data-testid={`marcador-dica-${questaoId}`}
                  style={{
                    fontSize: 11.5, lineHeight: 1.5, color: '#5f5b55',
                    background: coresFixas.papel, borderRadius: 7, padding: '8px 10px',
                    marginBottom: 8,
                  }}
                >
                  Por que esta questão deve voltar? Escolha um motivo. Ela aparece em Revisões › Marcadores.
                </div>
              )}

              {TIPOS_DE_MARCADOR.map((tipo, indice) => {
                const selecionado = marcador?.tipo === tipo.tipo;
                return (
                  <button
                    key={tipo.tipo}
                    ref={(elemento) => { opcoesRef.current[indice] = elemento; }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selecionado}
                    data-testid={`marcador-opcao-${tipo.tipo}-${questaoId}`}
                    onClick={() => escolher(tipo.tipo)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%',
                      padding: '8px 9px', borderRadius: 7, textAlign: 'left', cursor: 'pointer',
                      border: 'none', background: selecionado ? coresFixas.papel : 'transparent',
                      color: coresFixas.texto,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 8, height: 8, borderRadius: '50%', background: tipo.cor,
                        flex: 'none', marginTop: 5,
                      }}
                    />
                    <Icon name={tipo.icone} color={tipo.cor} size={15} style={{ marginTop: 1 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: coresFixas.texto }}>
                        {tipo.rotulo}
                      </span>
                      <span style={{ display: 'block', fontSize: 11.5, color: coresFixas.mudo, marginTop: 1 }}>
                        {tipo.descricao}
                      </span>
                    </span>
                    {selecionado && <Icon name="check" color={tipo.cor} size={14} style={undefined} />}
                  </button>
                );
              })}

              {marcador && onApagar && (
                <button
                  type="button"
                  role="menuitem"
                  data-testid={`marcador-remover-${questaoId}`}
                  onClick={apagar}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    marginTop: 6, padding: '8px 9px', borderRadius: 7, border: 'none',
                    background: 'transparent', color: '#8F2F29', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, textAlign: 'left',
                  }}
                >
                  <Icon name="x" color="#B4413A" size={14} style={undefined} /> Tirar o marcador
                </button>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: coresFixas.texto }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="help" color="#6C6F99" size={15} style={undefined} /> Dúvida
                </span>
              </div>
              <label
                htmlFor={`marcador-nota-campo-${questaoId}`}
                style={{ fontSize: 11.5, color: coresFixas.mudo }}
              >
                Qual foi a dúvida? (opcional)
              </label>
              <textarea
                id={`marcador-nota-campo-${questaoId}`}
                ref={campoNotaRef}
                data-testid={`marcador-nota-${questaoId}`}
                value={nota}
                maxLength={NOTA_DO_MARCADOR_MAX}
                rows={3}
                onChange={(evento) => setNota(evento.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  font: 'inherit', fontSize: 12.5, lineHeight: 1.5, color: coresFixas.texto,
                  border: `1px solid ${coresFixas.linha}`, borderRadius: 7, padding: '8px 10px',
                  background: '#fff',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  data-testid={`marcador-nota-salvar-${questaoId}`}
                  onClick={salvarDuvida}
                  style={{ ...s.btnPrimary, padding: '7px 12px', fontSize: 12 }}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  data-testid={`marcador-nota-voltar-${questaoId}`}
                  onClick={() => setEtapa('opcoes')}
                  style={{ ...s.btnOutline, padding: '6px 10px', fontSize: 12 }}
                >
                  Voltar
                </button>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: coresFixas.mudo, fontVariantNumeric: 'tabular-nums' }}>
                  {nota.length}/{NOTA_DO_MARCADOR_MAX}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
