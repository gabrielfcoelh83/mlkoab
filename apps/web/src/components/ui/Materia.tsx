import type { CSSProperties } from 'react';
import { Icon } from '../../lib/icons';
import { corDaMateria, iconeDaMateria, NIVEIS } from '../../lib/areas';
import { TRILHO } from '../../lib/theme';

// A identidade da matéria em todas as telas: o ladrilho com o ícone próprio na
// cor da área, e o nível em quatro degraus. Um lugar só, para a matéria ter a
// mesma cara no Dashboard, nas Questões, nas Revisões e nos Simulados.

type TileProps = {
  materia: string;
  tamanho?: number;
  style?: CSSProperties;
};

export function TileDaMateria({ materia, tamanho = 36, style }: TileProps) {
  const cor = corDaMateria(materia);
  return (
    <span
      aria-hidden="true"
      style={{
        width: tamanho, height: tamanho, flex: 'none', borderRadius: Math.round(tamanho * 0.24),
        // Véu da cor da área (8% de opacidade): o ícone carrega a cor, o fundo
        // só agrupa. Fundo cheio com ícone branco brigava com o conteúdo.
        background: `${cor}14`, color: cor,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      <Icon name={iconeDaMateria(materia)} color={cor} size={Math.round(tamanho * 0.5)} style={undefined} />
    </span>
  );
}

type NivelProps = {
  nivel: number;
  cor: string;
  comRotulo?: boolean;
};

/** Quatro degraus: Iniciando, Base, Avançando, Domínio. */
export function LadoNivel({ nivel, cor, comRotulo = false }: NivelProps) {
  const rotulo = NIVEIS[nivel - 1] ?? NIVEIS[0];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        role="img"
        aria-label={`Nível ${nivel} de 4: ${rotulo}`}
        title={`Nível ${nivel} de 4: ${rotulo}`}
        style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end' }}
      >
        {[1, 2, 3, 4].map((i) => (
          <i
            key={i}
            style={{
              display: 'block', width: 6, height: 4 + i * 2, borderRadius: 1.5,
              background: i <= nivel ? cor : TRILHO,
            }}
          />
        ))}
      </span>
      {comRotulo && <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1c1b19' }}>{rotulo}</span>}
    </span>
  );
}
