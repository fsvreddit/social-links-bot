import { TriggerContext } from "@devvit/public-api";
import { AppInstall, AppUpgrade } from "@devvit/protos";

export async function handleInstallOrUpgrade (_: AppInstall | AppUpgrade, { scheduler }: TriggerContext) {
    const jobs = await scheduler.listJobs();
    await Promise.all(jobs.map(job => scheduler.cancelJob(job.id)));

    await scheduler.runJob({
        name: "cleanupJob",
        cron: "0 * * * *",
    });
}
