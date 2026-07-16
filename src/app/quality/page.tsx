import { QualityExecutionView } from "@/components/operations/QualityExecutionView";
import { getQualityExecutionData } from "@/lib/queries/operations";

export default async function QualityPage() {
  const data = await getQualityExecutionData();
  return <QualityExecutionView data={JSON.parse(JSON.stringify(data))} />;
}
