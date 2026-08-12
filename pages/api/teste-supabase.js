import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Tenta buscar algo na tabela (mesmo que vazia, só para testar conexão)
    const { data, error } = await supabase
      .from('devocionais')
      .select('id')
      .limit(1)

    if (error) {
      return res.status(200).json({ 
        status: 'erro', 
        mensagem: 'Não conseguiu conectar: ' + error.message 
      })
    }

    return res.status(200).json({ 
      status: 'sucesso', 
      mensagem: 'Conexão com Supabase está funcionando perfeitamente! 🎉',
      dados: data
    })
  } catch (e) {
    return res.status(200).json({ 
      status: 'erro', 
      mensagem: 'Erro no servidor: ' + e.message 
    })
  }
}
