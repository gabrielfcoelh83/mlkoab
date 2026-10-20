-- Marcador por questão: um por usuário, com tipo e nota opcional.
--
-- Diferente de `tentativas`, que guarda cada resposta, aqui o estado é o
-- atual: marcar de novo a mesma questão substitui o marcador anterior. É o
-- que a tela precisa para saber o que a pessoa separou (chute, não sabia,
-- refazer, dúvida), sem crescer uma linha por clique.
CREATE TABLE IF NOT EXISTS marcadores (
  -- Vem sempre do JWT, nunca do corpo da requisição — e do mesmo tipo de
  -- `tentativas.user_id`, para as consultas por dono continuarem iguais.
  user_id       INTEGER      NOT NULL,

  -- Mesmo tipo de `tentativas.questao_id` (TEXT): o acervo usa ids numéricos,
  -- mas a geração por IA produz "q-1786108995123-a3f9xk2p1".
  questao_id    TEXT         NOT NULL,

  -- O vocabulário aqui é fechado, ao contrário de `tentativas.tipo`: são
  -- exatamente os quatro estados da tela, e um valor fora deles deixaria o
  -- front sem como desenhar o marcador.
  tipo          TEXT         NOT NULL
                CHECK (tipo IN ('chute', 'nao_sabia', 'refazer', 'duvida')),

  -- Nota livre, opcional. O CHECK é a última linha de defesa: a rota já
  -- recusa acima de 280, mas escrita por outro caminho não passa daqui.
  nota          TEXT         NULL
                CHECK (nota IS NULL OR char_length(nota) <= 280),

  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Um marcador por questão e usuário. É o que permite o upsert do PUT e
  -- impede duas linhas concorrentes para o mesmo par.
  PRIMARY KEY (user_id, questao_id)
);
