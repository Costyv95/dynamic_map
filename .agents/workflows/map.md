---
description: Create/Update the map of the project
---

Execution Steps:

State Discovery: Perform a recursive scan of the project tree. Ignore .git, node_modules, build/, dist/, and any .gitignore patterns.

Map Initialization: Locate `docs/map.md`. If missing, generate it using the "FairEat Map Standard" (Structure: Overview -> Module Topology -> Key Entry Points -> Critical Hotspots). Include a header timestamp: `> Auto-generated YYYY-MM-DD HH:MM. Regenerate with /map.`

Semantic Analysis: For every directory, determine its intent.

Bad Documentation: /services/api: Contains API files.

Good Documentation: /services/api: Handles order lifecycle, menu CRUD, and fee calculation. Uses Fastify with Drizzle ORM for PostgreSQL.

Delta Sync: Compare the scan against the existing map.md.

Mark new directories as [NEW].

Flag missing directories for removal.

Update "Critical Hotspots" if a folder's file count or complexity has grown significantly since the last run.

The Health Audit: Identify "Gravity Wells" (folders with too many responsibilities) or "Shadow Logic" (duplicate utilities across different modules).