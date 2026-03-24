export default function EventsLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-indigo-500" />
      <p className="text-sm text-gray-400">Loading events...</p>
    </main>
  );
}
