// Comparação de texto do app: minúsculas e sem acento.
//
// "Ética" e "etica" são a mesma busca, e "ação" casa com "acao". Fica num
// módulo próprio porque a busca da Revisões e a conversa do Kepy fazem a mesma
// pergunta a partir de telas diferentes, e duas cópias acabariam divergindo.

export const normalizar = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
