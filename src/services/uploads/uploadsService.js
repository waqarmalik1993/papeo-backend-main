const service = require("feathers-mongoose");
const Model = require("../../models/uploads.model.js");
const Party = require("../parties/partiesService.js");
const User = require("../users/usersService.js");
const Post = require("../posts/postsService.js");
const Competition = require("../competitions/competitionsService");
const Report = require("../reports/reportsService.js");
const Newsletter = require("../newsletter/newsletterService");
const mongoose = require("mongoose");
const sharp = process.env.REQUIRE_SHARP ? require("sharp") : null;
const s3 = require("./s3.js");
const ffmpeg = process.env.REQUIRE_SHARP ? require("fluent-ffmpeg") : null;
const fs = require("fs");
const { Readable } = require("stream");
const {
  updateFirebaseImageMessage,
} = require("../users/modules/firebase/users.js");
const { papeoError, PAPEO_ERRORS } = require("../../modules/errors/errors.js");

const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: ["patch"],
  whitelist: [
    "$populate",
    "$regex",
    "$options",
    "$geoWithin",
    "$centerSphere",
    "$geometry",
    "$near",
    "$maxDistance",
    "$minDistance",
    "$nearSphere",
    "$geoNear",
  ],
};
exports.MODEL = options.Model;

const get = async (id) => {
  let result = await service(options).get(id);
  return result;
};

const exists = async (id) => {
  let result = await options.Model.exists({ _id: id });
  return result;
};

const find = async (query) => {
  let result = await service(options).find(query);
  return result;
};

const create = async (data) => {
  let upload = await service(options).create(data);
  console.log(`Created Upload ${upload._id}`);
  return upload;
};

const setUploadDone = async (key, mimetype) => {
  return await patch(key.split("/")[1], {
    done: true,
    mimetype,
  });
};
exports.setUploadDone = setUploadDone;

const patch = async (id, data) => {
  let result = await service(options).patch(id, data);
  if (data.profilePictureFromUser) {
    await User.replaceProfilePictureUpload(data.profilePictureFromUser, id);
  }
  if (data.party) {
    await Party.addUpload(data.party, id);
  }
  /*
  if (data.competition) {
    await Competition.addUpload(data.competition, id);
  }*/
  if (data.post) {
    await Post.addUpload(data.post, id);
  }
  if (data.verifiedUser) {
    await User.replaceVerificationUpload(data.verifiedUser, id);
  }
  if (result.message && data.thumbnail) {
    await updateFirebaseImageMessage(
      result.conversation,
      result.message,
      result
    );
  }
  return result;
};

const remove = async (id) => {
  let result = await service(options).remove(id);
  console.log(`removing file ${id}`);
  await s3.deleteObject(result.bucket, result.key);
  // removing thumbnail
  if (result.thumbnail && (await exists(result.thumbnail))) {
    const thumbnail = await get(result.thumbnail);
    console.log(`removing thumbnail ${result.thumbnail}`);
    await service(options).remove(thumbnail._id);
    await s3.deleteObject(thumbnail.bucket, thumbnail.key);
  }
  if (result.party) {
    await Party.removeUpload(result.party, id);
  }
  /*
  if (result.competition) {
    await Competition.removeUpload(result.competition, id);
  }*/
  if (result.verifiedUser) {
    await User.removeVerificationUpload(result.verifiedUser, id);
  }
  if (result.post) {
    await Post.removeUploadFile(result.post, id);
  }
  if (result.profilePictureFromUser) {
    await User.removeProfilePicture(result.profilePictureFromUser);
  }
  if (result.newsletter) {
    await Newsletter.MODEL.updateOne(
      { _id: result.newsletter },
      { $set: { upload: null } }
    );
  }
  return result;
};
const removeRaw = async (id) => {
  let result = await service(options).remove(id);
  console.log(`removing file ${id}`);
  await s3.deleteObject(result.bucket, result.key);

  return result;
};
exports.removeRaw = removeRaw;

const getDownload = async (id) => {
  const result = await service(options).get(id);
  const data = await s3.getObjectByKey(result.key);
  return data;
};

const getPresignedUpload = async (userId) => {
  const id = mongoose.Types.ObjectId();
  const key = `${userId.toString()}/${id.toString()}`;
  const result = await service(options).create({
    _id: id,
    done: false,
    user: userId,
    path: `https://${process.env.S3_BUCKET}.s3.eu-central-1.amazonaws.com/${key}`,
    key,
    bucket: process.env.S3_BUCKET,
  });
  const url = await s3.getPresignedPutUrl(key);
  return { url, key, _id: id };
};
const getPresignedDownloadUrl = async (uploadId, preferThumbnail = false) => {
  const upload = await get(uploadId);
  // if (!upload.done) throw papeoError(PAPEO_ERRORS.UPLOAD_NOT_FINISHED);
  if (preferThumbnail && upload.thumbnail) {
    const thumbnail = await get(upload.thumbnail);
    return await s3.getPresignedGetUrl(thumbnail.bucket, thumbnail.key);
  }
  return await s3.getPresignedGetUrl(upload.bucket, upload.key);
};
exports.createVideoThumbnail = async (buffer) => {
  console.log("creating video thumbnail...");
  const filename = "file.mov";
  const filePath = "/tmp/" + filename;
  await fs.writeFileSync(filePath, buffer);
  const conversion = await new Promise((resolve, reject) => {
    const thumbnailPath = filePath + "-thumb.jpg";
    console.log({
      filename: filename + "-thumb",
      folder: filePath.replace(filename, ""),
    });
    ffmpeg(filePath)
      .screenshot({
        count: 1,
        size: "500x500",
        fastSeek: true,
        timestamps: ["10%"],
        filename: filename + "-thumb.jpg",
        folder: filePath.replace(filename, ""),
      })
      .on("end", () => {
        resolve({
          file: fs.readFileSync(thumbnailPath),
          filepath: thumbnailPath,
        });
      })
      .on("error", (err) => {
        return reject(new Error(err));
      });
  });
  // delete original
  await fs.unlinkSync(filePath);
  // delete thumbnail
  await fs.unlinkSync(conversion.filepath);
  console.log("generated video thumbnail");
  return conversion.file;
};
exports.generateAndSaveThumbnail = async (originalId, mimeType) => {
  const isImage = mimeType.startsWith("image/");
  const dbOriginal = await get(originalId);
  const original = await s3.getObject(dbOriginal.bucket, dbOriginal.key);

  let resizedImg = null;
  if (isImage) {
    console.log("creating photo thumbnail...");
    resizedImg = await sharp(original.Body)
      .resize(500, 500)
      .toFormat("jpeg")
      .toBuffer();
    console.log("generated photo thumbnail");
  } else {
    resizedImg = await this.createVideoThumbnail(original.Body);
  }
  await s3.uploadObject(
    // Thumbnail nicht im upload Bucket speichern, sonst gibt es einen Loop!
    process.env.S3_THUMBNAIL_BUCKET,
    dbOriginal.key,
    resizedImg,
    "image/jpeg"
  );
  console.log("uploaded thumbnail");
  const dbThumbnail = await create({
    done: true,
    isThumbnail: true,
    mimetype: "image/jpeg",
    bucket: process.env.S3_THUMBNAIL_BUCKET,
    key: dbOriginal.key,
    path: `https://${process.env.S3_THUMBNAIL_BUCKET}.s3.eu-central-1.amazonaws.com/${dbOriginal.key}`,
  });
  await patch(originalId, {
    thumbnail: dbThumbnail._id,
  });
  console.log({ dbThumbnail });
};

exports.needsThumbnail = (mimetype) => {
  const allowedMimeTypes = [
    /image\/jpeg$/i,
    /image\/png$/i,
    /image\/gif$/i,
    /video\/mp4$/i,
    /video\/quicktime$/i,
    /video\/h264$/i,
  ];
  for (const expression of allowedMimeTypes) {
    if (expression.test(mimetype)) {
      return true;
    }
  }
  return false;
};

exports.isMimetypeAllowed = (mimetype) => {
  const allowedMimeTypes = [
    /image\/jpeg$/i,
    /image\/png$/i,
    /image\/gif$/i,
    /video\/mp4$/i,
    /video\/quicktime$/i,
    /video\/h264$/i,
    /audio\/mp4$/i,
    /application\/msexcel$/i,
    /application\/mspowerpoint$/i,
    /application\/msword$/i,
    /application\/pdf$/i,
    /application\/zip$/i,
    /application\/mpeg$/i,
  ];
  for (const expression of allowedMimeTypes) {
    if (expression.test(mimetype)) {
      return true;
    }
  }
  return false;
};

exports.get = get;
exports.exists = exists;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
exports.getDownload = getDownload;
exports.getPresignedUpload = getPresignedUpload;
exports.getPresignedDownloadUrl = getPresignedDownloadUrl;
