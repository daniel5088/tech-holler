import { collectTrendSignals } from "@/lib/pipeline/adapters";
import { produceArticle } from "@/lib/pipeline/publisher";
import { persistTrendSweep, recordJob } from "@/lib/pipeline/repository";
import { clusterTrends } from "@/lib/pipeline/trend-scoring";

export async function runTrendSweep() {
  const { items, errors } = await collectTrendSignals();
  const clusters = clusterTrends(items);
  await persistTrendSweep(items, clusters, errors);
  return { items, clusters, errors };
}

export async function runPublishingJob({
  type,
  count,
  slot,
}: {
  type: "daily" | "breaking";
  count: number;
  slot?: string;
}) {
  const sweep = await runTrendSweep();
  const candidates = sweep.clusters.filter((cluster) =>
    type === "breaking" ? cluster.qualifiedForBreaking : cluster.score >= 55,
  );
  const results = [];

  for (const cluster of candidates.slice(0, Math.max(1, Math.min(count, 3)))) {
    try {
      results.push(await produceArticle(cluster, type === "breaking"));
    } catch (error) {
      results.push({
        status: "failed" as const,
        reason: error instanceof Error ? error.message : "Unknown publishing failure",
      });
    }
  }

  const status = results.some((result) => result.status === "published" || result.status === "updated")
    ? "completed"
    : results.some((result) => result.status === "failed")
      ? "failed"
      : "blocked";
  await recordJob(type, status, {
    slot,
    signalCount: sweep.items.length,
    candidateCount: candidates.length,
    results,
    adapterErrors: sweep.errors,
  });
  return { ...sweep, candidates, results };
}
