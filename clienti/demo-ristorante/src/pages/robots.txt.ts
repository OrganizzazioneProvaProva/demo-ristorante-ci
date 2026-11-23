import { robotsResponse } from "@siti/core/content/robots.ts";
import type { APIRoute } from "astro";
import { config } from "../content/home.ts";

export const GET: APIRoute = ({ site }) => robotsResponse(config, site);
