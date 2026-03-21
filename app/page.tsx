import YearSection from "@/components/YearSection";
import HomeSubtitle from "@/components/HomeSubtitle";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <h1 className="mb-2 text-4xl font-bold tracking-tight text-white sm:text-6xl">
        Time Machine
      </h1>
      <HomeSubtitle />
      <YearSection />
    </main>
  );
}
