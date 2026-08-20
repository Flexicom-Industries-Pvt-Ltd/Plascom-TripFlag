import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  try {
    await sql`ALTER TABLE flagging_rules ADD COLUMN IF NOT EXISTS unit TEXT;`;
    console.log("Migration successful.");
  } catch(e) {
    console.error("Migration failed:", e);
  }
}
run();
