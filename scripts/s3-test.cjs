const { S3Client, HeadBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function main() {
  const endpoint = must('S3_ENDPOINT');
  const region = process.env.S3_REGION || 'ru-central1';
  const bucket = must('S3_BUCKET');
  const accessKeyId = must('S3_ACCESS_KEY');
  const secretAccessKey = must('S3_SECRET_KEY');

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  const r = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 3 }));
  console.log('S3 OK');
  console.log('bucket:', bucket);
  console.log('sampleObjects:', (r.Contents || []).map((o) => o.Key).filter(Boolean));
}

main().catch((e) => {
  const status = e && e.$metadata ? e.$metadata.httpStatusCode : '';
  const code = e && (e.Code || e.code) ? e.Code || e.code : '';
  console.error('S3 FAIL', e.name, status, code, String(e.message || '').slice(0, 200));
  process.exit(1);
});

