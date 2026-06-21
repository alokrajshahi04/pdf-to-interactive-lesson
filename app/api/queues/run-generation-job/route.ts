import { handleCallback, send } from "@vercel/queue";
import { del } from "@vercel/blob";
import { generateCourseFromPdf } from "@/lib/generate-course-from-pdf";
import { saveCourse } from "@/lib/save-course";
import { incrementRateLimit } from "@/lib/utils/rate-limiter";
import { getJob, updateJob } from "@/lib/utils/job-store";
import { tryClaimSlot, releaseSlot } from "@/lib/utils/generation-concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REQUEUE_DELAY_SECONDS = 10;

interface QueueMessage {
  jobId: string;
}

async function deleteUploadedPdf(url: string) {
  try {
    await del(url);
  } catch (error) {
    console.warn("Failed to delete uploaded PDF blob:", error);
  }
}

export const POST = handleCallback<QueueMessage>(async (message) => {
  const { jobId } = message;
  if (!jobId) {
    console.warn("run-generation-job: missing jobId in message");
    return;
  }

  const job = await getJob(jobId);
  if (!job) {
    // Job state expired or never created — acknowledge to stop retries.
    console.warn(`run-generation-job: job ${jobId} not found, acknowledging`);
    return;
  }

  if (job.status === "complete" || job.status === "error") {
    // Already processed — likely a duplicate delivery. Acknowledge.
    return;
  }

  // Cap parallel generations. If we can't claim a slot, re-enqueue this
  // jobId with a short delay and acknowledge the current message. Using
  // `send({ delaySeconds })` instead of throwing because Vercel Queues
  // v2beta's retry-callback path doesn't reliably honor `afterSeconds`
  // in production — delayed delivery via SendMessage is a first-class
  // documented feature and is reliable. Job state stays at "queued"
  // throughout, so the UI keeps showing "Waiting in line...".
  const claimed = await tryClaimSlot();
  if (!claimed) {
    console.log(
      `Job ${jobId} at capacity, re-enqueueing with ${REQUEUE_DELAY_SECONDS}s delay`
    );
    await send(
      "generate-course",
      { jobId },
      { delaySeconds: REQUEUE_DELAY_SECONDS }
    );
    return;
  }

  try {
    await updateJob(jobId, {
      status: "processing",
      startedAt: Date.now(),
    });

    const result = await generateCourseFromPdf({
      url: job.url,
      apiKey: job.apiKey || "",
      onProgress: (type, message) => {
        updateJob(jobId, { progressType: type, progress: message }).catch(
          (err) => console.error("Failed to write progress:", err)
        );
      },
    });

    if (!job.apiKey) {
      await incrementRateLimit(job.clientId);
    }

    // Save the full course to Postgres here (not via the client) so we
    // never have to push a multi-megabyte payload through Upstash. The
    // job state only carries the resulting slug for the client to
    // navigate to.
    const saved = await saveCourse({
      course: result.course,
      userId: job.userId ?? null,
    });

    await updateJob(jobId, {
      status: "complete",
      slug: saved.slug,
      completedAt: Date.now(),
    });
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await updateJob(jobId, {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      completedAt: Date.now(),
    });
    // Don't re-throw — error is captured in job state and the client will
    // see it via status polling. Re-throwing would cause Vercel Queues to
    // retry, but generation errors here are not transient.
  } finally {
    await deleteUploadedPdf(job.url);
    await releaseSlot();
  }
});
