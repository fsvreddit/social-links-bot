# social-links-bot

A Devvit app that responds to user lists and returns their social links (if any). It is intended to be a bridge to allow data API-based Reddit bots to be able to access social links despite them not being available via the API.

**If you do not run a Data API bot that isn't specifically written to take advantage of this app, this is not for you. The app should not be installed on public subreddits.**.

Object type returned is an array of the following type:

```ts
interface UserSocialLinks {
    username?: string;
    error?: string;
    errorDetail?: string;
    socialLinks?: UserSocialLink[];
}
```

Input is in the form of a JSON array of string e.g. `["user1", "user2"]`. Usernames are not case sensitive.

The app will only respond to top level comments from named users on a specified post (configured in the app settings).

If all is well, the error/errorDetail attributes are omitted.

If the input is badly formed (e.g. not JSON, not a string array, containing entries that are impossible usernames (too short/long), or contains duplicate items), `error` and `errorDetail` attributes are returned in a single array item.

Otherwise, an array of usernames with their social links (if any) is returned.

Shadowbanned, suspended and deleted users cannot be retrieved, in which case their username and an error of "SHADOWBANNED" is returned.

The app deletes its own comments within 2-4 hours of creation. My suggested implementation is to install on a private subreddit and watch the comment stream on the subreddit for comments from the app, or proactively check on replies to bot comments (it should take a few seconds at most to act).
