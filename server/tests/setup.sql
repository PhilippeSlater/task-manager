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

create table if not exists board_members (
  board_id int not null references boards(id) on delete cascade,
  user_id  int not null references users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists idx_board_members_user on board_members(user_id);
create index if not exists idx_board_members_board on board_members(board_id);

CREATE TABLE IF NOT EXISTS board_invitations (
  id SERIAL PRIMARY KEY,
  board_id INT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  invited_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | canceled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- 1 invitation pending max par board/user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_board_invite_pending
ON board_invitations(board_id, invited_user_id)
WHERE status='pending';


COMMIT;
