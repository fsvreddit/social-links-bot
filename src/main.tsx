// Visit developers.reddit.com/docs to learn Devvit!

import { Devvit, TriggerContext, User, UserSocialLink } from "@devvit/public-api";
import { isLinkId } from "@devvit/shared-types/tid.js";
import { addDays, addHours } from "date-fns";

enum AppSetting {
    PostId = "postId",
    AccountNames = "accountName",
}

Devvit.addSettings([
    {
        name: AppSetting.PostId,
        type: "string",
        label: "Post ID to watch",
        helpText: "Post ID e.g. 1g3l6a6",
    },
    {
        name: AppSetting.AccountNames,
        type: "string",
        label: "Account names to watch for comments from",
        helpText: "Comma separated, not case sensitive",
        defaultValue: "DrRonikBot",
    },
]);

const CLEANUP_KEY = "CommentCleanup";

interface UserSocialLinks {
    username: string;
    socialLinks: UserSocialLink[];
}

async function getSocialLinksForUser (username: string, context: TriggerContext): Promise<UserSocialLinks | undefined> {
    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(username);
    } catch {
        //
    }
    if (!user) {
        return;
    }

    const socialLinks = await user.getSocialLinks();
    console.log(`Grabbed ${socialLinks.length} social link(s) for ${username}`);
    return {
        username,
        socialLinks,
    };
}

Devvit.addSchedulerJob({
    name: "cleanupJob",
    onRun: async (event, context) => {
        const commentsToDelete = (await context.redis.zRange(CLEANUP_KEY, 0, new Date().getTime(), { by: "score" })).map(x => x.member);
        if (commentsToDelete.length === 0) {
            return;
        }

        for (const commentId of commentsToDelete) {
            const comment = await context.reddit.getCommentById(commentId);
            await comment.delete();
        }

        await context.redis.zRem(CLEANUP_KEY, commentsToDelete);
    },
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: async (_, { scheduler }) => {
        const jobs = await scheduler.listJobs();
        await Promise.all(jobs.map(job => scheduler.cancelJob(job.id)));

        await scheduler.runJob({
            name: "cleanupJob",
            cron: "0 * * * *",
        });
    },
});

Devvit.addTrigger({
    event: "CommentCreate",
    onEvent: async (event, context) => {
        if (!event.comment || !event.author) {
            return;
        }

        if (!isLinkId(event.comment.parentId)) {
            console.log("Ignoring non-TLC");
            return;
        }

        if (!event.comment.body.startsWith("[")) {
            return;
        }

        const settings = await context.settings.getAll();
        const postId = settings[AppSetting.PostId] as string | undefined;
        const accountNamesVal = settings[AppSetting.AccountNames] as string | undefined;
        if (!postId || !accountNamesVal) {
            return;
        }

        const accountNames = accountNamesVal.split(",").map(accountName => accountName.trim().toLowerCase());
        console.log(accountNames);

        if (!accountNames.includes(event.author.name.toLowerCase())) {
            console.log(`Wrong user: Got ${event.author.name}`);
            return;
        }

        if (!event.comment.parentId.endsWith(postId)) {
            console.log("Wrong post.");
            return;
        }

        const userList = JSON.parse(event.comment.body) as string[];
        console.log(userList);
        const userSocialLinks: UserSocialLinks[] = [];
        for (const user of userList) {
            const userSocials = await getSocialLinksForUser(user, context);
            if (userSocials) {
                userSocialLinks.push(userSocials);
            }
        }

        if (userSocialLinks.length === 0) {
            return;
        }

        await context.reddit.submitComment({
            id: event.comment.id,
            text: JSON.stringify(userSocialLinks),
        });

        await addCleanup(event.comment.id, context);

        await context.scheduler.runJob({
            name: "deleteCommentAfterOneDay",
            runAt: addDays(new Date(), 1),
            data: { commentId: event.comment.id },
        });
    },
});

export async function addCleanup (commentId: string, context: TriggerContext) {
    await context.redis.zAdd(CLEANUP_KEY, { member: commentId, score: addHours(new Date(), 3).getTime() });
}

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
