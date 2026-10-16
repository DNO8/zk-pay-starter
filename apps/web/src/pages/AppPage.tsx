/**
 * TODO(GAP-6): the real UI in a blank shell (`/app`): deposit, save note, withdraw to fresh address
 *   → docs/lessons/06.md#hints
 */
export function AppPage() {
  return (
    <main className="p-6 max-w-xl">
      <h1 className="text-2xl text-amber mb-2">Private payment</h1>
      <p className="text-graphite mb-6">
        This page is intentionally empty. Build the deposit → save note → withdraw-to-fresh-address
        flow here. The working pipeline lives at <code>/debug</code>.
      </p>
      <div className="border border-dashed border-graphite p-8 text-center text-graphite">
        TODO(GAP-6): deposit, note download, withdraw. See docs/lessons/06.md#hints
      </div>
    </main>
  );
}
