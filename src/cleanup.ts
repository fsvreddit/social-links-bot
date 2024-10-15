import { JobContext, TriggerContext } from "@devvit/public-api";
import { addHours } from "date-fns";

export const CLEANUP_KEY = "CommentCleanup";

export async function runCleanup (_: unknown, context: JobContext) {
    const commentsToDelete = (await context.redis.zRange(CLEANUP_KEY, 0, new Date().getTime(), { by: "score" })).map(x => x.member);
    if (commentsToDelete.length === 0) {
        return;
    }

    for (const commentId of commentsToDelete) {
        const comment = await context.reddit.getCommentById(commentId);
        await comment.delete();
    }

    console.log(`Deleted ${commentsToDelete.length} comment(s) via cleanup job`);

    await context.redis.zRem(CLEANUP_KEY, commentsToDelete);
}

export async function addCleanup (commentId: string, context: TriggerContext) {
    await context.redis.zAdd(CLEANUP_KEY, { member: commentId, score: addHours(new Date(), 3).getTime() });
}
