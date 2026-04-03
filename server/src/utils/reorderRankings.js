/**
 * Reassign ranks 1..n for a session after moving one ranking row to newRank (1-based).
 * Uses a two-phase update to avoid unique(session_id, rank) violations.
 */
async function reorderSessionRankings(supabase, sessionId, rankingId, newRankRaw) {
  const { data: all, error } = await supabase
    .from('rankings')
    .select('id,rank,resume_id')
    .eq('session_id', sessionId)
    .order('rank', { ascending: true });

  if (error) throw new Error(error.message);
  if (!all?.length) throw new Error('No rankings for session');

  const n = all.length;
  const newRank = Number(newRankRaw);
  if (!Number.isInteger(newRank) || newRank < 1 || newRank > n) {
    throw new Error(`newRank must be an integer between 1 and ${n}`);
  }

  const idx = all.findIndex((r) => r.id === rankingId);
  if (idx === -1) throw new Error('Ranking not found');

  if (all[idx].rank === newRank) {
    throw new Error('New rank must differ from current rank');
  }

  const moving = all[idx];
  const others = [...all.slice(0, idx), ...all.slice(idx + 1)];
  others.splice(newRank - 1, 0, moving);
  const newOrder = others;

  const TEMP_BASE = 100000;
  for (let i = 0; i < newOrder.length; i++) {
    const { error: e1 } = await supabase.from('rankings').update({ rank: TEMP_BASE + i }).eq('id', newOrder[i].id);
    if (e1) throw new Error(e1.message);
  }
  for (let i = 0; i < newOrder.length; i++) {
    const { error: e2 } = await supabase.from('rankings').update({ rank: i + 1 }).eq('id', newOrder[i].id);
    if (e2) throw new Error(e2.message);
  }
}

module.exports = { reorderSessionRankings };
