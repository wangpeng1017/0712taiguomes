import { getReportData } from "@/lib/queries/report";
import { ReportView } from "@/components/report/ReportView";

export default async function ReportPage() {
  const data = await getReportData();

  return <ReportView {...data} />;
}
