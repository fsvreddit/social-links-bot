// Visit developers.reddit.com/docs to learn Devvit!

import { Devvit, TriggerContext, User, UserSocialLink } from "@devvit/public-api";
import { isLinkId } from "@devvit/shared-types/tid.js";
import Ajv, { JSONSchemaType } from "ajv";
import { addHours } from "date-fns";

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
    username?: string;
    error?: string;
    errorDetail?: string;
    socialLinks?: UserSocialLink[];
}

async function getSocialLinksForUser (username: string, context: TriggerContext): Promise<UserSocialLinks> {
    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(username);
    } catch {
        //
    }
    if (!user) {
        return {
            username,
            error: "SHADOWBANNED",
        };
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
    onRun: async (_, context) => {
        const commentsToDelete = (await context.redis.zRange(CLEANUP_KEY, 0, new Date().getTime(), { by: "score" })).map(x => x.member);
        if (commentsToDelete.length === 0) {
            return;
        }

        for (const commentId of commentsToDelete) {
            const comment = await context.reddit.getCommentById(commentId);
            await comment.delete();
        }

        console.log(`Deleted ${commentsToDelete} comment(s) via cleanup job`);

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

const schema: JSONSchemaType<string[]> = {
    type: "array",
    items: {
        type: "string",
        minLength: 3,
        maxLength: 20,
    },
    minItems: 1,
    uniqueItems: true,
};

Devvit.addTrigger({
    event: "CommentCreate",
    onEvent: async (event, context) => {
        if (!event.comment || !event.author || event.author.name === context.appName) {
            return;
        }

        if (!isLinkId(event.comment.parentId)) {
            console.log("Ignoring non-TLC");
            return;
        }

        const settings = await context.settings.getAll();
        const postId = settings[AppSetting.PostId] as string | undefined;
        const accountNamesVal = settings[AppSetting.AccountNames] as string | undefined;
        if (!postId || !accountNamesVal) {
            return;
        }

        const accountNames = accountNamesVal.split(",").map(accountName => accountName.trim().toLowerCase());

        if (!accountNames.includes(event.author.name.toLowerCase())) {
            console.log(`Wrong user: Got ${event.author.name}`);
            return;
        }

        if (!event.comment.parentId.endsWith(postId)) {
            console.log("Wrong post.");
            return;
        }

        const userSocialLinks: UserSocialLinks[] = [];

        try {
            const userList = JSON.parse(event.comment.body) as string[];

            const ajv = new Ajv.default();
            const validate = ajv.compile(schema);

            if (!validate(userList)) {
                userSocialLinks.push({
                    error: "JSON_INVALID_FORMAT",
                    errorDetail: ajv.errorsText(validate.errors),
                });
            } else {
                for (const user of userList) {
                    userSocialLinks.push(await getSocialLinksForUser(user, context));
                }
            }

            if (userSocialLinks.length === 0) {
                userSocialLinks.push({
                    error: "NO_USERS_PROVIDED",
                });
            }
        } catch (error) {
            userSocialLinks.push({
                error: "INVALID_JSON",
                errorDetail: error instanceof Error ? error.message : undefined,
            });
        }

        await context.reddit.submitComment({
            id: event.comment.id,
            text: JSON.stringify(userSocialLinks),
        });

        console.log("Comment left.");

        await addCleanup(event.comment.id, context);
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
