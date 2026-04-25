-- 猴哥传奇 · Supabase 数据库初始化
-- 在 Supabase 项目的 SQL Editor 里全选运行一次

-- 1. 用户名表（对应 Supabase Auth 里的用户）
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. 存档表（每人一行，存档以 JSONB 格式整体存）
CREATE TABLE IF NOT EXISTS game_saves (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  save_data  jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- 3. 开启行级安全（RLS）
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;

-- 4. profiles 策略
-- SELECT 允许所有人读（登录时需要按用户名查找 id，此时还未认证）
DROP POLICY IF EXISTS "public_read_profiles" ON profiles;
CREATE POLICY "public_read_profiles" ON profiles
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE 只能操作自己的记录
DROP POLICY IF EXISTS "own_profile_write" ON profiles;
CREATE POLICY "own_profile_write" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 5. game_saves 策略：只能读写自己的记录
DROP POLICY IF EXISTS "own_saves_all" ON game_saves;
CREATE POLICY "own_saves_all" ON game_saves
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
