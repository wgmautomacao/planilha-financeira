function formatCurrency(value) {
    if (isNaN(value)) value = 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
function formatPercentage(value) {
    if (isNaN(value)) value = 0;
    return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(value / 100);
}
function calcular() {
    const btn = document.querySelector('.calculate-btn');
    btn.classList.add('loading');
    btn.disabled = true;
    btn.innerHTML = 'Calculando...<span class="loader"></span>';
    setTimeout(() => {
        const getValor = (id) => {
            const value = parseFloat(document.getElementById(id).value);
            return isNaN(value) ? 0 : value;
        };
        const massagemTotal = getValor('massagem_valor') * getValor('massagem_qtd');
        const drenagemTotal = getValor('drenagem_valor') * getValor('drenagem_qtd');
        const limpezaTotal = getValor('limpeza_valor') * getValor('limpeza_qtd');
        const peelingTotal = getValor('peeling_valor') * getValor('peeling_qtd');
        const outrosTotal = getValor('outros_valor') * getValor('outros_qtd');
        document.getElementById('massagem_total').innerText = formatCurrency(massagemTotal);
        document.getElementById('drenagem_total').innerText = formatCurrency(drenagemTotal);
        document.getElementById('limpeza_total').innerText = formatCurrency(limpezaTotal);
        document.getElementById('peeling_total').innerText = formatCurrency(peelingTotal);
        document.getElementById('outros_total').innerText = formatCurrency(outrosTotal);
        const totalReceitas = massagemTotal + drenagemTotal + limpezaTotal + peelingTotal + outrosTotal;
        document.getElementById('total_receitas').innerText = formatCurrency(totalReceitas);
        document.getElementById('resumo_receita').innerText = formatCurrency(totalReceitas);
        const custoFixo = getValor('aluguel') + getValor('energia') + getValor('agua') + getValor('internet') + getValor('seguro') + getValor('marketing') + getValor('manutencao') + getValor('outros_fixos');
        document.getElementById('total_custos_fixos').innerText = formatCurrency(custoFixo);
        document.getElementById('resumo_custos_fixos').innerText = formatCurrency(custoFixo);
        const custoVariavel = getValor('produtos_massagem') + getValor('produtos_estetica') + getValor('descartaveis') + getValor('limpeza_produtos') + getValor('transporte') + getValor('outros_variaveis');
        document.getElementById('total_custos_variaveis').innerText = formatCurrency(custoVariavel);
        document.getElementById('resumo_custos_variaveis').innerText = formatCurrency(custoVariavel);
        const impostos = getValor('das_mei') + getValor('taxa_conselho') + getValor('outras_taxas');
        document.getElementById('total_impostos').innerText = formatCurrency(impostos);
        document.getElementById('resumo_impostos').innerText = formatCurrency(impostos);
        const totalCustos = custoFixo + custoVariavel + impostos;
        const lucroLiquido = totalReceitas - totalCustos;
        document.getElementById('total_custos').innerText = formatCurrency(totalCustos);
        document.getElementById('lucro_liquido').innerText = formatCurrency(lucroLiquido);
        const percCustoFixo = totalReceitas > 0 ? (custoFixo / totalReceitas) * 100 : 0;
        const percCustoVariavel = totalReceitas > 0 ? (custoVariavel / totalReceitas) * 100 : 0;
        const percImpostos = totalReceitas > 0 ? (impostos / totalReceitas) * 100 : 0;
        const percTotalCustos = totalReceitas > 0 ? (totalCustos / totalReceitas) * 100 : 0;
        const percLucro = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;
        document.getElementById('perc_custos_fixos').innerText = formatPercentage(percCustoFixo);
        document.getElementById('perc_custos_variaveis').innerText = formatPercentage(percCustoVariavel);
        document.getElementById('perc_impostos').innerText = formatPercentage(percImpostos);
        document.getElementById('perc_total_custos').innerText = formatPercentage(percTotalCustos);
        document.getElementById('perc_lucro').innerText = formatPercentage(percLucro);
        const margemLucro = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;
        const totalAtendimentos = getValor('massagem_qtd') + getValor('drenagem_qtd') + getValor('limpeza_qtd') + getValor('peeling_qtd') + getValor('outros_qtd');
        const ticketMedio = totalAtendimentos > 0 ? totalReceitas / totalAtendimentos : 0;
        const custoAtendimento = totalAtendimentos > 0 ? totalCustos / totalAtendimentos : 0;
        document.getElementById('margem_lucro').innerText = formatPercentage(margemLucro);
        document.getElementById('ponto_equilibrio').innerText = formatCurrency(totalCustos);
        document.getElementById('ticket_medio').innerText = formatCurrency(ticketMedio);
        document.getElementById('custo_atendimento').innerText = formatCurrency(custoAtendimento);
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.textContent = '🔄 Calcular Resultados';
    }, 500);
}
window.onload = calcular;