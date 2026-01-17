export type NextAction =
    | NextActionRedirect
    | NextActionSpei
    | NextActionThreeDs;

export interface NextActionRedirect {
    type: 'redirect';
    url: string;
}

export interface NextActionSpei {
    type: 'spei';
    instructions: string;
    reference?: string;
    bank?: string;
}

export interface NextActionThreeDs {
    type: '3ds';
    clientSecret: string;
    returnUrl?: string;
}