// 1. Conexão com o Supabase com as suas chaves oficiais
const SUPABASE_URL = 'https://yzcxeleheanwnragxkfr.supabase.co'; 
const SUPABASE_ANON_KEY = 'Sb_publishable_uhCDsJE0a1Vu5xx34A55Tw_4v-VFwt4';

// 2. Inicializa o cliente do Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Função para testar se está tudo funcionando
async function testarConexao() {
    console.log("Tentando conectar com o banco de dados da Bíblia Devocional...");
    
    try {
        // Tenta buscar os dados da tabela (mesmo que ainda não exista)
        const { data, error } = await supabase
            .from('devocionais') 
            .select('*')
            .limit(1);

        if (error) {
            console.error("Erro ao buscar no banco:", error.message);
        } else {
            console.log("SUCESSO! Conexão estabelecida. Dados encontrados:", data);
        }
    } catch (erro) {
        console.error("Erro inesperado:", erro);
    }
}

// 4. Roda o teste assim que a página carrega
testarConexao();
