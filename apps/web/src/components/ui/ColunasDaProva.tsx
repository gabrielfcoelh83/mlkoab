import { AREAS, RESPOSTAS_PARA_MEDIR, pesoDaMateria } from '../../lib/areas';
import { MUDO, TINTA } from '../../lib/theme';
import { TileDaMateria } from './Materia';

// O mapa da prova em colunas: a altura é quanto a matéria vale nas 80
// questões; a parte cheia é o que a pessoa leva hoje com a taxa de acerto
// dela. Tracejado quando ainda não há 10 respostas — sem estimativa, e não
// zero. Agrupado por área, da área que mais vale para a que menos vale.

export type DadosDaMateria = { nome: string; tentativas: number; acertos: number };

const ALTURA = 170;
const PESO_MAX = 8;
const LARGURA_COLUNA = 30;
const VAO = 8;

const fmt = (n: number) => String(n).replace('.', ',');

export default function ColunasDaProva({ materias }: { materias: DadosDaMateria[] }) {
  const porNome = new Map(materias.map((m) => [m.nome, m]));
  const grupos = AREAS.map((area) => {
    const colunas = area.materias.map((nome) => {
      const m = porNome.get(nome);
      const tentativas = m?.tentativas ?? 0;
      const peso = pesoDaMateria(nome) ?? 0;
      const taxa = tentativas >= RESPOSTAS_PARA_MEDIR ? (m?.acertos ?? 0) / tentativas : null;
      return { nome, peso, taxa, leva: taxa == null ? null : peso * taxa };
    }).sort((a, b) => b.peso - a.peso);
    return { area, colunas, peso: colunas.reduce((t, c) => t + c.peso, 0) };
  }).sort((a, b) => b.peso - a.peso);

  const todas = grupos.flatMap((g) => g.colunas);
  const comDados = todas.filter((c) => c.leva != null);
  const leva = comDados.reduce((t, c) => t + (c.leva ?? 0), 0);
  const pesoComDados = comDados.reduce((t, c) => t + c.peso, 0);
  const pesoSemDados = todas.reduce((t, c) => t + c.peso, 0) - pesoComDados;
  const larguraDoGrupo = (n: number) => n * LARGURA_COLUNA + (n - 1) * VAO;

  return (
    <div>
      <p style={{ margin: '2px 0 12px', fontSize: 12.5, color: '#4f4b45', lineHeight: 1.5 }} data-testid="mapa-resumo">
        {comDados.length === 0
          ? `Responda ao menos ${RESPOSTAS_PARA_MEDIR} questões numa matéria para ver quanto você levaria dela na prova.`
          : <>Se a prova fosse hoje, você levaria cerca de <b style={{ color: TINTA }}>{fmt(Math.round(leva))}</b> de {pesoComDados} questões nas matérias com dados.{pesoSemDados > 0 && ` As outras ${pesoSemDados} estão em matérias com menos de ${RESPOSTAS_PARA_MEDIR} respostas e ficam sem estimativa.`}</>}
      </p>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div
          role="img"
          aria-label={`Mapa da prova: cada coluna é uma matéria, da altura do que vale nas 80 questões; a parte cheia é o que você leva hoje. Você levaria cerca de ${Math.round(leva)} de ${pesoComDados}.`}
          style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', minWidth: '100%' }}
        >
          <div style={{ position: 'relative', display: 'flex', gap: 22, alignItems: 'flex-end', paddingLeft: 26, paddingTop: 14 }}>
            {[0, 2, 4, 6, 8].map((v) => (
              <div key={v} aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 30 + (v / PESO_MAX) * ALTURA, borderTop: '1px solid #eeebe5' }}>
                <span style={{ position: 'absolute', left: 0, top: -8, fontSize: 10.5, color: MUDO, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
            ))}
            {grupos.map((g) => (
              <div key={g.area.chave} style={{ display: 'flex', gap: VAO, alignItems: 'flex-end', position: 'relative' }}>
                {g.colunas.map((c) => {
                  const cor = g.area.cor;
                  const titulo = c.leva == null
                    ? `${c.nome}: vale ${c.peso}, menos de ${RESPOSTAS_PARA_MEDIR} respostas, sem estimativa`
                    : `${c.nome}: vale ${c.peso}, você leva cerca de ${fmt(Math.round(c.leva * 10) / 10)} e deixa ${fmt(Math.round((c.peso - c.leva) * 10) / 10)}`;
                  return (
                    <div key={c.nome} title={titulo} style={{ width: LARGURA_COLUNA, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10.5, color: MUDO, fontVariantNumeric: 'tabular-nums' }}>{c.peso}</span>
                      <div
                        style={{
                          width: '100%', height: (c.peso / PESO_MAX) * ALTURA, borderRadius: 4, position: 'relative', overflow: 'hidden',
                          background: c.leva == null ? 'transparent' : `${cor}24`,
                          border: c.leva == null ? '1px dashed #b9b4aa' : `1px solid ${cor}55`,
                        }}
                      >
                        {c.leva != null && (
                          <i style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${(c.leva / c.peso) * 100}%`, background: cor }} />
                        )}
                      </div>
                      <TileDaMateria materia={c.nome} tamanho={24} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 22, paddingLeft: 26, marginTop: 8 }}>
            {grupos.map((g) => (
              <div key={g.area.chave} style={{ width: larguraDoGrupo(g.colunas.length), borderTop: `2px solid ${g.area.cor}`, paddingTop: 5, fontSize: 11, lineHeight: 1.3 }}>
                <b style={{ display: 'block', color: TINTA, fontWeight: 600 }}>{g.area.nome}</b>
                <span style={{ color: MUDO }}>vale {g.peso}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5, color: MUDO, marginTop: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: TINTA, display: 'block' }} />Cheio: o que você leva com o acerto de hoje</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: '#d9d5cc', display: 'block' }} />Claro: o que você deixa</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 2, border: '1px dashed #b9b4aa', display: 'block' }} />Tracejado: sem dados suficientes</span>
      </div>
    </div>
  );
}
