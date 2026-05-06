# Database Protection Rule

## MANDATORY — No Exceptions

**Any command that deletes, drops, truncates, or clears rows from a database MUST receive explicit user approval before execution.** This applies to ALL databases in the project (PostgreSQL, Redis, SQLite, etc.).

### Forbidden Without Confirmation
- `DELETE FROM <table>` (without a narrow `WHERE` targeting a single, specific row)
- `DROP TABLE`
- `TRUNCATE TABLE`
- `UPDATE ... SET status=... WHERE 1=1` or any bulk status reset
- Any raw SQL that modifies more than one row at a time
- `FLUSHDB` or `FLUSHALL` (Redis)
- Any Drizzle ORM or Prisma call that performs bulk deletes

### Permitted Without Confirmation
- `DELETE FROM <table> WHERE id = <specific_id>` (single row, explicitly identified)
- `UPDATE <table> SET <col> = <val> WHERE id = <specific_id>` (single row update)
- `INSERT` statements (additive, non-destructive)
- `SELECT` statements (read-only)
- Redis `DEL <specific_key>` (single key, explicitly identified)

### Procedure
1. **State the exact SQL/command** you intend to run.
2. **State how many rows will be affected** and what data will be lost.
3. **Wait for user approval** before executing.
