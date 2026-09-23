import { TextDecoder, TextEncoder } from "util";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(__dirname, true, { info: () => null, error: console.error });

// jsdom omits these, but every browser (and the share-link code under test) has them.
Object.assign(globalThis, { TextEncoder, TextDecoder });
