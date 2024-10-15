import { Devvit } from "@devvit/public-api";
import { runCleanup } from "./cleanup.js";
import { handleInstallOrUpgrade } from "./handleInstallOrUpgrade.js";
import { handleCommentCreate } from "./handleCommentCreate.js";
import { appSettings } from "./settings.js";

Devvit.addSettings(appSettings);

Devvit.addSchedulerJob({
    name: "cleanupJob",
    onRun: runCleanup,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: handleInstallOrUpgrade,
});

Devvit.addTrigger({
    event: "CommentCreate",
    onEvent: handleCommentCreate,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
