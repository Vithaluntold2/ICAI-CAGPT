/**
 * One-off: nuke every AI response cache entry.
 *
 * Run: npx tsx scripts/purge-ai-cache.ts
 *
 * Safe to re-run; removes Redis keys under the `ai-v2:` prefix and
 * all matching rows in the Postgres fallback table.
 */
import 'dotenv/config';
import { AIResponseCache } from '../server/services/hybridCache';

async function main() {
  const removed = await AIResponseCache.purgeAll();
  console.log(`Done. Removed ~${removed} cache entries.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
});
