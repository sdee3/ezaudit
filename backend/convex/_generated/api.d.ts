/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditPipeline from "../auditPipeline.js";
import type * as audits from "../audits.js";
import type * as feedback from "../feedback.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_boundary from "../lib/boundary.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_lighthouse from "../lib/lighthouse.js";
import type * as lighthouseWorker from "../lighthouseWorker.js";
import type * as schema_auditJobs from "../schema/auditJobs.js";
import type * as schema_audits from "../schema/audits.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auditPipeline: typeof auditPipeline;
  audits: typeof audits;
  feedback: typeof feedback;
  "lib/auth": typeof lib_auth;
  "lib/boundary": typeof lib_boundary;
  "lib/email": typeof lib_email;
  "lib/lighthouse": typeof lib_lighthouse;
  lighthouseWorker: typeof lighthouseWorker;
  "schema/auditJobs": typeof schema_auditJobs;
  "schema/audits": typeof schema_audits;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
