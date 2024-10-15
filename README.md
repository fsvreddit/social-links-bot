# social-links-bot

A Devvit app that responds to user lists and returns their social links (if any).

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
