-- Two databases on one local Postgres: the merchant's own data and Ledger Guard's.
-- They are kept separate on purpose; in production they would live on different hosts.
CREATE DATABASE merchant;
CREATE DATABASE ledger_guard;
