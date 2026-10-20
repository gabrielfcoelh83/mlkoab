import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../../lib/icons';
import { MUDO, SOMBRA, TINTA, TRILHO, VERDE, VERMELHO } from '../../lib/theme';

// Cartões de métrica e gráficos do Dashboard, do Desempenho, das Estatísticas
// e dos Simulados. SVG à mão, sem biblioteca: são quatro formas, e cada uma
// precisa do texto alternativo e do título por ponto, que as bibliotecas
// deixam para depois.

const fmt = (n: number) => String(n).replace('.', ',');

const cartao: CSSProperties = {
  background: '#fff', borderRadius: 12, boxShadow: SOMBRA, padding: '16px 18px',
  display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0,
};
const rotuloEstilo: CSSProperties = { fontSize: 12, color: MUDO, fontWeight: 500 };
const contextoEstilo: CSSProperties = { fontSize: 11.5, color: MUDO, minHeight: 15 };

// ---------------------------------------------------------------------------
// Variação contra o período anterior
// ---------------------------------------------------------------------------

type VariacaoProps = {
  valor: number;
  texto?: string;
  // Tempo por questão: cair é bom. Sem isto a seta verde apontaria para cima
  // num tempo que piorou.
  menorEMelhor?: boolean;
};

export function Variacao({ valor, texto, menorEMelhor = false }: VariacaoProps) {
  const sobe = valor >= 0;
  const bom = menorEMelhor ? !sobe : sobe;
  const cor = valor === 0 ? MUDO : bom ? VERDE : VERMELHO;
  const fundo = valor === 0 ? '#f1efea' : bom ? '#E8F0E6' : '#F6E5E3';
  const padrao = `${sobe ? '+' : '−'}${fmt(Math.abs(valor) < 10 ? Number(Math.abs(valor).toFixed(1)) : Math.round(Math.abs(valor)))}%`;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11.5, fontWeight: 600,
        color: cor, background: fundo, borderRadius: 4, padding: '1px 6px', fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Icon name={sobe ? 'arrow-up-right' : 'arrow-down-right'} color={cor} size={12} style={undefined} />
      {texto ?? padrao}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mini-curva e pontos dos dias
// ---------------------------------------------------------------------------

export function MiniCurva({ valores, cor = TINTA }: { valores: number[]; cor?: string }) {
  if (valores.length < 2) return null;
  const W = 220, H = 46, p = 5;
  const mn = Math.min(...valores), mx = Math.max(...valores), r = mx - mn || 1;
  const pts = valores.map((n, i) => [p + (i * (W - 2 * p)) / (valores.length - 1), H - p - ((n - mn) / r) * (H - 2 * p)]);
  const linha = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');
  const ultimo = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ width: '100%', height: 46, marginTop: 8, display: 'block' }} preserveAspectRatio="none">
      <path d={`${linha} L${ultimo[0].toFixed(1)} ${H} L${pts[0][0]} ${H}Z`} fill={cor} fillOpacity={0.07} />
      <path d={linha} fill="none" stroke={cor} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={ultimo[0]} cy={ultimo[1]} r={3.5} fill={cor} />
    </svg>
  );
}

/** Um quadradinho por dia: em cor os dias com estudo, em cinza os sem. */
export function PontosDosDias({ dias, cor }: { dias: boolean[]; cor: string }) {
  const estudados = dias.filter(Boolean).length;
  return (
    <div
      role="img"
      aria-label={`Últimos ${dias.length} dias: ${estudados} com estudo`}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${dias.length}, 1fr)`, gap: 3, marginTop: 14 }}
    >
      {dias.map((x, i) => (
        <i key={i} style={{ display: 'block', height: 14, borderRadius: 3, background: x ? cor : TRILHO }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartão de métrica
// ---------------------------------------------------------------------------

type KpiProps = {
  rotulo: string;
  valor: ReactNode;
  variacao?: VariacaoProps | null;
  contexto?: ReactNode;
  curva?: number[];
  corDaCurva?: string;
  dias?: boolean[];
  corDosDias?: string;
  testId?: string;
};

export function KpiCard({ rotulo, valor, variacao, contexto, curva, corDaCurva, dias, corDosDias = TINTA, testId }: KpiProps) {
  return (
    <div style={cartao} data-testid={testId}>
      <div style={rotuloEstilo}>{rotulo}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <b style={{ fontSize: 26, fontWeight: 600, color: TINTA, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          {valor}
        </b>
        {variacao && <Variacao {...variacao} />}
      </div>
      <div style={contextoEstilo}>{contexto ?? ' '}</div>
      {curva && <MiniCurva valores={curva} cor={corDaCurva} />}
      {dias && <PontosDosDias dias={dias} cor={corDosDias} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráficos
// ---------------------------------------------------------------------------

export type Serie = { rotulo: string; valores: number[]; cor: string };

export function Legenda({ series }: { series: { rotulo: string; cor: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: MUDO, margin: '2px 0 8px' }}>
      {series.map((x) => (
        <span key={x.rotulo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 9, height: 9, borderRadius: 2, background: x.cor, display: 'block' }} />
          {x.rotulo}
        </span>
      ))}
    </div>
  );
}

// Curva suave (Catmull-Rom em Bézier): passa por todos os pontos, sem o
// serrilhado da poligonal quando são poucas semanas.
function suave(pts: number[][]) {
  return pts.map((p, i) => {
    if (!i) return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    const a = pts[i - 2] || pts[i - 1], b = pts[i - 1], c = p, d = pts[i + 1] || p;
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6];
    return `C${c1.map((n) => n.toFixed(1)).join(' ')} ${c2.map((n) => n.toFixed(1)).join(' ')} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }).join(' ');
}

// Topo do eixo: múltiplo de 5 até 20, de 20 depois. Um teto fixo em 100
// achatava a curva de quem responde 12 questões por semana.
function topoDoEixo(max: number) {
  if (max <= 0) return 5;
  if (max <= 20) return Math.ceil(max / 5) * 5;
  return Math.ceil(max / 20) * 20;
}

function Eixos({ W, H, L, R, T, B, topo, rotulos, passo }: {
  W: number; H: number; L: number; R: number; T: number; B: number; topo: number; rotulos: string[]; passo: number;
}) {
  const fs = W > 600 ? 12.5 : 10.5;
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = T + ((H - T - B) * (4 - i)) / 4;
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y} y2={y} stroke={TRILHO} />
            <text x={L - 8} y={y + 3.5} textAnchor="end" fontSize={fs} fill={MUDO}>{fmt(Math.round((topo * i) / 4))}</text>
          </g>
        );
      })}
      {rotulos.map((t, i) => (i % passo === 0 || i === rotulos.length - 1 ? (
        <text key={i} x={L + ((i + 0.5) * (W - L - R)) / rotulos.length} y={H - 8} textAnchor="middle" fontSize={fs} fill={MUDO}>{t}</text>
      ) : null))}
    </g>
  );
}

type AreaProps = {
  rotulos: string[];
  series: Serie[];
  descricao: string;
  largura?: number;
  altura?: number;
  referencia?: { valor: number; rotulo: string } | null;
};

export function GraficoArea({ rotulos, series, descricao, largura = 900, altura = 250, referencia = null }: AreaProps) {
  const W = largura, H = altura, L = 40, R = 10, T = 10, B = 28, n = rotulos.length;
  if (n === 0) return null;
  const topo = topoDoEixo(Math.max(...series.flatMap((x) => x.valores), referencia ? referencia.valor : 0));
  const X = (i: number) => L + ((i + 0.5) * (W - L - R)) / n;
  const Y = (v: number) => T + (H - T - B) * (1 - v / topo);
  return (
    <div>
      <Legenda series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descricao} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <Eixos W={W} H={H} L={L} R={R} T={T} B={B} topo={topo} rotulos={rotulos} passo={n > 8 ? 2 : 1} />
        {referencia && (
          <g>
            <line x1={L} x2={W - R} y1={Y(referencia.valor)} y2={Y(referencia.valor)} stroke="#8a857b" strokeDasharray="5 4" />
            <text x={W - R} y={Y(referencia.valor) - 6} textAnchor="end" fontSize={W > 600 ? 12.5 : 10.5} fill={MUDO}>{referencia.rotulo}</text>
          </g>
        )}
        {series.map((x, k) => {
          const pts = x.valores.map((v, i) => [X(i), Y(v)]);
          return (
            <g key={x.rotulo}>
              {k === 0 && pts.length > 1 && (
                <path d={`${suave(pts)} L${X(n - 1).toFixed(1)} ${H - B} L${X(0).toFixed(1)} ${H - B}Z`} fill={x.cor} fillOpacity={0.07} />
              )}
              {pts.length > 1 && <path d={suave(pts)} fill="none" stroke={x.cor} strokeWidth={2} strokeLinecap="round" />}
              {pts.map((q, i) => (
                <circle key={i} cx={q[0]} cy={q[1]} r={i === n - 1 ? 3.5 : 2.2} fill={x.cor}>
                  <title>{`${x.rotulo}, ${rotulos[i]}: ${fmt(x.valores[i])}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function GraficoBarras({ rotulos, series, descricao }: { rotulos: string[]; series: Serie[]; descricao: string }) {
  const W = 480, H = 230, L = 40, R = 10, T = 10, B = 28, n = rotulos.length;
  if (n === 0) return null;
  const topo = topoDoEixo(Math.max(...series.flatMap((x) => x.valores)));
  const gw = (W - L - R) / n, bw = Math.min(12, (gw - 6) / series.length);
  return (
    <div>
      <Legenda series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descricao} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <Eixos W={W} H={H} L={L} R={R} T={T} B={B} topo={topo} rotulos={rotulos} passo={1} />
        {rotulos.map((rotulo, i) => series.map((x, k) => {
          const h = (H - T - B) * (x.valores[i] / topo);
          const bx = L + i * gw + gw / 2 - (series.length * bw + (series.length - 1) * 3) / 2 + k * (bw + 3);
          return (
            <rect key={`${i}-${k}`} x={bx} y={H - B - h} width={bw} height={h} rx={2} fill={x.cor}>
              <title>{`${x.rotulo}, ${rotulo}: ${fmt(x.valores[i])}`}</title>
            </rect>
          );
        }))}
      </svg>
    </div>
  );
}

type FatiaDaRosca = { rotulo: string; valor: number; cor: string };

export function Rosca({ fatias, centro, rotuloCentral, descricao }: {
  fatias: FatiaDaRosca[]; centro: ReactNode; rotuloCentral: string; descricao: string;
}) {
  const C = 2 * Math.PI * 64;
  const total = fatias.reduce((t, x) => t + x.valor, 0);
  let acumulado = 0;
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 170 170" role="img" aria-label={descricao} style={{ width: 150, height: 150, flex: 'none' }}>
        <circle cx={85} cy={85} r={64} fill="none" stroke={TRILHO} strokeWidth={22} />
        {total > 0 && fatias.map((x) => {
          const len = (x.valor / total) * C;
          const arco = (
            <circle
              key={x.rotulo} cx={85} cy={85} r={64} fill="none" stroke={x.cor} strokeWidth={22}
              strokeDasharray={`${Math.max(len - 2, 0).toFixed(1)} ${(C - len + 2).toFixed(1)}`}
              strokeDashoffset={(-acumulado).toFixed(1)} transform="rotate(-90 85 85)"
            >
              <title>{`${x.rotulo}: ${x.valor}`}</title>
            </circle>
          );
          acumulado += len;
          return arco;
        })}
        <text x={85} y={80} textAnchor="middle" fontSize={11} fill={MUDO}>{rotuloCentral}</text>
        <text x={85} y={102} textAnchor="middle" fontSize={20} fontWeight={700} fill={TINTA}>{centro}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fatias.map((x) => (
          <div key={x.rotulo} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto 40px', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <i style={{ width: 10, height: 10, borderRadius: 2, background: x.cor, display: 'block' }} />
            <span style={{ color: TINTA }}>{x.rotulo}</span>
            <b style={{ fontVariantNumeric: 'tabular-nums', color: TINTA }}>{x.valor}</b>
            <span style={{ color: MUDO, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {total > 0 ? Math.round((x.valor / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cartão com título e gráfico dentro. */
export function CartaoDeGrafico({ titulo, sub, children, acoes, testId }: {
  titulo: string; sub?: ReactNode; children: ReactNode; acoes?: ReactNode; testId?: string;
}) {
  return (
    <div style={{ ...cartao, padding: 20, gap: 4 }} data-testid={testId}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TINTA }}>{titulo}</h2>
          {sub && <div style={{ fontSize: 12, color: MUDO, marginTop: 3 }}>{sub}</div>}
        </div>
        {acoes}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}
