import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ervbiehftyadigiylofh.supabase.co';
const supabaseKey = 'sb_publishable_fNxu6C-cLxDeyB1F-qTkKA_OU4x5tYn';

// Link de "Esqueci minha senha": o Supabase volta com #...type=recovery na URL
// e o client limpa o hash ao processar — por isso a leitura antes do createClient.
export const openedFromPasswordRecovery =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

export const supabase = createClient(supabaseUrl, supabaseKey);
