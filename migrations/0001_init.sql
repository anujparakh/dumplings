CREATE TABLE spots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('been', 'want')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes TEXT NOT NULL DEFAULT '',
  visited_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE spot_tags (
  spot_id TEXT REFERENCES spots (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (spot_id, tag)
);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES spots (id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_spot_tags_tag ON spot_tags (tag);
CREATE INDEX idx_photos_spot_id ON photos (spot_id);
