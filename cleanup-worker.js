export default {
  async scheduled(controller, env, ctx) {
    if (!env.DB) throw new Error("D1 binding DB is missing");
    // Revisions are removed explicitly before parent rows so cleanup is safe
    // even if SQLite foreign-key enforcement is not enabled for this binding.
    await env.DB.prepare(`DELETE FROM quote_revisions WHERE quote_id IN
      (SELECT id FROM quotes WHERE expires_at <= datetime('now'))`).run();
    const result = await env.DB.prepare(`DELETE FROM quotes WHERE expires_at <= datetime('now')`).run();
    console.log(`90-day quotation cleanup completed; deleted ${result.meta?.changes ?? 0} quotes`);
  }
};
