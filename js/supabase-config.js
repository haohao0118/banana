// Supabase 连接配置
// 把下面两个值替换成你 Supabase 项目里的实际值：
//   Dashboard → Settings → API
//     · Project URL   → SUPABASE_URL
//     · anon / public → SUPABASE_ANON_KEY

const SUPABASE_URL      = 'https://fuweeodnlhgcxreizroy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1d2Vlb2RubGhnY3hyZWl6cm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTQ2OTAsImV4cCI6MjA5MjU5MDY5MH0.M0sypby2uqaVEoiwnrZDFiLeggqwqTA6eJnAluDe0tA'; // ← 替换成 Legacy anon key（eyJ 开头）

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
