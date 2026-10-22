import { SetMetadata } from "@nestjs/common";
import { IS_PUBLIC_PROVIDER, SKIP_ACCOUNT_ACTIVATED, SKIP_REFRESH_ROUTE } from "@types";

export const Public = () => SetMetadata<string, boolean>(IS_PUBLIC_PROVIDER, true);
export const SkipRefreshRoute = () => SetMetadata<string, boolean>(SKIP_REFRESH_ROUTE, true);
export const SkipAccountActivated = () => SetMetadata(SKIP_ACCOUNT_ACTIVATED, true);
