import { ProcessManagementView, type ProcessSection } from "@/components/process/ProcessManagementView";
import { getProcessManagementData } from "@/lib/queries/process";

const VALID_SECTIONS: ProcessSection[] = ["operations", "routes", "versions"];

export default async function ProcessViewPage({
  params,
  searchParams,
}: {
  params: { view: string };
  searchParams?: { routeId?: string };
}) {
  const section = VALID_SECTIONS.includes(params.view as ProcessSection)
    ? (params.view as ProcessSection)
    : "operations";
  const data = await getProcessManagementData();

  return <ProcessManagementView section={section} initialRouteId={searchParams?.routeId} {...data} />;
}
