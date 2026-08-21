import { Loading, Panel } from "@/components/ui";

export default function FichaLoading() {
  return (
    <Panel className="mt-4">
      <Loading label="Abrindo a ficha" />
    </Panel>
  );
}
