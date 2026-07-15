import { getMasterData } from "@/lib/queries/master-data";
import { MasterDataView } from "@/components/master-data/MasterDataView";
import { redirect } from "next/navigation";

export default async function MasterDataPage({ params }: { params?: { view?: string } }) {
  if (!params?.view) redirect("/master-data/products");
  const section = params?.view === "materials" || params?.view === "equipment" || params?.view === "dictionaries" ? params.view : "products";
  const { skus, materials, equipments, defectReasons } = await getMasterData();

  return <MasterDataView section={section} skus={skus} materials={materials} equipments={equipments} defectReasons={defectReasons} />;
}
