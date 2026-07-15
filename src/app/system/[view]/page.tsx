import { SystemManagementView } from "@/components/system/SystemManagementView";
export default function SystemViewPage({ params }: { params: { view: string } }) {
  const view = ["personnel", "permissions", "organization"].includes(params.view) ? params.view as "personnel" | "permissions" | "organization" : "personnel";
  return <SystemManagementView view={view} />;
}
