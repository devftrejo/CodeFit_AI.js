// Cloud Functions for CodeFit_AI.js.
//
// Phase 1 placeholder — the OpenAI streaming proxy is ported in Phase 2.
// Until then, server/server.js still serves chat in local dev.

import { setGlobalOptions } from "firebase-functions";

setGlobalOptions({ maxInstances: 10 });
