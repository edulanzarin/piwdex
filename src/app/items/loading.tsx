import { LoadingBall } from "@/components/loaders";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2">Indice reverso</div>
        <h1 className="pixel text-xl text-text">Itens & drops</h1>
      </div>
      <LoadingBall label="Carregando itens" />
    </div>
  );
}
