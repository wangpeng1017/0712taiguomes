import { getTraceData } from "@/lib/queries/trace";
import { TraceView } from "@/components/trace/TraceView";
import { redirect } from "next/navigation";

export default async function TracePage({ params }: { params?: { view?: string } }) {
  if (!params?.view) redirect("/trace/forward");
  const section = params?.view === "reverse" || params?.view === "molds" ? params.view : "forward";
  const data = await getTraceData();

  return <TraceView section={section} {...data} />;
}
