const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const packages = (process.env.GHCR_DEV_PACKAGES || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const keepCount = Number.parseInt(process.env.GHCR_DEV_SHA_KEEP || "3", 10);

if (!token) {
  throw new Error("GITHUB_TOKEN or GH_TOKEN is required.");
}

if (!owner) {
  throw new Error("GITHUB_REPOSITORY_OWNER is required.");
}

if (packages.length === 0) {
  throw new Error("GHCR_DEV_PACKAGES must list at least one package.");
}

if (!Number.isInteger(keepCount) || keepCount < 1) {
  throw new Error("GHCR_DEV_SHA_KEEP must be a positive integer.");
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "User-Agent": "noti-console-ghcr-retention",
  "X-GitHub-Api-Version": "2022-11-28",
};

const shaTagPattern = /^sha-[0-9a-f]{7,40}$/i;

function versionTags(version) {
  return version.metadata?.container?.tags || [];
}

function isDevVersion(version) {
  return versionTags(version).includes("dev");
}

function hasShaTag(version) {
  return versionTags(version).some((tag) => shaTagPattern.test(tag));
}

function sortNewestFirst(a, b) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${body}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function packageBasePath(packageName) {
  const encodedOwner = encodeURIComponent(owner);
  const encodedPackage = encodeURIComponent(packageName);
  const userPath = `/users/${encodedOwner}/packages/container/${encodedPackage}`;

  try {
    await api(userPath);
    return userPath;
  } catch (error) {
    if (!String(error.message).includes("404")) {
      throw error;
    }
  }

  const orgPath = `/orgs/${encodedOwner}/packages/container/${encodedPackage}`;
  await api(orgPath);
  return orgPath;
}

async function listVersions(basePath) {
  const versions = [];

  for (let page = 1; ; page += 1) {
    const pageVersions = await api(`${basePath}/versions?per_page=100&page=${page}`);
    versions.push(...pageVersions);

    if (pageVersions.length < 100) {
      break;
    }
  }

  return versions;
}

async function prunePackage(packageName) {
  const basePath = await packageBasePath(packageName);
  const versions = await listVersions(basePath);
  const shaVersions = versions.filter(hasShaTag).sort(sortNewestFirst);
  const keepIds = new Set(shaVersions.slice(0, keepCount).map((version) => version.id));
  const deleteVersions = shaVersions.filter(
    (version) => !keepIds.has(version.id) && !isDevVersion(version),
  );

  console.log(
    `${packageName}: ${versions.length} total versions, ${shaVersions.length} sha-tagged, keeping ${Math.min(
      keepCount,
      shaVersions.length,
    )}.`,
  );

  for (const version of shaVersions.filter((version) => keepIds.has(version.id))) {
    console.log(`${packageName}: keep ${version.id} tags=${versionTags(version).join(",")}`);
  }

  for (const version of deleteVersions) {
    console.log(`${packageName}: delete ${version.id} tags=${versionTags(version).join(",")}`);
    await api(`${basePath}/versions/${version.id}`, { method: "DELETE" });
  }
}

for (const packageName of packages) {
  await prunePackage(packageName);
}
