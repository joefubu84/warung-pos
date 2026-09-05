import { supabase } from './src/integrations/supabase/client';

async function check() {
  const { error } = await supabase.from('landing_page_config').select('*').limit(1);
  if (error) {
    console.log('Error or table does not exist:', error.message);
  } else {
    console.log('Table landing_page_config exists!');
  }
}
check();
