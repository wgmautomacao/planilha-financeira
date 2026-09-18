/* Ponto Cego — o único arquivo que você mexe para vender.
 * Troque o linkCheckout pelo link do seu produto na Kiwify/Hotmart e republique.
 */
window.CONFIG = {
  preco: 'R$ 34,97',

  // Cole aqui o link de checkout do produto. Enquanto estiver com o valor
  // abaixo, o botão avisa que a venda ainda não está configurada.
  linkCheckout: 'CONFIGURAR',

  // Aparece no aviso de erro de chave, para o comprador achar você.
  suporte: '',

  // Modos liberados sem licença. O diagnóstico é a isca: o visitante vê o
  // próprio radar antes de pagar.
  modosLivres: ['diagnostico'],

  // 361 questões de prova têm enunciado e gabarito válidos, mas a resolução do
  // PDF original não reconstrói (fração empilhada, tabela de proporção). Elas
  // ficam FORA do app: questão sem resolução não é o que o comprador pagou.
  // Ligue só se quiser usá-las como treino seco, ciente da ausência.
  incluirSemResolucao: false
};
