import { SettingsFormField } from "@devvit/public-api";

export enum AppSetting {
    PostId = "postId",
    AccountNames = "accountName",
}

export const appSettings: SettingsFormField[] = [
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
];
