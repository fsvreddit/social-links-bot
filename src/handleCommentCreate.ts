import { TriggerContext, User, UserSocialLink } from "@devvit/public-api";
import { CommentCreate } from "@devvit/protos";
import { isLinkId } from "@devvit/shared-types/tid.js";
import Ajv, { JSONSchemaType } from "ajv";
import { AppSetting, ResponseMethod } from "./settings.js";
import { addCleanup } from "./cleanup.js";
import { addMinutes } from "date-fns";

interface UserSocialLinks {
    username?: string;
    error?: string;
    errorDetail?: string;
    socialLinks?: UserSocialLink[];
}

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

export async function handleCommentCreate (event: CommentCreate, context: TriggerContext) {
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

    const redisKey = `alreadyChecked~${event.comment.id}`;
    const alreadyChecked = await context.redis.get(redisKey);
    if (alreadyChecked) {
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

    const [responseMethod] = settings[AppSetting.ResponseMethod] as [ResponseMethod] | undefined ?? [ResponseMethod.Reply];

    if (responseMethod === ResponseMethod.Reply) {
        await context.reddit.submitComment({
            id: event.comment.id,
            text: JSON.stringify(userSocialLinks),
        });

        console.log("Comment left.");

        await addCleanup(event.comment.id, context);
    } else {
        await context.reddit.sendPrivateMessage({
            subject: "social-links-bot response",
            to: event.author.name,
            text: JSON.stringify(userSocialLinks),
        });
    }

    await context.redis.set(redisKey, new Date().getTime().toString(), { expiration: addMinutes(new Date(), 20) });
}
