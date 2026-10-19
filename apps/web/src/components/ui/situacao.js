// Cores e rótulos da situação da questão, usados na pílula "Última tentativa"
// do modal "Ver questão e gabarito". Os cartões da Revisões deixaram de ter
// pílula de situação; o arquivo próprio fica para outra tela reaproveitar o
// mesmo tom de erro/acerto em vez de copiar os hex.

export const SITUACAO = {
  errou: { rotulo: 'Errei', bg: '#F6E4E1', fg: '#8F2F29' },
  acertou: { rotulo: 'Acertei', bg: '#E4EEE1', fg: '#355E35' },
  'em-aberto': { rotulo: 'Não respondida', bg: '#f1efea', fg: '#4f4b45' },
};
