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
  const publicationTarget = Math.max(1, Math.min(count, 3));
  let publications = 0;

  for (const cluster of candidates.slice(0, 3)) {
    try {
      const result = await produceArticle(cluster, type === "breaking");
      results.push(result);
      if (result.status === "published" || result.status === "updated") {
        publications += 1;
        if (publications >= publicationTarget) break;
      }
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
    attemptedCandidates: results.length,
    publicationTarget,
    results,
    adapterErrors: sweep.errors,
  });
  return { ...sweep, candidates, results };
}
