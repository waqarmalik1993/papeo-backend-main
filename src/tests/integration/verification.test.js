const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const {
  getUser,
  followUser,
  sendFriendRequest,
  deleteFriend,
  acceptFriendRequest,
  getFriends,
  unfollowUser,
  getFollowers,
  checkAvailability,
  patchUser,
  deleteUser,
  createUser,
  wipeDatabaseAndEmptyS3Bucket,
  checkForSensitiveData,
  checkForSensitiveDataInOwnUser,
  uploadVerificationVideo,
  setVerificationVideo,
  getUsersS3Uploads,
  removeUpload,
  voteForVerification,
  getUsersToVerify,
} = require("./helpers");
const User = require("../../services/users/usersService.js");
const Upload = require("../../services/uploads/uploadsService");
const AdminLog = require("../../services/adminlogs/adminLogsService");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("Verification", function () {
  this.timeout(30000);
  before(async function () {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("can upload a verification video", async function () {
    const myUser = await createUser();
    const video = await uploadVerificationVideo(myUser);
    const res = await setVerificationVideo(myUser, video).expect(200);

    const uploads = await getUsersS3Uploads(myUser);
    expect(uploads).to.have.a.lengthOf(1);

    const databaseUser = await User.get(myUser._id);
    expect(databaseUser.verification.upload.toString()).to.equal(
      res.body._id.toString()
    );
    expect(databaseUser.verification.verified).to.be.false;
    expect(databaseUser.verification.votes).to.have.a.lengthOf(0);
  });
  it("a second upload replaces the first upload and deletes ist", async function () {
    const myUser = await createUser();
    const video = await uploadVerificationVideo(myUser);
    const res = await setVerificationVideo(myUser, video).expect(200);

    await User.patch(myUser._id, { "verification.uploadTimestamp": null });
    expect(await getUsersS3Uploads(myUser)).to.have.a.lengthOf(1);
    const video2 = await uploadVerificationVideo(myUser);
    const res2 = await setVerificationVideo(myUser, video2).expect(200);
    expect(await getUsersS3Uploads(myUser)).to.have.a.lengthOf(1);

    const databaseUser = await User.get(myUser._id.toString());
    expect(databaseUser.verification.upload.toString()).to.equal(
      res2.body._id.toString()
    );
    const dbVerificationFiles = (
      await Upload.find({
        query: {
          verifiedUser: myUser._id.toString(),
        },
      })
    ).data;
    expect(dbVerificationFiles).to.have.a.lengthOf(1);
  });
  it("deletion of verification file is reflected in users object", async function () {
    const myUser = await createUser();
    const video = await uploadVerificationVideo(myUser);
    const res = await setVerificationVideo(myUser, video).expect(200);
    expect(await getUsersS3Uploads(myUser)).to.have.a.lengthOf(1);
    const databaseUser1 = await User.get(myUser._id.toString());
    expect(databaseUser1.verification.upload).to.not.be.null;

    await removeUpload(myUser, res.body._id).expect(200);
    expect(await getUsersS3Uploads(myUser)).to.have.a.lengthOf(0);
    const databaseUser = await User.get(myUser._id.toString());
    expect(databaseUser.verification.upload).to.be.null;
  });
  it("I cannot vote for a user that has no verification video", async function () {
    const myUser = await createUser();
    const userToVote = await createUser();

    const res = await voteForVerification(myUser, userToVote, false).expect(
      400
    );
    expect(res.body.data.code).to.be.equal(
      PAPEO_ERRORS.USER_IS_HAS_NO_VERIFICATION_VIDEO.code
    );
    databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.votes).to.have.a.lengthOf(0);
  });
  it("I cannot vote for myself", async function () {
    const myUser = await createUser();
    const video = await uploadVerificationVideo(myUser);
    await setVerificationVideo(myUser, video).expect(200);

    const res = await voteForVerification(myUser, myUser, false).expect(400);
    expect(res.body.data.code).to.be.equal(
      PAPEO_ERRORS.YOU_CANNOT_VOTE_FOR_YOURSELF.code
    );
    databaseUserToVote = await User.get(myUser._id.toString());
    expect(databaseUserToVote.verification.votes).to.have.a.lengthOf(0);
  });
  it("I can vote for a verification but not twice", async function () {
    const myUser = await createUser();
    const userToVote = await createUser();

    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);

    await voteForVerification(myUser, userToVote, true).expect(200);
    let databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.votes).to.have.a.lengthOf(1);

    const res = await voteForVerification(myUser, userToVote, false).expect(
      400
    );
    expect(res.body.data.code).to.be.equal(
      PAPEO_ERRORS.YOU_ALREADY_VOTED_FOR_THIS_USER.code
    );
    databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.votes).to.have.a.lengthOf(1);
  });
  const userCanVote = {
    verified: false,
    upload: null,
    votes: [],
    voted: {
      votesAreCounted: true,
      correct: 0,
      incorrect: 0,
    },
  };
  it("Only votes are counted where votesAreCounted: true", async function () {
    const myUser = await createUser();
    const userToVote = await createUser();
    const [u1, u2, u3] = await Promise.all([
      createUser({ verification: userCanVote }),
      createUser({ verification: userCanVote }),
      createUser({ verification: userCanVote }),
    ]);

    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);

    await voteForVerification(myUser, userToVote, true).expect(200);
    await voteForVerification(u1, userToVote, true).expect(200);
    await voteForVerification(u2, userToVote, true).expect(200);
    await voteForVerification(u3, userToVote, true).expect(200);
    let databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.votes).to.have.a.lengthOf(4);
    expect(
      databaseUserToVote.verification.votes.filter((v) => v.isCounted)
    ).to.have.a.lengthOf(3);
  });
  it("User gets verified if 90 percent of votes are true", async function () {
    const myUser = await createUser();
    const userToVote = await createUser();
    const votingUsers = await Promise.all(
      new Array(99)
        .fill(null)
        .map((tmp) => createUser({ verification: userCanVote }))
    );

    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);

    await Promise.all(
      votingUsers.map((vu) => {
        return voteForVerification(vu, userToVote, true).expect(200);
      })
    );
    let databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.votes).to.have.a.lengthOf(99);
    expect(databaseUserToVote.verification.verified).to.be.false;

    await voteForVerification(
      await createUser({ verification: userCanVote }),
      userToVote,
      false
    ).expect(200);
    databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.votes).to.have.a.lengthOf(100);
    expect(databaseUserToVote.verification.verified).to.be.true;
  });
  it("Cannot vote for a user that is already verified", async function () {
    const myUser = await createUser();
    const userToVote = await createUser();
    const votingUsers = await Promise.all(
      new Array(100)
        .fill(null)
        .map((tmp) => createUser({ verification: userCanVote }))
    );
    console.log("#1");
    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);
    console.log("#2");
    
    await Promise.all(
      votingUsers.map((vu) => {
        return voteForVerification(vu, userToVote, true).expect(200);
      })
    );
    console.log("#3");
    const res = await voteForVerification(myUser, userToVote, true).expect(400);
    expect(res.body.data.code).to.be.equal(
      PAPEO_ERRORS.USER_IS_ALREADY_VERIFIED.code
    );
  });
  it("User that voted get their votecount increased", async function () {
    const myUser = await createUser();
    const userToVote = await createUser();
    const userThatIsIncorrect = await createUser({ verification: userCanVote });
    const votingUsers = await Promise.all(
      new Array(99)
        .fill(null)
        .map((tmp) => createUser({ verification: userCanVote }))
    );

    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);

    await Promise.all(
      votingUsers.map((vu) => {
        return voteForVerification(vu, userToVote, true).expect(200);
      })
    );
    for (const user of votingUsers) {
      const u = await User.get(user._id.toString());
      expect(u.verification.voted.correct).to.be.equal(0);
      expect(u.verification.voted.incorrect).to.be.equal(0);
    }

    await voteForVerification(userThatIsIncorrect, userToVote, false).expect(
      200
    );
    const databaseUserThatIsIncorrect = await User.get(
      userThatIsIncorrect._id.toString()
    );
    expect(databaseUserThatIsIncorrect.verification.voted.correct).to.be.equal(
      0
    );
    expect(
      databaseUserThatIsIncorrect.verification.voted.incorrect
    ).to.be.equal(1);
    for (const user of votingUsers) {
      const u = await User.get(user._id.toString());
      expect(u.verification.voted.correct).to.be.equal(1);
      expect(u.verification.voted.incorrect).to.be.equal(0);
    }
  });
  it("User that voted get their votecount increased and their Votes are counted", async function () {
    const adminUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const votingUser = await createUser();

    const usersToVote = await Promise.all(
      new Array(10).fill(null).map((tmp) => createUser())
    );
    // upload all verification videos
    await Promise.all(
      usersToVote.map(async (u) => {
        const video = await uploadVerificationVideo(u);
        await setVerificationVideo(u, video).expect(200);
      })
    );
    await Promise.all(
      usersToVote.map(async (userToVote) => {
        return await voteForVerification(votingUser, userToVote, true).expect(
          200
        );
      })
    );
    let databaseVotingUser = await User.get(votingUser._id.toString());
    expect(databaseVotingUser.verification.voted.correct).to.be.equal(0);
    expect(databaseVotingUser.verification.voted.incorrect).to.be.equal(0);
    expect(databaseVotingUser.verification.voted.votesAreCounted).to.be.false;

    // verify all users by an admin
    await Promise.all(
      usersToVote.map(async (userToVote) => {
        return await voteForVerification(adminUser, userToVote, true).expect(
          200
        );
      })
    );

    databaseVotingUser = await User.get(votingUser._id.toString());
    expect(databaseVotingUser.verification.voted.correct).to.be.equal(10);
    expect(databaseVotingUser.verification.voted.incorrect).to.be.equal(0);
    expect(databaseVotingUser.verification.voted.votesAreCounted).to.be.true;
  });
  it("User is not verified if he changes his verification video and old video is deleted", async function () {
    const adminUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const userToVote = await createUser();

    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);

    // verify user
    await voteForVerification(adminUser, userToVote, true).expect(200);
    let databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.verified).to.be.true;
    expect(await getUsersS3Uploads(userToVote)).to.have.a.lengthOf(1);

    await User.patch(userToVote._id, { "verification.uploadTimestamp": null });
    const video2 = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video2).expect(200);

    databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.verified).to.be.false;
    expect(await getUsersS3Uploads(userToVote)).to.have.a.lengthOf(1);
  });
  it("Re-recording of a verification video is only possible once within 24 hours", async function () {
    const adminUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const userToVote = await createUser();

    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);

    // verify user
    await voteForVerification(adminUser, userToVote, true).expect(200);
    let databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.verified).to.be.true;
    expect(await getUsersS3Uploads(userToVote)).to.have.a.lengthOf(1);

    //await User.patch(userToVote._id, { "verification.uploadTimestamp": null });
    const video2 = await uploadVerificationVideo(userToVote);
    const res = await setVerificationVideo(userToVote, video2).expect(400);
    expect(res.body.data.code).to.be.equal(
      PAPEO_ERRORS.VERIFICATION_UPLOAD_NOT_POSSIBLE_24H.code
    );

    const before25Hours = new Date();
    before25Hours.setTime(before25Hours.getTime() - 25 * 60 * 60 * 1000);
    await User.patch(userToVote._id, {
      "verification.uploadTimestamp": before25Hours,
    });

    const video3 = await uploadVerificationVideo(userToVote);
    const res3 = await setVerificationVideo(userToVote, video3).expect(200);
    databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.verified).to.be.false;
    expect(await getUsersS3Uploads(userToVote)).to.have.a.lengthOf(1);
  });
  it("Verification is ressetted if I change my username", async function () {
    const adminUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const userToVote = await createUser();

    await User.patch(userToVote._id, {
      username: "username",
    });

    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);

    // verify user
    await voteForVerification(adminUser, userToVote, true).expect(200);
    let databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.verified).to.be.true;

    await User.patch(userToVote._id, {
      username: "etrbethgbet",
    });
    databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.verified).to.be.false;
    expect(databaseUserToVote.verification.votes).to.have.a.lengthOf(0);
    expect(databaseUserToVote.verification.upload).to.be.null;
  });
  it("Verification is ressetted if I change my gender", async function () {
    const adminUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const userToVote = await createUser({ sex: "female" });

    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);

    // verify user
    await voteForVerification(adminUser, userToVote, true).expect(200);
    let databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.verified).to.be.true;

    await User.patch(userToVote._id, {
      sex: "male",
    });
    databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.verified).to.be.false;
    expect(databaseUserToVote.verification.votes).to.have.a.lengthOf(0);
    expect(databaseUserToVote.verification.upload).to.be.null;
  });
  describe("users to verify", function () {
    it("I am not in the response", async function () {
      await wipeDatabaseAndEmptyS3Bucket();
      const myUser = await createUser();

      const video = await uploadVerificationVideo(myUser);
      await setVerificationVideo(myUser, video).expect(200);

      const res = (await getUsersToVerify(myUser)).body;
      expect(res.data).to.have.a.lengthOf(0);
    });
    it("I am not in the response but other users are", async function () {
      await wipeDatabaseAndEmptyS3Bucket();
      const myUser = await createUser();

      const video = await uploadVerificationVideo(myUser);
      await setVerificationVideo(myUser, video).expect(200);

      const usersToVote = await Promise.all(
        new Array(5).fill(null).map((tmp) => createUser())
      );
      // upload all verification videos
      await Promise.all(
        usersToVote.map(async (u) => {
          const video = await uploadVerificationVideo(u);
          await setVerificationVideo(u, video).expect(200);
        })
      );

      const res = (await getUsersToVerify(myUser)).body;
      expect(res.data).to.have.a.lengthOf(5);
    });
    it("Users I already voted are not in the response", async function () {
      await wipeDatabaseAndEmptyS3Bucket();
      const myUser = await createUser();

      const video = await uploadVerificationVideo(myUser);
      await setVerificationVideo(myUser, video).expect(200);

      const usersToVote = await Promise.all(
        new Array(5).fill(null).map((tmp) => createUser())
      );
      // upload all verification videos
      await Promise.all(
        usersToVote.map(async (u) => {
          const video = await uploadVerificationVideo(u);
          await setVerificationVideo(u, video).expect(200);
        })
      );

      await voteForVerification(myUser, usersToVote[0], true).expect(200);
      await voteForVerification(myUser, usersToVote[1], true).expect(200);

      const res = (await getUsersToVerify(myUser)).body;
      expect(res.data).to.have.a.lengthOf(3);
    });
  });
});

after(async function () {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
