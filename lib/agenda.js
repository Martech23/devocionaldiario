/**
 * QUEM RECEBE O LEMBRETE AGORA
 *
 * O cron era diário e disparava num horário só do mundo: 8h de Brasília
 * é 3h da manhã em Los Angeles e 19h em Manila. Num produto de hábito
 * diário, a hora da entrega é o produto.
 *
 * Agora o envio é chamado de hora em hora e cada execução manda apenas
 * para quem, no próprio fuso, está na hora que escolheu.
 *
 * O relógio de hora em hora não é o da Vercel: conta Hobby só aceita um
 * cron por dia, e o deploy é recusado com qualquer coisa mais frequente.
 * Quem chama é o GitHub Actions (.github/workflows/lembrete.yml), que
 * bate no mesmo endpoint com o CRON_SECRET. O cron da Vercel continua
 * lá como rede de segurança de uma vez por dia.
 *
 * Este arquivo é só decisão — nada de rede, nada de Redis — para poder
 * ser testado com relógio de mentira em vez de esperar amanhecer no
 * Japão.
 */

const FUSO_PADRAO = 'America/Sao_Paulo';
const HORA_PADRAO = 8;

/**
 * Que dia e que hora são, agora, no fuso de alguém.
 * Devolve a data como 'YYYY-MM-DD' e a hora como número de 0 a 23.
 *
 * Sai do Intl e não de conta com offset porque horário de verão existe:
 * o deslocamento de um fuso muda duas vezes por ano, e guardar minutos
 * de diferença deixaria metade dos usuários uma hora fora dois meses
 * por ano.
 */
function momentoLocal(fuso, agora = new Date()) {
  let partes;
  try {
    partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso || FUSO_PADRAO,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hour12: false
    }).formatToParts(agora);
  } catch (e) {
    /* fuso desconhecido — aparelho com relógio esquisito, ou o nome
       mudou de uma versão do ICU para outra. Cai no padrão em vez de
       derrubar o envio de todo mundo. */
    if ((fuso || '') === FUSO_PADRAO) throw e;
    return momentoLocal(FUSO_PADRAO, agora);
  }
  const p = {};
  for (const x of partes) p[x.type] = x.value;
  /* 'en-CA' com hour12:false devolve 24 para a meia-noite em algumas
     versões do ICU, e 0 em outras */
  const hora = Number(p.hour) % 24;
  return { data: `${p.year}-${p.month}-${p.day}`, hora };
}

/** O fuso é utilizável? Serve para recusar lixo já na inscrição. */
function fusoValido(fuso) {
  if (typeof fuso !== 'string' || !fuso || fuso.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: fuso });
    return true;
  } catch (e) {
    return false;
  }
}

/** A hora escolhida é utilizável? Fora disso, cai no padrão. */
function horaValida(h) {
  return Number.isInteger(h) && h >= 0 && h <= 23;
}

/**
 * DE QUANTAS HORAS É A SEGUNDA CHANCE
 *
 * O relógio que dispara o envio não é pontual. O cron do GitHub atrasa
 * quando a fila está cheia — minutos, às vezes muito mais — e pode
 * simplesmente pular uma execução. Se "na hora" fosse só a igualdade
 * exata, um atraso de cinco minutos passando das 8h para as 9h faria
 * quem escolheu as 8h não receber nada naquele dia.
 *
 * Então a janela é de três horas: a hora escolhida e as duas seguintes.
 * Mandar 9h20 quando a pessoa pediu 8h é uma imprecisão; não mandar é
 * um lembrete perdido, que é bem pior num produto de hábito diário.
 *
 * Isso só é seguro porque a trava de envio (marcarEnvio, uma por
 * endpoint e por data local) garante uma notificação por dia. A janela
 * escolhe mais vezes, a trava entrega uma vez.
 */
const TOLERANCIA_HORAS = 2;

/**
 * Está na hora de mandar para esta inscrição?
 *
 * Inscrição antiga não tem fuso nem hora: cai em Brasília às 8h, que é
 * exatamente o que ela já recebia. Ninguém perde o lembrete por causa
 * desta mudança.
 */
function naHoraDe(sub, agora = new Date()) {
  const fuso = fusoValido(sub && sub.fuso) ? sub.fuso : FUSO_PADRAO;
  const hora = horaValida(sub && sub.hora) ? sub.hora : HORA_PADRAO;
  const local = momentoLocal(fuso, agora);
  /* A janela não dá a volta na meia-noite de propósito. Com resto de 24,
     quem escolheu as 23h seria escolhido de novo à 0h e à 1h — outra
     data local, trava nova, segunda notificação de madrugada com o
     versículo do dia seguinte. O atraso só conta para frente e dentro
     do mesmo dia. */
  const atraso = local.hora - hora;
  return {
    enviar: atraso >= 0 && atraso <= TOLERANCIA_HORAS,
    atraso: atraso,
    data: local.data,
    hora: local.hora,
    fuso
  };
}

/**
 * Separa as inscrições entre as que recebem agora e as que esperam.
 * Devolve também a data local de cada uma, que é a chave para não
 * mandar duas vezes no mesmo dia e para escolher o versículo certo —
 * quem está no Japão já virou o dia quando aqui ainda é ontem.
 */
function paraEnviarAgora(subs, agora = new Date()) {
  const agora_ = agora;
  const escolhidas = [];
  for (const sub of subs || []) {
    /* sem endpoint não há para onde mandar: escolher só adiaria a falha
       para o meio do envio, contando como erro o que é lixo guardado */
    if (!sub || !sub.endpoint) continue;
    const d = naHoraDe(sub, agora_);
    if (d.enviar) escolhidas.push({ sub, dataLocal: d.data, fuso: d.fuso, atraso: d.atraso });
  }
  return escolhidas;
}

module.exports = {
  FUSO_PADRAO, HORA_PADRAO,
  TOLERANCIA_HORAS,
  momentoLocal, fusoValido, horaValida, naHoraDe, paraEnviarAgora
};
