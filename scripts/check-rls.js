require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('Faltam credenciais: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  const { data, error } = await supabase.rpc('exec_sql', { sql: `
    SELECT relname as tabela, relrowsecurity as rls_ativo 
    FROM pg_class 
    WHERE relnamespace = 'public'::regnamespace 
    AND relkind = 'r'
    ORDER BY relname;
  ` });
  if (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
})();
