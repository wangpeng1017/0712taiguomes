import { OperationExecutionView } from "@/components/operations/OperationExecutionView";
import { getOperationExecutionData } from "@/lib/queries/operations";

export default async function OperationsPage() {
  const data = await getOperationExecutionData();
  return <OperationExecutionView data={JSON.parse(JSON.stringify(data))} />;
}
