const supabase = window.supabase.createClient(
  'https://yzcxeleheanwnragxkfr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Y3hlbGVoZWFud25yYWd4a2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MDExMjgsImV4cCI6MjEwMjA3NzEyOH0.jOObwRc_wd3L7BOTVQQ5w-4fCD6hPFalQAx7J5n98xA'
);

async function carregarDevocional() {
  const { data, error } = await supabase
    .from('devocionais')
    .select('titulo, conteudo, data_publicacao')
    .eq('publicado', true)
    .order('data_publicacao', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Erro ao buscar devocional:', error);
    return;
  }

  if (data) {
    document.getElementById('titulo-dev').textContent = data.titulo;
    document.getElementById('conteudo-dev').innerHTML = data.conteudo;
    document.getElementById('data-dev').textContent = new Date(data.data_publicacao).toLocaleDateString('pt-BR');
  }
}

carregarDevocional();
