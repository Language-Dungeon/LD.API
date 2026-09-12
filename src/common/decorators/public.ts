import { SetMetadata } from "@nestjs/common";
import { IS_PUBLIC_PROVIDER } from "@types";

export const isPublic = () => SetMetadata<string, boolean>(IS_PUBLIC_PROVIDER, true);
