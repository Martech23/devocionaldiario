  const SUPABASE_URL = 'https://yzcxeleheanwnragxkfr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Y3hlbGVoZWFud25yYWd4a2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MDExMjgsImV4cCI6MjEwMjA3NzEyOH0.jOObwRc_wd3L7BOTVQQ5w-4fCD6hPFalQAx7J5n98xA';

  async function carregarDevocionalSupabase() {
    if (!window.supabase || !window.supabase.createClient) return;   /* offline, ou CDN fora */
    if (document.getElementById('bloco-extra')) return;              /* já está na tela */
    try {
      const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await sb
        .from('devocionais')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      if (!data || !data.length) return;

      const item = data[0];
      const titulo = String(item.titulo || '').trim();
      const texto = String(item.texto || item.conteudo || '').trim();
      if (!titulo && !texto) return;

      /* Entra dentro da seção do dia, e não com `body.prepend`. Antes a
         caixa nascia acima da barra fixa do app e empurrava a tela
         inteira para baixo dois segundos depois de carregar. */
      const secao = document.getElementById('sec-hoje');
      if (!secao) return;

      const caixa = document.createElement('div');
      caixa.id = 'bloco-extra';
      caixa.className = 'cartao bloco-extra';

      const h = document.createElement('h3');
      h.textContent = titulo;                 /* texto, nunca HTML */
      const p = document.createElement('p');
      p.textContent = texto;                  /* idem */

      if (titulo) caixa.appendChild(h);
      if (texto) caixa.appendChild(p);
      secao.appendChild(caixa);
    } catch (e) {
      /* o extra é extra: se falhar, o devocional do dia continua lá */
      console.info('Supabase:', e && e.message);
    }
  }
  setTimeout(carregarDevocionalSupabase, 2000);
