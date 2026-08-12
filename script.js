const SUPABASE_URL = 'https://yzcxeleheanwnragxkfr.supabase.co'; 
const SUPABASE_ANON_KEY = 'Sb_publishable_uhCDsJE0a1Vu5xx34A55Tw_4v-VFwt4';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function carregarDevocional() {
    try {
        const { data, error } = await supabase
            .from('devocionais') 
            .select('*')
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            const devocional = data[0];
            
            // Procura os espaços no HTML para colocar o texto
            const caixaTitulo = document.getElementById('titulo-devocional');
            const caixaTexto = document.getElementById('texto-devocional');
            const skeletonLoaders = document.getElementById('esqueleto-carregamento'); // Opcional, para esconder as barrinhas

            // Injeta o texto vindo do Supabase
            if (caixaTitulo && caixaTexto) {
                caixaTitulo.innerText = devocional.titulo;
                caixaTexto.innerText = devocional.texto;
                
                // Esconde as barrinhas se o elemento existir
                if (skeletonLoaders) skeletonLoaders.style.display = 'none';
            } else {
                console.log("Atenção: Não encontrei onde colocar o texto no HTML.");
            }
        }
    } catch (erro) {
        console.error("Erro ao carregar:", erro.message);
    }
}

carregarDevocional();
