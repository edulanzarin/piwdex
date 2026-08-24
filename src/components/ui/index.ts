/**
 * Barril das primitivas.
 *
 * Toda tela importa daqui — `@/components/ui`. E o que impede a proxima pagina
 * de inventar mais um botao "quase igual": se a primitiva nao serve, o certo e
 * abrir uma VARIANTE aqui dentro, nao um componente novo na pasta da tela.
 */
export { Button, ButtonLink, IconButton, type ButtonProps, type ButtonLinkProps } from "./button";
export { Badge, type BadgeProps } from "./badge";
export { Checkbox } from "./checkbox";
export { Chip } from "./chip";
export { Combobox, type ComboOption } from "./combobox";
export { DataList, DataRow } from "./data-row";
export { ArtCard, ExploreLink, type ArtCardProps } from "./art-card";
export { Empty } from "./empty";
export { Frame, RuleTitle } from "./frame";
export { Field, FieldRow, type FieldProps } from "./field";
export { HowTo, type HowToProps, type HowToStep } from "./how-to";
export { Input, NumberField, NumberRange, SearchInput } from "./input";
export { Loading } from "./loading";
export { Metric, MetricCell, MetricGrid, type MetricProps } from "./metric";
export { Modal } from "./modal";
export { Note } from "./note";
export { MultiSelect, type MultiOption } from "./multi-select";
export { Pagination } from "./pagination";
export { Panel, FieldLabel } from "./panel";
export { Pokeball } from "./pokeball";
export { Popover, PopoverScroll } from "./popover";
export { Range } from "./range";
export {
  DisplayTitle,
  Eyebrow,
  FeatureSection,
  FullBleed,
  type FeatureSectionProps,
} from "./feature";
export { Parallax, Reveal, type RevealProps } from "./reveal";
export { Divider, PageHeader, SectionTitle } from "./section";
export { Segmented, type SegmentedOption } from "./segmented";
export { Select, type SelectOption } from "./select";
export {
  Skeleton,
  SkeletonCard,
  SkeletonForm,
  SkeletonGrid,
  SkeletonItemCard,
  SkeletonItemGrid,
} from "./skeleton";
export { Sprite } from "./sprite";
export { Segments, StatBar, StatTile } from "./stat-bar";
export { Switch } from "./switch";
export { Tabs, type TabItem } from "./tabs";
export { Tooltip } from "./tooltip";
export * from "./icons";
