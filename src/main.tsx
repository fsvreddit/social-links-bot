// Visit developers.reddit.com/docs to learn Devvit!

import { Devvit, TriggerContext, User, UserSocialLink } from "@devvit/public-api";
import { isLinkId } from "@devvit/shared-types/tid.js";
import { addDays } from "date-fns";

enum AppSetting {
    PostId = "postId",
    AccountName = "accountName",
}

Devvit.addSettings([
    {
        name: AppSetting.PostId,
        type: "string",
        label: "Post ID to watch",
        helpText: "Post ID e.g. 1g3l6a6",
    },
    {
        name: AppSetting.AccountName,
        type: "string",
        label: "Account name to watch for comments from",
        defaultValue: "DrRonikBot",
    },
]);

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
    return {
        username,
        socialLinks,
    };
}

Devvit.addSchedulerJob({
    name: "deleteCommentAfterOneDay",
    onRun: async (event, context) => {
        const commentId = event.data?.commentId as string;
        if (!commentId) {
            return;
        }

        const comment = await context.reddit.getCommentById(commentId);
        await comment.delete();
    },
});

Devvit.addTrigger({
    event: "CommentCreate",
    onEvent: async (event, context) => {
        if (!event.comment || !isLinkId(event.comment.parentId)) {
            return;
        }

        if (!event.comment.body.startsWith("[")) {
            return;
        }

        const settings = await context.settings.getAll();
        const postId = settings[AppSetting.PostId] as string | undefined;
        const accountName = settings[AppSetting.AccountName] as string | undefined;
        if (!postId || !accountName) {
            return;
        }

        if (event.comment.author !== accountName || event.comment.parentId.endsWith(postId)) {
            return;
        }

        const userList = JSON.parse(event.comment.body) as string[];
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

        await context.scheduler.runJob({
            name: "deleteCommentAfterOneDay",
            runAt: addDays(new Date(), 1),
            data: { commentId: event.comment.id },
        });
    },
});

Devvit.configure({
    redditAPI: true,
});

export default Devvit;
