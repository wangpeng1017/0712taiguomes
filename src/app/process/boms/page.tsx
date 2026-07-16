import { BomManagementView } from "@/components/process/BomManagementView";
import { getBomManagementData } from "@/lib/queries/boms";

export default async function BomManagementPage({
  searchParams,
}: {
  searchParams?: { bomId?: string };
}) {
  const data = await getBomManagementData();

  return <BomManagementView initialBomId={searchParams?.bomId} {...data} />;
}
