import { version } from "../../package.json";

export type HealthStatus = {
  status: "ok";
  version: string;
  commit: string;
};

export function getCommitSha(): string {
  return (
    process.env.GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "dev"
  );
}

export function getHealthPayload(): HealthStatus {
  return {
    status: "ok",
    version,
    commit: getCommitSha(),
  };
}
