const AWS = require("aws-sdk");
const s3Config = {
  region: process.env.REGION,
};

if (process.env.TEST) {
  s3Config.endpoint = "localhost:4566";
  s3Config.sslEnabled = false;
  s3Config.s3ForcePathStyle = true;
}

const S3 = new AWS.S3(s3Config);

const deleteObject = async (bucket, key) => {
  console.log(bucket, key);
  const data = await S3.deleteObject({
    Bucket: bucket,
    Key: key,
  }).promise();
  return data;
};
exports.deleteObject = deleteObject;
const getObject = async (bucket, key) => {
  return await S3.getObject({
    Bucket: bucket,
    Key: key,
  }).promise();
};
exports.getObject = getObject;

const getPresignedPutUrl = (key) => {
  return S3.getSignedUrl("putObject", {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Expires: 60 * 30,
  });
};
const getPresignedGetUrl = (bucket, key) => {
  return S3.getSignedUrl("getObject", {
    Bucket: bucket,
    Key: key,
    Expires: 60 * 30,
  });
};
exports.uploadObject = (bucket, key, buffer, contentType) => {
  return S3.putObject({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }).promise();
};

const headObject = (key) => {
  /* Response
    {
      AcceptRanges: 'bytes',
      LastModified: 2021-07-27T16:47:29.000Z,
      ContentLength: 1185151,
      ETag: '"fdca08f0e6caebeb840e0f5bd9964577"',
      CacheControl: 'no-cache',
      ContentType: 'video/mp4',
      ServerSideEncryption: 'AES256',
      Metadata: {}
    }
  */
  return S3.headObject({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  }).promise();
};

exports.S3 = S3;
exports.getPresignedPutUrl = getPresignedPutUrl;
exports.getPresignedGetUrl = getPresignedGetUrl;
exports.headObject = headObject;
