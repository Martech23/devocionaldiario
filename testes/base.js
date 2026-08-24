/**
 * O endereço do servidor de testes, num lugar só.
 *
 * A porta estava gravada em 41 arquivos. Bastava uma máquina com algo
 * já ouvindo na 8099 para a suíte inteira parar, e o PORTA_TESTE que o
 * rodar.js oferecia não chegava a lugar nenhum.
 *
 *   PORTA_TESTE=8100 npm test
 */
module.exports = 'http://localhost:' + (process.env.PORTA_TESTE || 8099);
