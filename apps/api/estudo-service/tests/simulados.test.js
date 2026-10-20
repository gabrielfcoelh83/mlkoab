const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';

const jwt = require('jsonwebtoken');
const { app, pool } = require('../app');
const { migrate } = require('../migrate');

// Usuários próprios: os testes de tentativas apagam as linhas de 2001/2002, e
// uma tentativa daqui com simulado_id sumiria no meio de um teste.
const DONO = 2101;
const OUTRO = 2102;

const como = (id) =>
  `Bearer ${jwt.sign({ id, email: `u${id}@exemplo.local` }, process.env.JWT_SECRET)}`;

// Tentativas antes dos simulados: a FK de tentativas.simulado_id barra a
// ordem inversa.
const limpar = async () => {
  await pool.query('DELETE FROM tentativas WHERE user_id = ANY($1)', [[DONO, OUTRO]]);
  await pool.query('DELETE FROM simulados WHERE user_id = ANY($1)', [[DONO, OUTRO]]);
};

const abrir = (userId = DONO, corpo = { exame: 44, tipo: 1 }) =>
  request(app).post('/simulados').set('Authorization', como(userId)).send(corpo);

const finalizar = (id, corpo = { acertos: 41, anuladas: 1 }, userId = DONO) =>
  request(app)
    .post(`/simulados/${id}/finalizar`)
    .set('Authorization', como(userId))
    .send(corpo);

const responder = (simuladoId, userId = DONO, questaoId = 'q-sim') =>
  request(app)
    .post('/tentativas')
    .set('Authorization', como(userId))
    .send({ questao_id: questaoId, correta: false, simulado_id: simuladoId });

beforeAll(async () => {
  await migrate(pool);
});

beforeEach(limpar);

afterAll(async () => {
  await limpar();
  await pool.end();
});

describe('POST /simulados — abrir', () => {
  it('abre um simulado aberto, do dono do token, sem nota', async () => {
    const res = await abrir();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      exame: 44, tipo: 1, status: 'aberto', refeito: false, nota: null, finalizado_em: null,
    });
    expect(typeof res.body.id).toBe('number');

    const { rows } = await pool.query('SELECT user_id FROM simulados WHERE id = $1', [res.body.id]);
    expect(rows[0].user_id).toBe(DONO);
  });

  it('valida exame e tipo', async () => {
    expect((await abrir(DONO, { exame: 0, tipo: 1 })).status).toBe(400);
    expect((await abrir(DONO, { exame: '44', tipo: 1 })).status).toBe(400);
    expect((await abrir(DONO, { exame: 44, tipo: 5 })).status).toBe(400);
  });

  it('só um aberto por vez, e o 409 diz qual é', async () => {
    const primeiro = await abrir();
    const segundo = await abrir(DONO, { exame: 45, tipo: 1 });

    expect(segundo.status).toBe(409);
    expect(segundo.body.simulado_id).toBe(primeiro.body.id);
  });

  it('dois pedidos simultâneos abrem só um — quem garante é o banco', async () => {
    const respostas = await Promise.all([abrir(), abrir(), abrir()]);
    const status = respostas.map((r) => r.status).sort();

    expect(status).toEqual([201, 409, 409]);
  });

  it('o aberto de uma pessoa não impede o de outra', async () => {
    await abrir(DONO);
    expect((await abrir(OUTRO)).status).toBe(201);
  });

  it('exige autenticação', async () => {
    const res = await request(app).post('/simulados').send({ exame: 44, tipo: 1 });
    expect(res.status).toBe(401);
  });
});

describe('refeito', () => {
  it('marca refeito o mesmo exame já finalizado, mesmo em outro tipo de caderno', async () => {
    const primeiro = await abrir(DONO, { exame: 44, tipo: 1 });
    await finalizar(primeiro.body.id);

    // Tipo 2 é a mesma prova embaralhada: quem fez o tipo 1 já viu as questões.
    const segundo = await abrir(DONO, { exame: 44, tipo: 2 });
    expect(segundo.body.refeito).toBe(true);
  });

  it('exame diferente não é refeito', async () => {
    const primeiro = await abrir(DONO, { exame: 44, tipo: 1 });
    await finalizar(primeiro.body.id);

    expect((await abrir(DONO, { exame: 45, tipo: 1 })).body.refeito).toBe(false);
  });

  it('abandonar sem responder nada não conta como ter feito a prova', async () => {
    const aberto = await abrir();
    await request(app)
      .post(`/simulados/${aberto.body.id}/abandonar`)
      .set('Authorization', como(DONO));

    expect((await abrir()).body.refeito).toBe(false);
  });

  it('abandonar depois de responder conta', async () => {
    const aberto = await abrir();
    await responder(aberto.body.id);
    await request(app)
      .post(`/simulados/${aberto.body.id}/abandonar`)
      .set('Authorization', como(DONO));

    expect((await abrir()).body.refeito).toBe(true);
  });

  it('a prova de outra pessoa não marca refeito', async () => {
    const alheio = await abrir(OUTRO);
    await finalizar(alheio.body.id, undefined, OUTRO);

    expect((await abrir(DONO)).body.refeito).toBe(false);
  });
});

describe('POST /tentativas com simulado_id', () => {
  it('liga a tentativa ao simulado aberto', async () => {
    const sim = await abrir();
    const res = await responder(sim.body.id);

    expect(res.status).toBe(201);
    expect(res.body.simulado_id).toBe(sim.body.id);
  });

  it('sem simulado_id, segue como antes', async () => {
    const res = await responder(undefined);

    expect(res.status).toBe(201);
    expect(res.body.simulado_id).toBeNull();
  });

  it('recusa simulado já encerrado sem gravar a tentativa', async () => {
    const sim = await abrir();
    await finalizar(sim.body.id);

    const res = await responder(sim.body.id, DONO, 'q-tardia');
    expect(res.status).toBe(409);

    const { rows } = await pool.query(
      'SELECT 1 FROM tentativas WHERE questao_id = $1 AND user_id = $2',
      ['q-tardia', DONO]
    );
    expect(rows).toHaveLength(0);
  });

  it('não responde no simulado de outra pessoa', async () => {
    const alheio = await abrir(OUTRO);
    const res = await responder(alheio.body.id, DONO);

    expect(res.status).toBe(404);
  });

  it('recusa simulado_id malformado', async () => {
    expect((await responder('abc')).status).toBe(400);
    expect((await responder(-1)).status).toBe(400);
  });

  it("sem origem, a resposta do simulado é gravada com origem 'simulado'", async () => {
    const sim = await abrir();
    const res = await responder(sim.body.id);

    expect(res.status).toBe(201);
    expect(res.body.origem).toBe('simulado');
  });

  it('recusa origem que contradiz o simulado_id', async () => {
    const sim = await abrir();
    const res = await request(app)
      .post('/tentativas')
      .set('Authorization', como(DONO))
      .send({ questao_id: 'q-contradiz', correta: false, simulado_id: sim.body.id, origem: 'quiz' });

    expect(res.status).toBe(400);
  });

  it('não grava num simulado que outra aba está finalizando', async () => {
    const sim = await abrir();

    // A "outra aba": encerra o simulado numa transação ainda não commitada.
    const outraAba = await pool.connect();
    try {
      await outraAba.query('BEGIN');
      await outraAba.query(
        `UPDATE simulados SET status = 'finalizado', finalizado_em = NOW(), acertos = 40, anuladas = 0
          WHERE id = $1`,
        [sim.body.id]
      );

      // Dispara a resposta e dá tempo de ela chegar ao banco antes do
      // commit. Sem o FOR SHARE, o EXISTS lia 'aberto' e gravava (201).
      const pendente = responder(sim.body.id, DONO, 'q-corrida').then((r) => r);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await outraAba.query('COMMIT');

      const res = await pendente;
      expect(res.status).toBe(409);
    } finally {
      outraAba.release();
    }

    const { rows } = await pool.query(
      'SELECT 1 FROM tentativas WHERE questao_id = $1 AND user_id = $2',
      ['q-corrida', DONO]
    );
    expect(rows).toHaveLength(0);
  });
});

describe('POST /simulados/:id/finalizar', () => {
  it('grava o resultado; nota = acertos + anuladas', async () => {
    const sim = await abrir();
    const res = await finalizar(sim.body.id, { acertos: 38, anuladas: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'finalizado', acertos: 38, anuladas: 2, nota: 40 });
    expect(res.body.fora_do_tempo).toBe(false);
    expect(Number.isInteger(res.body.duracao_seg)).toBe(true);
  });

  it('marca fora do tempo quem passou das 5 horas, sem recusar', async () => {
    const sim = await abrir();
    await pool.query(
      `UPDATE simulados SET iniciado_em = NOW() - INTERVAL '5 hours 1 minute' WHERE id = $1`,
      [sim.body.id]
    );

    const res = await finalizar(sim.body.id);
    expect(res.status).toBe(200);
    expect(res.body.fora_do_tempo).toBe(true);
  });

  it('valida o resultado', async () => {
    const sim = await abrir();

    expect((await finalizar(sim.body.id, { acertos: 81, anuladas: 0 })).status).toBe(400);
    expect((await finalizar(sim.body.id, { acertos: 79, anuladas: 2 })).status).toBe(400);
    expect((await finalizar(sim.body.id, { acertos: 40 })).status).toBe(400);
    expect((await finalizar(sim.body.id, { acertos: '40', anuladas: 0 })).status).toBe(400);
  });

  it('não finaliza duas vezes', async () => {
    const sim = await abrir();
    await finalizar(sim.body.id, { acertos: 30, anuladas: 0 });

    const res = await finalizar(sim.body.id, { acertos: 70, anuladas: 0 });
    expect(res.status).toBe(409);

    const { rows } = await pool.query('SELECT acertos FROM simulados WHERE id = $1', [sim.body.id]);
    expect(rows[0].acertos).toBe(30);
  });

  it('404 para simulado de outra pessoa, sem mexer nele', async () => {
    const alheio = await abrir(OUTRO);
    const res = await finalizar(alheio.body.id, undefined, DONO);

    expect(res.status).toBe(404);
    const { rows } = await pool.query('SELECT status FROM simulados WHERE id = $1', [alheio.body.id]);
    expect(rows[0].status).toBe('aberto');
  });

  it('400 para id malformado', async () => {
    expect((await finalizar('abc')).status).toBe(400);
  });
});

describe('POST /simulados/:id/abandonar', () => {
  it('encerra sem nota e libera abrir outro', async () => {
    const sim = await abrir();
    const res = await request(app)
      .post(`/simulados/${sim.body.id}/abandonar`)
      .set('Authorization', como(DONO));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'abandonado', nota: null, acertos: null });
    expect((await abrir()).status).toBe(201);
  });

  it('mantém as tentativas já respondidas', async () => {
    const sim = await abrir();
    await responder(sim.body.id, DONO, 'q-fica');
    await request(app)
      .post(`/simulados/${sim.body.id}/abandonar`)
      .set('Authorization', como(DONO));

    const { rows } = await pool.query(
      'SELECT simulado_id::int AS simulado_id FROM tentativas WHERE questao_id = $1 AND user_id = $2',
      ['q-fica', DONO]
    );
    expect(rows).toEqual([{ simulado_id: sim.body.id }]);
  });

  it('abandonado não tem fora_do_tempo, nem depois das 5 horas', async () => {
    const sim = await abrir();
    await pool.query(
      `UPDATE simulados SET iniciado_em = NOW() - INTERVAL '1 day' WHERE id = $1`,
      [sim.body.id]
    );

    const res = await request(app)
      .post(`/simulados/${sim.body.id}/abandonar`)
      .set('Authorization', como(DONO));

    expect(res.status).toBe(200);
    expect(res.body.fora_do_tempo).toBeNull();
  });
});

describe('GET /simulados', () => {
  it('lista só os do próprio usuário, mais recente primeiro', async () => {
    const primeiro = await abrir(DONO, { exame: 44, tipo: 1 });
    await finalizar(primeiro.body.id);
    const segundo = await abrir(DONO, { exame: 45, tipo: 1 });
    await abrir(OUTRO);

    const res = await request(app).get('/simulados').set('Authorization', como(DONO));

    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.id)).toEqual([segundo.body.id, primeiro.body.id]);
  });

  it('paginado=1 devolve o total, para o front saber se a lista está inteira', async () => {
    const primeiro = await abrir(DONO, { exame: 44, tipo: 1 });
    await finalizar(primeiro.body.id);
    const segundo = await abrir(DONO, { exame: 45, tipo: 1 });

    const res = await request(app)
      .get('/simulados?paginado=1&limite=1&offset=1')
      .set('Authorization', como(DONO));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, limite: 1, offset: 1 });
    expect(res.body.simulados.map((s) => s.id)).toEqual([primeiro.body.id]);
    expect(segundo.status).toBe(201);
  });

  it('recusa limite e offset malformados', async () => {
    for (const qs of ['limite=0', 'limite=abc', 'offset=-1']) {
      const res = await request(app).get(`/simulados?${qs}`).set('Authorization', como(DONO));
      expect(res.status).toBe(400);
    }
  });
});

describe('schema', () => {
  it('o banco recusa dois abertos para a mesma pessoa mesmo por fora da rota', async () => {
    await pool.query(`INSERT INTO simulados (user_id, exame, tipo) VALUES ($1, 44, 1)`, [DONO]);
    await expect(
      pool.query(`INSERT INTO simulados (user_id, exame, tipo) VALUES ($1, 45, 1)`, [DONO])
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('o banco recusa status fora da máquina de estados', async () => {
    await expect(
      pool.query(`INSERT INTO simulados (user_id, exame, tipo, status) VALUES ($1, 44, 1, 'pausado')`, [DONO])
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('simulado geral', () => {
  const geral = (questoes = ['101', '102', '103'], userId = DONO) =>
    abrir(userId, { modalidade: 'geral', questoes });

  it('abre com a ordem sorteada, sem exame nem caderno', async () => {
    const res = await geral();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      modalidade: 'geral', questoes: ['101', '102', '103'], exame: null, tipo: null,
      status: 'aberto', refeito: false,
    });
  });

  it('a prova real segue com modalidade prova e sem lista de questões', async () => {
    const res = await abrir();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ modalidade: 'prova', questoes: null, exame: 44, tipo: 1 });
  });

  it('aceita id numérico e guarda como texto', async () => {
    const res = await geral([7, 8]);
    expect(res.status).toBe(201);
    expect(res.body.questoes).toEqual(['7', '8']);
  });

  it('valida a lista de questões e a modalidade', async () => {
    const oitentaEUma = Array.from({ length: 81 }, (_, i) => `q${i}`);
    // Sem o helper `geral`: o parâmetro padrão dele trocaria o `undefined`.
    for (const questoes of [undefined, 'abc', [], ['1', '1'], [''], [null], oitentaEUma, ['x'.repeat(65)]]) {
      const res = await abrir(DONO, { modalidade: 'geral', questoes });
      expect(res.status).toBe(400);
    }
    const res = await abrir(DONO, { modalidade: 'treino', questoes: ['1'] });
    expect(res.status).toBe(400);
  });

  it('conta para o limite de um aberto por pessoa, nas duas modalidades', async () => {
    const primeiro = await geral();
    const res = await abrir();

    expect(res.status).toBe(409);
    expect(res.body.simulado_id).toBe(primeiro.body.id);
    expect((await geral(['9'])).status).toBe(409);
  });

  it('não aceita nota acima do número de questões sorteadas', async () => {
    const aberto = await geral();
    const res = await finalizar(aberto.body.id, { acertos: 4, anuladas: 0 });

    expect(res.status).toBe(400);
    const { rows } = await pool.query('SELECT status FROM simulados WHERE id = $1', [aberto.body.id]);
    expect(rows[0].status).toBe('aberto');
  });

  it('recusa id de questão com espaço nas pontas', async () => {
    const res = await abrir(DONO, { modalidade: 'geral', questoes: [' 101'] });
    expect(res.status).toBe(400);
  });

  it('recebe respostas e finaliza como a prova real', async () => {
    const aberto = await geral();
    expect((await responder(aberto.body.id, DONO, '101')).status).toBe(201);

    const res = await finalizar(aberto.body.id, { acertos: 2, anuladas: 0 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ modalidade: 'geral', status: 'finalizado', nota: 2 });
  });

  it('não marca a prova real como refeita', async () => {
    const aberto = await geral();
    await finalizar(aberto.body.id, { acertos: 1, anuladas: 0 });

    const res = await abrir();
    expect(res.body.refeito).toBe(false);
  });

  it('aparece na listagem com modalidade e questões', async () => {
    await geral(['5', '6']);
    const res = await request(app).get('/simulados').set('Authorization', como(DONO));

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ modalidade: 'geral', questoes: ['5', '6'] });
  });

  it('o banco recusa geral sem questões e prova sem exame', async () => {
    await expect(
      pool.query(`INSERT INTO simulados (user_id, modalidade) VALUES ($1, 'geral')`, [DONO])
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(`INSERT INTO simulados (user_id, tipo) VALUES ($1, 1)`, [DONO])
    ).rejects.toMatchObject({ code: '23514' });
  });
});
