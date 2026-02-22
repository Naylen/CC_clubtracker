import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

async function backfill() {
  // Find all ACTIVE memberships whose primary member has no membership number
  const rows = await sql`
    SELECT DISTINCT m.id as member_id, m.first_name, m.last_name, m.household_id, ms.id as membership_id
    FROM member m
    JOIN membership ms ON ms.household_id = m.household_id
    WHERE ms.status = 'ACTIVE'
      AND m.membership_number IS NULL
      AND m.role = 'PRIMARY'
  `;

  console.log("Found", rows.length, "ACTIVE members without membership numbers");

  for (const row of rows) {
    // Assign next number
    const result = await sql`
      UPDATE member
      SET membership_number = (SELECT COALESCE(MAX(membership_number), 0) + 1 FROM member)
      WHERE id = ${row.member_id}
      RETURNING membership_number
    `;
    const num = result[0].membership_number;
    const formatted = String(num).padStart(3, "0");

    // Update household name
    await sql`
      UPDATE household
      SET name = ${row.last_name + " (" + formatted + ") Household"}
      WHERE id = ${row.household_id}
    `;

    console.log("  Assigned #" + formatted + " to " + row.first_name + " " + row.last_name);
  }

  console.log("Done! Backfill complete.");
  await sql.end();
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
