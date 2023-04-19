const service = require("feathers-mongoose");
const User = require("../users/usersService.js");
const Upload = require("../uploads/uploadsService.js");
const Model = require("../../models/reports.model.js");
const PostComment = require("../posts/comments/postCommentsService");
const Rating = require("../ratings/ratingsService");
const Party = require("../parties/partiesService");
const Post = require("../posts/postsService");
const AdminLog = require("../adminlogs/adminLogsService");
const Restriction = require("../restrictions/restrictionsService");
const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const { Translate } = require("@google-cloud/translate").v2;
const translate = new Translate({ key: process.env.GOOGLE_TRANSLATE_KEY });
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
  const result = await service(options).get(id);
  return result;
};

const exists = async (id) => {
  const result = await options.Model.exists({ _id: id });
  return result;
};

const getByOneAttribute = async (attributeName, value) => {
  const result = await service(options).find({
    query: {
      [attributeName]: value,
    },
  });
  return result.data.length ? result.data[0] : null;
};

const find = async (query) => {
  const result = await service(options).find(query);
  return result;
};

const create = async (data) => {
  function alreadyReported(existingReportObject, userId, type) {
    if (!existingReportObject?.reports) return false;
    return (
      existingReportObject.reports.filter(
        (report) =>
          report.user.toString() === userId.toString() && report.type === type
      ).length !== 0
    );
  }
  if (data.reportedUser) {
    data.type = "user";
  }
  if (data.reportedParty) {
    data.type = "party";
    data.reportedUser = (await Party.get(data.reportedParty)).owner;
  }
  if (data.reportedPost) {
    data.type = "post";
    data.reportedUser = (await Post.get(data.reportedPost)).user;
  }
  if (data.reportedRating) {
    data.type = "rating";
    data.reportedUser = (await Rating.get(data.reportedRating)).user;
  }
  if (data.reportedComment) {
    data.type = "comment";
    data.reportedUser = (await PostComment.get(data.reportedComment)).user;
  }
  const existingReportObject = await options.Model.findOne({
    reportedUser: data.reportedUser,
  });
  if (alreadyReported(existingReportObject, data.user, data.type)) {
    switch (data.type) {
    case "user":
      throw papeoError(PAPEO_ERRORS.USER_ALREADY_REPORTED);
    case "party":
      throw papeoError(PAPEO_ERRORS.PARTY_ALREADY_REPORTED);
    case "post":
      throw papeoError(PAPEO_ERRORS.POST_ALREADY_REPORTED);
    case "rating":
      throw papeoError(PAPEO_ERRORS.RATING_ALREADY_REPORTED);
    case "comment":
      throw papeoError(PAPEO_ERRORS.COMMENT_ALREADY_REPORTED);
    }
  }

  if (!process.env.TEST && data.comment) {
    const [translation] = await translate.translate(data.comment, "de");
    console.log(translation);
    data.translation = translation;
  }
  let result = null;
  if (existingReportObject) {
    result = await patch(existingReportObject._id, {
      $push: { reports: data },
      $inc: { openReports: 1 },
    });
  } else {
    result = await service(options).create({
      reportedUser: data.reportedUser,
      reports: [data],
      openReports: 1,
    });
  }
  await User.patch(data.user, {
    $inc: {
      "reports.total": 1,
    },
  });
  console.log(`Created Report in ${result._id}`);
  return data;
};

const patch = async (id, data) => {
  const result = await service(options).patch(id, data);
  return result;
};

const remove = async (id) => {
  // remove all uploads for a report
  const report = await service(options).get(id);
  await Promise.all(
    report.uploads.map(async (upload) => {
      return await Upload.remove(upload);
    })
  );
  const result = await service(options).remove(id);
  return result;
};

const approveReport = async (user, reportedUserId, reportId) => {
  const report = await options.Model.findOne({ reportedUser: reportedUserId });
  if (!report) {
    throw new Error("Report not found");
  }
  const index = report.reports.findIndex(
    (r) => r._id.toString() === reportId.toString() && r.status === "open"
  );
  if (index === -1) throw new Error("report not found");

  await patch(report._id, {
    $set: {
      [`reports.${index}.status`]: "approved",
      [`reports.${index}.reviewedTimestamp`]: new Date(),
      [`reports.${index}.reviewedBy`]: user._id,
    },
    $inc: {
      openReports: -1,
    },
  });
  await AdminLog.TYPES.approvedReport({
    userId: user._id,
    report: report.reports[index],
  });
  await User.patch(report.reports[index].user, {
    $inc: {
      "reports.approved": 1,
    },
  });
};
exports.approveReport = approveReport;

const declineReport = async (user, reportedUserId, reportId) => {
  const report = await options.Model.findOne({ reportedUser: reportedUserId });
  if (!report) {
    throw papeoError(PAPEO_ERRORS.NOT_FOUND);
  }
  const index = report.reports.findIndex(
    (r) => r._id.toString() === reportId.toString() && r.status === "open"
  );
  if (index === -1) throw papeoError(PAPEO_ERRORS.NOT_FOUND);
  await patch(report._id, {
    $set: {
      [`reports.${index}.status`]: "declined",
      [`reports.${index}.reviewedBy`]: await User.get(user._id),
      [`reports.${index}.reviewedTimestamp`]: new Date().toISOString(),
    },
    $inc: {
      openReports: -1,
    },
  });
  await AdminLog.TYPES.declinedReport({
    userId: user._id,
    report: report.reports[index],
  });
  await User.patch(report.reports[index].user, {
    $inc: {
      "reports.declined": 1,
    },
  });
};
exports.declineReport = declineReport;

const getFormattedReports = async (query) => {
  const reports = await find({
    query: {
      ...query,
      $populate: {
        path: "reportedUser reports.user reports.reportedParty reports.reportedUser reports.reportedPost reports.reportedRating reports.reportedComment reports.reviewedBy",
      },
      $sort: { openReports: -1 },
    },
  });

  async function formatReport(report) {
    const totalReports = report.reports.length;
    const openReports = report.reports.filter(
      (r) => r.status === "open"
    ).length;
    // user
    const totalUserReports = report.reports.filter(
      (r) => r.type === "user"
    ).length;
    const openUserReports = report.reports.filter(
      (r) => r.type === "user" && r.status === "open"
    ).length;
    // parties
    const totalPartyReports = report.reports.filter(
      (r) => r.type === "party"
    ).length;
    const openPartyReports = report.reports.filter(
      (r) => r.type === "party" && r.status === "open"
    ).length;
    // parties
    const totalPostReports = report.reports.filter(
      (r) => r.type === "post"
    ).length;
    const openPostReports = report.reports.filter(
      (r) => r.type === "post" && r.status === "open"
    ).length;
    // comments
    const totalCommentReports = report.reports.filter(
      (r) => r.type === "comment"
    ).length;
    const openCommentReports = report.reports.filter(
      (r) => r.type === "comment" && r.status === "open"
    ).length;

    const userMutedCount = await Restriction.MODEL.countDocuments({
      user: report.reportedUser,
    });
    return {
      ...report,
      totalReports,
      openReports,
      totalUserReports,
      openUserReports,
      totalPartyReports,
      openPartyReports,
      totalPostReports,
      openPostReports,
      totalCommentReports,
      openCommentReports,
      userMutedCount,
    };
  }
  reports.data = await Promise.all(reports.data.map(formatReport));
  return reports;
};
exports.getFormattedReports = getFormattedReports;

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
