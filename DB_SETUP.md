# Database Setup Instructions

To implement the user-submitted pictures feature and enhanced image randomization, the following database changes are required:

## 1. Create location_submissions table

```sql
CREATE TABLE location_submissions (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5),
  level INTEGER,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  submitted_by UUID REFERENCES auth.users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable real-time subscriptions for the submissions table
alter publication supabase_realtime add table location_submissions;
```

## 2. (Recommended) Add created_at column to locations table

For more accurate "favor recently added" functionality, add a timestamp column to track when locations were added:

```sql
ALTER TABLE locations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for better performance when querying by recency
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON locations(created_at DESC);
```

## 3. Policies (if using Row Level Security)

If you have RLS enabled on your Supabase project, you'll need to add appropriate policies:

### For locations table (assuming admins can manage, users can read for game):
```sql
-- Allow anyone to read locations (needed for game)
create policy "Locations are viewable by everyone"
  on locations for select
  using (true);

-- Allow admins to insert/update/delete locations
create policy "Locations are manageable by admins"
  on locations for all
  using (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() 
      AND email IN ('jerche28@bergen.org', 'samshi28@bergen.org', 'sambas28@bergen.org')
    )
  );
```

### For location_submissions table:
```sql
-- Users can insert their own submissions
create policy "Users can submit locations"
  on location_submissions for insert
  with check (auth.role() = 'authenticated');

-- Users can view their own submissions
create policy "Users can view their own submissions"
  on location_submissions for select
  using (submitted_by = auth.uid());

-- Admins can view all submissions
create policy "Admins can view all submissions"
  on location_submissions for select
  using (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email IN ('jerche28@bergen.org', 'samshi28@bergen.org', 'sambas28@bergen.org')
    )
  );

-- Admins can update submission status (approve/reject)
create policy "Admins can review submissions"
  on location_submissions for update
  using (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email IN ('jerche28@bergen.org', 'samshi28@bergen.org', 'sambas28@bergen.org')
    )
  )
  with check (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email IN ('jerche28@bergen.org', 'samshi28@bergen.org', 'sambas28@bergen.org')
    )
  );
```