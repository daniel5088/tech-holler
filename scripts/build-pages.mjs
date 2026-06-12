import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const holdingRoot = path.join(root, ".pages-runtime-routes");
const runtimeRoutes = [
  ["src/app/api/admin", "api-admin"],
  ["src/app/api/cron", "api-cron"],
];

async function runBuild() {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "build"],
      {
        cwd: root,
        env: {
          ...process.env,
          GITHUB_PAGES: "true",
          NEXT_PUBLIC_BASE_PATH:
            process.env.NEXT_PUBLIC_BASE_PATH ?? "/tech-holler-pages",
          NEXT_PUBLIC_SITE_URL:
            process.env.NEXT_PUBLIC_SITE_URL ??
            "https://daniel5088.github.io/tech-holler-pages",
        },
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Pages build exited with ${code}`)),
    );
  });
}

await rm(holdingRoot, { recursive: true, force: true });
await mkdir(holdingRoot, { recursive: true });

try {
  for (const [source, destination] of runtimeRoutes) {
    await rename(path.join(root, source), path.join(holdingRoot, destination));
  }
  await rm(path.join(root, ".next"), { recursive: true, force: true });
  await runBuild();
  await writeFile(path.join(root, "out", ".nojekyll"), "");
} finally {
  for (const [source, destination] of [...runtimeRoutes].reverse()) {
    await rename(path.join(holdingRoot, destination), path.join(root, source));
  }
  await rm(holdingRoot, { recursive: true, force: true });
}
