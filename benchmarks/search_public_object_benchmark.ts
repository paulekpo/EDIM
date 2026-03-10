
// Helper function to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class MockFile {
  constructor(public name: string) {}

  async exists(): Promise<[boolean]> {
    await delay(50); // Simulate network latency
    return [false]; // Simulate file not found to force checking all paths
  }
}

class MockBucket {
  constructor(public name: string) {}

  file(name: string): MockFile {
    return new MockFile(name);
  }
}

class MockStorage {
  bucket(name: string): MockBucket {
    return new MockBucket(name);
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

const mockStorageClient = new MockStorage();

// Simulate 5 search paths
const searchPaths = [
  "gs://bucket1/path1",
  "gs://bucket2/path2",
  "gs://bucket3/path3",
  "gs://bucket4/path4",
  "gs://bucket5/path5",
];

async function searchPublicObjectSequential(filePath: string): Promise<MockFile | null> {
  for (const searchPath of searchPaths) {
    const fullPath = `${searchPath}/${filePath}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = mockStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (exists) {
      return file;
    }
  }
  return null;
}

async function searchPublicObjectParallel(filePath: string): Promise<MockFile | null> {
  const promises = searchPaths.map(async (searchPath) => {
    const fullPath = `${searchPath}/${filePath}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = mockStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (exists) {
        return file;
    }
    return null;
  });

  const results = await Promise.all(promises);
  return results.find(file => file !== null) || null;
}

async function runBenchmark() {
  console.log("Running benchmark with 5 search paths and 50ms latency per check...");

  const startSeq = performance.now();
  await searchPublicObjectSequential("test.txt");
  const endSeq = performance.now();
  console.log(`Sequential execution time: ${(endSeq - startSeq).toFixed(2)}ms`);

  const startPar = performance.now();
  await searchPublicObjectParallel("test.txt");
  const endPar = performance.now();
  console.log(`Parallel execution time: ${(endPar - startPar).toFixed(2)}ms`);
}

runBenchmark();
