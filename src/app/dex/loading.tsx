import { GridSkeleton } from "@/components/loaders";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2">Poke Idle World</div>
        <h1 className="pixel text-xl text-cyan">Pokedex</h1>
      </div>
      <div className="skeleton h-10 w-full max-w-md rounded" />
      <GridSkeleton />
    </div>
  );
}
