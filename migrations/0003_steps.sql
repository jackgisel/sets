-- One row per day: the day's total step count (phones report a running total, so writes replace it).
CREATE TABLE steps (
  date TEXT PRIMARY KEY,
  steps INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL
);
