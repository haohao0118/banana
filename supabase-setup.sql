-- 猴哥传奇 · Supabase 数据库初始化
-- 在 Supabase 项目的 SQL Editor 里全选运行一次

-- 1. 用户名表（对应 Supabase Auth 里的用户）
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text UNIQUE NOT NULL,
  email      text,
  created_at timestamptz DEFAULT now()
);

-- 兼容已创建的 profiles 表
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. 存档表（每人一行，存档以 JSONB 格式整体存）
CREATE TABLE IF NOT EXISTS game_saves (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  save_data  jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- 2.5 注册后自动创建资料和存档
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  v_username := COALESCE(NULLIF(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1));

  INSERT INTO public.profiles (id, username, email)
  VALUES (new.id, v_username, new.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.game_saves (user_id, save_data, updated_at)
  VALUES (new.id, '{}'::jsonb, now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
