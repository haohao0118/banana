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

  INSERT INTO public.profiles (id, username)
  VALUES (new.id, v_username)
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
