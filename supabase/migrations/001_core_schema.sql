-- =============================================================
-- MCPX Platform Core Schema
-- =============================================================

-- Updated_at trigger function (reused across tables)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- Users table (extends auth.users with platform-specific fields)
-- =============================================================
CREATE TABLE public.users (
  -- Identity (linked to Supabase Auth)
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,

  -- API key (one per account, unified prefix)
  api_key TEXT UNIQUE NOT NULL DEFAULT ('mcpx_sk_' || encode(gen_random_bytes(24), 'hex')),

  -- Plan (defaults for now, billing built in Sub-project 2)
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),

  -- Developer capability
  is_developer BOOLEAN DEFAULT false,

  -- Phone verification
  phone_number TEXT,
  phone_verified BOOLEAN DEFAULT false,
  phone_verified_at TIMESTAMPTZ,

  -- Email verification tracking
  email_verified BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_api_key ON public.users(api_key);
CREATE INDEX idx_users_email ON public.users(email);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Developer profiles (1:1 with users, created when user enables developer mode)
-- Schema defined now, populated in Sub-project 4
-- =============================================================
CREATE TABLE public.developer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  developer_name TEXT NOT NULL,
  bio TEXT,
  website TEXT,
  github_username TEXT,
  razorpay_account_id TEXT,
  payouts_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER developer_profiles_updated_at
  BEFORE UPDATE ON public.developer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Row Level Security
-- =============================================================

-- Users: read and update own row only
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Developer profiles: owner can read/update, anyone can view (for marketplace)
ALTER TABLE public.developer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can view own profile"
  ON public.developer_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Developers can update own profile"
  ON public.developer_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can view developer profiles"
  ON public.developer_profiles FOR SELECT
  USING (true);

-- =============================================================
-- Auto-create public.users row on Supabase Auth signup
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
