import { ProblemDetailClient } from "@/components/ProblemDetailClient";

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProblemDetailClient problemId={id} />;
}
