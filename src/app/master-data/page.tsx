import { getMasterData } from "@/lib/queries/master-data";
import { MasterDataView } from "@/components/master-data/MasterDataView";

export default async function MasterDataPage() {
  const { skus, materials, equipments, defectReasons } = await getMasterData();

  return <MasterDataView skus={skus} materials={materials} equipments={equipments} defectReasons={defectReasons} />;
}
