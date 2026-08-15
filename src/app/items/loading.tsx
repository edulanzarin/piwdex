import { ItemsSkeleton } from "@/components/loaders";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2">Indice reverso</div>
        <h1 className="pixel text-xl text-text">Itens & drops</h1>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="skeleton h-10 w-full max-w-xs rounded" />
        <div className="skeleton h-10 w-full max-w-[12rem] rounded" />
      </div>
      <ItemsSkeleton />
    </div>
  );
}
