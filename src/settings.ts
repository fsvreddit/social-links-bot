import { SettingsFormField } from "@devvit/public-api";

export enum AppSetting {
    PostId = "postId",
    AccountNames = "accountName",
    ResponseMethod = "responseMethod",
}

export enum ResponseMethod {
    Reply = "reply",
    PrivateMessage = "privateMessage",
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
    {
        name: AppSetting.ResponseMethod,
        type: "select",
        label: "Response method",
        options: [
            { label: "Reply to comment", value: ResponseMethod.Reply },
            { label: "Private message", value: ResponseMethod.PrivateMessage },
        ],
        defaultValue: [ResponseMethod.Reply],
        onValidate: ({ value }) => {
            if (!value || value.length === 0) {
                return "You must choose a response method";
            }
        },
    },
];
