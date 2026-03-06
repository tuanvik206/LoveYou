-- ================================================================
-- LoveYou App — Complete Supabase Setup
-- Run once in: Supabase Dashboard → SQL Editor
-- Safe to re-run: uses IF NOT EXISTS + DROP POLICY IF EXISTS
-- Project: https://supabase.com/dashboard/project/jmayxrngqbumpesdkjqq
-- ================================================================


-- ================================================================
-- SECTION 1 — TABLES
-- ================================================================

-- ----------------------------------------------------------------
-- 1.1  couples
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS couples (
  code             TEXT        PRIMARY KEY,
  user1            JSONB,
  user2            JSONB,
  start_date       TIMESTAMPTZ,
  is_connected     BOOLEAN     DEFAULT false,
  user1_mood       TEXT,
  user2_mood       TEXT,
  custom_moods     JSONB       DEFAULT '[]'::jsonb,
  my_birthdate     DATE,
  partner_birthdate DATE,
  my_gender        TEXT        CHECK (my_gender    IN ('male', 'female')),
  partner_gender   TEXT        CHECK (partner_gender IN ('male', 'female')),
  last_nudge_at    TIMESTAMPTZ,
  last_nudge_by    TEXT
);

-- ----------------------------------------------------------------
-- 1.2  messages
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code         TEXT        NOT NULL,
  sender_name  TEXT        NOT NULL,
  text         TEXT,
  image_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 1.3  diary_entries
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diary_entries (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code         TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  author       TEXT        NOT NULL,
  image_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 1.4  user_profiles  (maps auth.users → couple role)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  love_code    TEXT        NOT NULL,
  role         TEXT        NOT NULL CHECK (role IN ('user1', 'user2')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_couple FOREIGN KEY (love_code) REFERENCES couples(code) ON DELETE CASCADE
);

-- ----------------------------------------------------------------
-- 1.5  daily_checkins  (streak tracking)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_checkins (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code         TEXT        NOT NULL,
  user_name    TEXT        NOT NULL,
  checkin_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (code, user_name, checkin_date)
);

-- ----------------------------------------------------------------
-- 1.6  scheduled_messages
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code         TEXT        NOT NULL,
  sender_name  TEXT        NOT NULL,
  text         TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  delivered    BOOLEAN     DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 1.7  menstrual_cycles  (Chu kỳ kinh nguyệt)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menstrual_cycles (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code         TEXT        NOT NULL,
  start_date   DATE        NOT NULL,
  end_date     DATE,
  cycle_length INTEGER     DEFAULT 28,
  period_length INTEGER    DEFAULT 5,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------
-- 1.8  wish_items  (shared wish list)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wish_items (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  emoji        TEXT        NOT NULL DEFAULT '🌟',
  added_by     TEXT        NOT NULL,
  is_done      BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 1.9  photos  (photo wall)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photos (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code         TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  caption      TEXT,
  added_by     TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 1.10  push_subscriptions  (Web Push — background notifications)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  love_code    TEXT        NOT NULL,
  user_name    TEXT        NOT NULL,
  subscription JSONB       NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (love_code, user_name)
);


-- ================================================================
-- SECTION 2 — ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE couples          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE menstrual_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wish_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ---- couples ----
DROP POLICY IF EXISTS "Anyone can read couples by code"  ON couples;
DROP POLICY IF EXISTS "Anyone can insert couples"        ON couples;
DROP POLICY IF EXISTS "Anyone can update couples"        ON couples;

CREATE POLICY "Anyone can read couples by code" ON couples FOR SELECT USING (true);
CREATE POLICY "Anyone can insert couples"        ON couples FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update couples"        ON couples FOR UPDATE USING (true);

-- ---- messages ----
DROP POLICY IF EXISTS "Anyone can read messages"   ON messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON messages;
DROP POLICY IF EXISTS "Anyone can delete messages" ON messages;
DROP POLICY IF EXISTS "Anyone can update messages" ON messages;

CREATE POLICY "Anyone can read messages"   ON messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete messages" ON messages FOR DELETE USING (true);
CREATE POLICY "Anyone can update messages" ON messages FOR UPDATE USING (true);

-- ---- diary_entries ----
DROP POLICY IF EXISTS "Anyone can read diary_entries"   ON diary_entries;
DROP POLICY IF EXISTS "Anyone can insert diary_entries" ON diary_entries;
DROP POLICY IF EXISTS "Anyone can delete diary_entries" ON diary_entries;

CREATE POLICY "Anyone can read diary_entries"   ON diary_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert diary_entries" ON diary_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete diary_entries" ON diary_entries FOR DELETE USING (true);

-- ---- user_profiles (own-record only) ----
DROP POLICY IF EXISTS "Users can read own profile"   ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can read own profile"   ON user_profiles FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = auth_user_id);

-- ---- daily_checkins ----
DROP POLICY IF EXISTS "Anyone can insert checkins" ON daily_checkins;
DROP POLICY IF EXISTS "Anyone can read checkins"   ON daily_checkins;
DROP POLICY IF EXISTS "Anyone can update checkins" ON daily_checkins;

CREATE POLICY "Anyone can insert checkins" ON daily_checkins FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read checkins"   ON daily_checkins FOR SELECT USING (true);
CREATE POLICY "Anyone can update checkins" ON daily_checkins FOR UPDATE USING (true);

-- ---- scheduled_messages ----
DROP POLICY IF EXISTS "Anyone can insert scheduled" ON scheduled_messages;
DROP POLICY IF EXISTS "Anyone can read scheduled"   ON scheduled_messages;
DROP POLICY IF EXISTS "Anyone can update scheduled" ON scheduled_messages;

CREATE POLICY "Anyone can insert scheduled" ON scheduled_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read scheduled"   ON scheduled_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can update scheduled" ON scheduled_messages FOR UPDATE USING (true);

-- ---- menstrual_cycles ----
DROP POLICY IF EXISTS "Anyone can insert menstrual_cycles" ON menstrual_cycles;
DROP POLICY IF EXISTS "Anyone can read menstrual_cycles"   ON menstrual_cycles;
DROP POLICY IF EXISTS "Anyone can update menstrual_cycles" ON menstrual_cycles;
DROP POLICY IF EXISTS "Anyone can delete menstrual_cycles" ON menstrual_cycles;

CREATE POLICY "Anyone can insert menstrual_cycles" ON menstrual_cycles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read menstrual_cycles"   ON menstrual_cycles FOR SELECT USING (true);
CREATE POLICY "Anyone can update menstrual_cycles" ON menstrual_cycles FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete menstrual_cycles" ON menstrual_cycles FOR DELETE USING (true);

-- ---- wish_items ----
DROP POLICY IF EXISTS "Anyone can insert wish_items" ON wish_items;
DROP POLICY IF EXISTS "Anyone can read wish_items"   ON wish_items;
DROP POLICY IF EXISTS "Anyone can update wish_items" ON wish_items;
DROP POLICY IF EXISTS "Anyone can delete wish_items" ON wish_items;

CREATE POLICY "Anyone can insert wish_items" ON wish_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read wish_items"   ON wish_items FOR SELECT USING (true);
CREATE POLICY "Anyone can update wish_items" ON wish_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete wish_items" ON wish_items FOR DELETE USING (true);

-- ---- photos ----
DROP POLICY IF EXISTS "Anyone can insert photos" ON photos;
DROP POLICY IF EXISTS "Anyone can read photos"   ON photos;
DROP POLICY IF EXISTS "Anyone can delete photos" ON photos;

CREATE POLICY "Anyone can insert photos" ON photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read photos"   ON photos FOR SELECT USING (true);
CREATE POLICY "Anyone can delete photos" ON photos FOR DELETE USING (true);

-- ---- push_subscriptions ----
DROP POLICY IF EXISTS "Anyone can upsert push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can read push_subscriptions"   ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can delete push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can update push_subscriptions" ON push_subscriptions;

CREATE POLICY "Anyone can upsert push_subscriptions" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read push_subscriptions"   ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Anyone can delete push_subscriptions" ON push_subscriptions FOR DELETE USING (true);

-- UPDATE needed for upsert (ON CONFLICT DO UPDATE)
DROP POLICY IF EXISTS "Anyone can update push_subscriptions" ON push_subscriptions;
CREATE POLICY "Anyone can update push_subscriptions" ON push_subscriptions FOR UPDATE USING (true);


-- ================================================================
-- SECTION 3 — GRANTS (anon + authenticated)
-- ================================================================

GRANT SELECT, INSERT, UPDATE           ON couples           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE   ON messages          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE           ON user_profiles     TO authenticated;
GRANT SELECT, INSERT, UPDATE           ON daily_checkins    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE           ON scheduled_messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE   ON menstrual_cycles  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE   ON wish_items        TO anon, authenticated;
GRANT SELECT, INSERT, DELETE           ON photos            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE   ON push_subscriptions TO anon, authenticated;


-- ================================================================
-- SECTION 4 — REALTIME
-- ================================================================

-- REPLICA IDENTITY FULL — required so Realtime DELETE events carry old record
ALTER TABLE messages        REPLICA IDENTITY FULL;
ALTER TABLE diary_entries   REPLICA IDENTITY FULL;
ALTER TABLE menstrual_cycles REPLICA IDENTITY FULL;
ALTER TABLE photos          REPLICA IDENTITY FULL;
ALTER TABLE wish_items      REPLICA IDENTITY FULL;

-- Enable Realtime publication (safe: skips if already added)
DO $$
DECLARE
  tables TEXT[] := ARRAY['couples','messages','diary_entries','user_profiles',
                          'daily_checkins','scheduled_messages','menstrual_cycles',
                          'wish_items','photos'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;


-- ================================================================
-- SECTION 5 — INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_messages_code_created      ON messages        (code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_code_created         ON diary_entries   (code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couples_code               ON couples         (code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user    ON user_profiles   (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_love_code    ON user_profiles   (love_code);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_code        ON daily_checkins  (code, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_delivery ON scheduled_messages (code, delivered, scheduled_at)
  WHERE delivered = false;
CREATE INDEX IF NOT EXISTS idx_menstrual_cycles_code      ON menstrual_cycles(code, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_wish_items_code            ON wish_items      (code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_code                ON photos          (code, created_at DESC);


-- ================================================================
-- SECTION 6 — STORAGE POLICIES
-- Buckets must be created first via Dashboard → Storage
-- (avatars, chat-images, diary-images, photos — all public)
-- ================================================================

-- ---- avatars ----
DROP POLICY IF EXISTS "Public read avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Auth update avatars"  ON storage.objects;

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Auth delete avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');

-- ---- chat-images ----
DROP POLICY IF EXISTS "Public read chat-images"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload chat-images"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete chat-images"  ON storage.objects;

CREATE POLICY "Public read chat-images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat-images');

CREATE POLICY "Auth upload chat-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Auth delete chat-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-images');

-- ---- diary-images ----
DROP POLICY IF EXISTS "Public read diary-images"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload diary-images"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete diary-images"  ON storage.objects;

CREATE POLICY "Public read diary-images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'diary-images');

CREATE POLICY "Auth upload diary-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'diary-images');

CREATE POLICY "Auth delete diary-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'diary-images');

-- ---- photos ----
DROP POLICY IF EXISTS "Public read photos-bucket"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload photos-bucket"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete photos-bucket"  ON storage.objects;

CREATE POLICY "Public read photos-bucket"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'photos');

CREATE POLICY "Auth upload photos-bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Auth delete photos-bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos');


-- ================================================================
-- END OF SETUP
-- ================================================================
-- After running this script:
-- 1. Go to Storage → create buckets: avatars, chat-images, diary-images, photos (all public)
-- 2. Deploy the Next.js app (Vercel recommended)
-- 3. Set env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
-- ================================================================

