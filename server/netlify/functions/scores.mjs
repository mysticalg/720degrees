import { getDatabase } from "@netlify/database";
import { handler } from "../../handler.mjs";
export default async function (request) {
  return handler(getDatabase().pool)(request);
}
export const config = {
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["domain", "ip"],
    windowSize: 60,
    windowLimit: 60,
  },
};
