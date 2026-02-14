BEGIN;

-- DROP everything
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS columns CASCADE;
DROP TABLE IF EXISTS boards CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- USERS
CREATE TABLE users (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOARDS
CREATE TABLE boards (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_boards_owner_id ON boards(owner_id);

-- COLUMNS (per board)
CREATE TABLE columns (
  id          BIGSERIAL PRIMARY KEY,
  board_id    BIGINT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_columns_board_position UNIQUE (board_id, position)
);


ALTER TABLE columns
ADD CONSTRAINT uq_columns_board_id_id UNIQUE (board_id, id);

CREATE INDEX idx_columns_board_id ON columns(board_id);

-- TASKS
CREATE TABLE tasks (
  id          BIGSERIAL PRIMARY KEY,
  board_id    BIGINT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id   BIGINT,
  title       TEXT NOT NULL,
  description TEXT,
  position    INT NOT NULL DEFAULT 0,
  created_by  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- column_id is optional; if present it must be a column of the same board
  CONSTRAINT fk_task_column_same_board
    FOREIGN KEY (board_id, column_id)
    REFERENCES columns (board_id, id)
    ON DELETE SET NULL
);

CREATE INDEX idx_tasks_board_id ON tasks(board_id);
CREATE INDEX idx_tasks_column_id ON tasks(column_id);
CREATE INDEX idx_tasks_board_column_position ON tasks(board_id, column_id, position);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;

CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
