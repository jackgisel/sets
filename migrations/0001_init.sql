CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL DEFAULT 'me',
  created_at TEXT NOT NULL
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  exercise TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  weight REAL,
  unit TEXT CHECK (unit IN ('lb', 'kg')),
  duration_min REAL,
  distance REAL,
  distance_unit TEXT CHECK (distance_unit IN ('mi', 'km')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('planned', 'done')),
  plan_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX entries_date ON entries(date);
CREATE INDEX entries_status_date ON entries(status, date);
CREATE INDEX entries_exercise ON entries(exercise COLLATE NOCASE);
CREATE INDEX entries_plan ON entries(plan_id);
