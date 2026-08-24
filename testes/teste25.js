const RAIZ = require('path').resolve(__dirname, '..');
/* Lembrete diário no fuso de cada um — lógica pura, sem navegador */
const {
  FUSO_PADRAO, HORA_PADRAO, TOLERANCIA_HORAS,
  momentoLocal, fusoValido, horaValida, naHoraDe, paraEnviarAgora
} = require(RAIZ + '/lib/agenda.js');

let OK = 0, F = 0;
const ok = (n, v, x) => { v ? OK++ : F++;
  console.log((v ? '  OK  ' : ' FALHA') + ' | ' + n + (x !== undefined ? '  → ' + x : '')); };

/* 11:00 UTC — o horário do cron antigo, 8h em Brasília */
const ONZE_UTC = new Date('2026-03-10T11:00:00Z');

console.log('\n=== que horas são para cada um ===');
const casos = [
  ['America/Sao_Paulo', 8, 'Brasília'],
  /* 4h e não 3h: em 10 de março de 2026 o horário de verão americano já
     começou (dia 8), e Los Angeles está em UTC-7. Errei esta expectativa
     na primeira escrita — é exatamente o erro que a conta com offset
     fixo cometeria o ano inteiro. */
  ['America/Los_Angeles', 4, 'Los Angeles'],
  ['Asia/Manila', 19, 'Manila'],
  ['Europe/Lisbon', 11, 'Lisboa'],
  ['Pacific/Auckland', 0, 'Auckland']
];
for(const [fuso, esperada, nome] of casos){
  const m = momentoLocal(fuso, ONZE_UTC);
  ok(`às 11h UTC, em ${nome} são ${esperada}h`, m.hora === esperada, m.hora + 'h de ' + m.data);
}

console.log('\n=== o horário de verão não pode ser conta de offset ===');
/* guardar minutos de diferença deixaria metade dos usuários uma hora
   fora durante dois meses por ano */
const inverno = new Date('2026-01-15T12:00:00Z');
const verao   = new Date('2026-07-15T12:00:00Z');
const ny = { inv: momentoLocal('America/New_York', inverno).hora,
             ver: momentoLocal('America/New_York', verao).hora };
ok('Nova York muda de hora entre janeiro e julho', ny.inv !== ny.ver, ny.inv + 'h × ' + ny.ver + 'h');
const sp = { inv: momentoLocal('America/Sao_Paulo', inverno).hora,
             ver: momentoLocal('America/Sao_Paulo', verao).hora };
ok('e São Paulo, que não tem mais horário de verão, não muda', sp.inv === sp.ver, sp.inv + 'h');

console.log('\n=== o dia local não é o dia do servidor ===');
/* quem está no Japão já virou o dia quando aqui ainda é ontem — e o
   versículo tem de ser o do dia dele */
const quaseMeiaNoite = new Date('2026-03-10T16:00:00Z');   /* 13h aqui, 1h da madrugada em Tóquio */
const aqui = momentoLocal('America/Sao_Paulo', quaseMeiaNoite).data;
const la = momentoLocal('Asia/Tokyo', quaseMeiaNoite).data;
ok('Tóquio já está no dia seguinte', la > aqui, aqui + ' aqui, ' + la + ' em Tóquio');

console.log('\n=== fuso e hora inválidos não derrubam ninguém ===');
ok('fuso conhecido passa', fusoValido('Europe/Berlin'));
ok('fuso inventado é recusado', !fusoValido('Terra/Media'));
ok('texto vazio é recusado', !fusoValido(''));
ok('número não é fuso', !fusoValido(42));
ok('texto gigante é recusado', !fusoValido('a'.repeat(200)));
ok('hora 0 vale', horaValida(0));
ok('hora 23 vale', horaValida(23));
ok('hora 24 não vale', !horaValida(24));
ok('hora quebrada não vale', !horaValida(7.5));
ok('hora em texto não vale', !horaValida('8'));
const comLixo = momentoLocal('Terra/Media', ONZE_UTC);
ok('fuso inventado cai no padrão em vez de estourar', comLixo.hora === 8, comLixo.hora + 'h');

console.log('\n=== quem recebe agora ===');
const subs = [
  { endpoint: 'a', fuso: 'America/Sao_Paulo', hora: 8 },
  { endpoint: 'b', fuso: 'America/Los_Angeles', hora: 8 },
  { endpoint: 'c', fuso: 'Asia/Manila', hora: 19 },
  { endpoint: 'd', fuso: 'Europe/Lisbon', hora: 6 },
  { endpoint: 'e' }                                    /* inscrição antiga */
];
const agora = paraEnviarAgora(subs, ONZE_UTC).map(x => x.sub.endpoint);
ok('Brasília às 8h recebe', agora.includes('a'));
ok('Manila às 19h recebe', agora.includes('c'));
ok('Los Angeles, que está às 3h, não recebe', !agora.includes('b'));
ok('Lisboa, que pediu 6h e está às 11h, não recebe', !agora.includes('d'));
ok('e são só esses três', agora.length === 3, agora.join(', '));

console.log('\n=== inscrição antiga continua recebendo como antes ===');
/* é a garantia de que esta mudança não tira o lembrete de ninguém */
ok('sem fuso nem hora, recebe às 11h UTC como o cron antigo', agora.includes('e'));
const antiga = naHoraDe({ endpoint: 'x' }, ONZE_UTC);
ok('porque o padrão é Brasília', antiga.fuso === FUSO_PADRAO, antiga.fuso);
ok('e a hora padrão é 8', HORA_PADRAO === 8);
const noutraHora = naHoraDe({ endpoint: 'x' }, new Date('2026-03-10T15:00:00Z'));
ok('e não recebe nas outras 23 horas', !noutraHora.enviar, noutraHora.hora + 'h local');

console.log('\n=== cada hora do dia acha alguém ===');
/* a soma das 24 execuções tem de achar todo inscrito — nenhum pode
   passar o dia inteiro sem ser escolhido nenhuma vez */
const umDia = [];
for(let h = 0; h < 24; h++){
  const t = new Date(Date.UTC(2026, 2, 10, h, 0, 0));
  umDia.push(...paraEnviarAgora(subs, t).map(x => x.sub.endpoint));
}
const conta = {};
for(const e of umDia) conta[e] = (conta[e] || 0) + 1;
ok('todos os cinco recebem no dia', Object.keys(conta).length === 5, JSON.stringify(conta));
/* Escolher três vezes é de propósito: é a janela de recuperação. O
   relógio que chama o envio é o cron do GitHub, que atrasa e às vezes
   pula uma execução; sem a janela, um atraso de cinco minutos passando
   das 8h para as 9h custaria o lembrete do dia inteiro.
   Quem garante a entrega única é a trava no Redis, e é o teste16 que
   prova isso ponta a ponta. Aqui a conta é de escolhas, não de envios. */
ok('cada um é escolhido três vezes: a hora dele e as duas seguintes',
   Object.values(conta).every(n => n === TOLERANCIA_HORAS + 1), JSON.stringify(conta));

console.log('\n=== a janela de recuperação ===');
const janela = h => naHoraDe({ endpoint: 'j', fuso: 'UTC', hora: 8 },
                             new Date(Date.UTC(2026, 2, 10, h, 0, 0)));
ok('na hora certa, entra', janela(8).enviar, 'atraso ' + janela(8).atraso);
ok('uma hora atrasado, ainda entra', janela(9).enviar, 'atraso ' + janela(9).atraso);
ok('duas horas atrasado, ainda entra', janela(10).enviar, 'atraso ' + janela(10).atraso);
ok('três horas atrasado, já não', !janela(11).enviar, 'atraso ' + janela(11).atraso);
ok('e antes da hora, nunca', !janela(7).enviar, 'atraso ' + janela(7).atraso);

/* Era esta a armadilha: com resto de 24, quem escolhe as 23h seria
   escolhido de novo à 0h e à 1h — outra data local, trava nova, e uma
   segunda notificação de madrugada com o versículo do dia seguinte. */
const tarde = { endpoint: 'z', fuso: 'UTC', hora: 23 };
const meia = naHoraDe(tarde, new Date(Date.UTC(2026, 2, 11, 0, 0, 0)));
ok('quem pede 23h não é pego de novo à meia-noite', !meia.enviar, meia.hora + 'h em ' + meia.data);
ok('nem à 1h da manhã',
   !naHoraDe(tarde, new Date(Date.UTC(2026, 2, 11, 1, 0, 0))).enviar);
ok('e às 23h recebe normalmente',
   naHoraDe(tarde, new Date(Date.UTC(2026, 2, 10, 23, 0, 0))).enviar);
/* a janela nunca pode cruzar a data local, senão a trava não segura */
let cruzou = 0;
for(let escolhida = 0; escolhida < 24; escolhida++){
  const s = { endpoint: 'w', fuso: 'UTC', hora: escolhida };
  const datas = new Set();
  for(let h = 0; h < 48; h++){
    const t = new Date(Date.UTC(2026, 2, 10, h, 0, 0));
    const d = naHoraDe(s, t);
    if(d.enviar) datas.add(d.data);
  }
  /* dois dias de execuções = duas datas, uma por dia. Três seria a
     janela vazando de um dia para o outro. */
  if(datas.size !== 2) cruzou++;
}
ok('em qualquer hora escolhida, a janela fica dentro do dia', cruzou === 0, cruzou + ' horas vazaram');

console.log('\n=== a data local vem junto, para não mandar duas vezes ===');
const escolhidas = paraEnviarAgora(subs, ONZE_UTC);
ok('cada escolhida traz a data local', escolhidas.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.dataLocal)),
   escolhidas.map(x => x.sub.endpoint + '=' + x.dataLocal).join(' '));
ok('e traz o fuso resolvido', escolhidas.every(x => !!x.fuso));

console.log('\n=== lista vazia ou estranha não quebra ===');
ok('lista vazia', paraEnviarAgora([], ONZE_UTC).length === 0);
ok('undefined', paraEnviarAgora(undefined, ONZE_UTC).length === 0);
ok('inscrição nula é ignorada em vez de derrubar a volta',
   paraEnviarAgora([null, { endpoint: 'z' }], ONZE_UTC).length === 1);
ok('e inscrição sem endpoint também',
   paraEnviarAgora([{ fuso: 'America/Sao_Paulo' }, { endpoint: 'z' }], ONZE_UTC).length === 1);

console.log('\n=== TOTAL: ' + OK + ' asserções, ' + F + ' falhas ===');
process.exit(F ? 1 : 0);
