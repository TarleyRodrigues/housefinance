import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ervbiehftyadigiylofh.supabase.co';
const supabaseKey = 'sb_publishable_fNxu6C-cLxDeyB1F-qTkKA_OU4x5tYn';

export const supabase = createClient(supabaseUrl, supabaseKey);