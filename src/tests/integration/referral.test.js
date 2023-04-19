const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const h = require("./helpers");
const User = require("../../services/users/usersService.js");
const Follower = require("../../services/followers/followersService");
const PartyGuest = require("../../services/partyGuests/partyGuestsService");
const Party = require("../../services/parties/partiesService");
const ImageMention = require("../../services/imageMention/imageMentionService");
const Uploads = require("../../services/uploads/uploadsService");
const AdminLog = require("../../services/adminlogs/adminLogsService");
const Transaction = require("../../services/transactions/transactionsService");
const ReferralTree = require("../../services/referralTree/referralTreeService");
const { UploadsSchema } = require("../../modules/validation/uploads.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const jwt = require("jsonwebtoken");
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
const chai = require("chai");
chai.use(require("chai-shallow-deep-equal"));
describe("Referrals", function () {
  before(async function () {
    await startServer();
    await h.wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  function refer(referrer, referred) {
    console.log(`${referrer._id} referred ${referred._id}`);
    return h.patchUser(referred, referred, {
      referredBy: referrer.referralCodes[0].code,
    });
  }
  describe("Referrals", function () {
    it("newly created User has one referralCode", async function () {
      const myUser = await h.createUser();
      console.log(myUser._id);
      console.log(myUser.referralCodes);
      expect(myUser.referralCodes).to.have.a.lengthOf(1);
      expect(myUser.referralCodes[0].code)
        .to.be.an("string")
        .and.to.have.lengthOf(6);
      expect(myUser.referralCodes[0].createdAt).to.be.an("Date");
    });
    it("cannot use an invalid referredBy referral code", async function () {
      const myUser = await h.createUser();
      expect(myUser.referralCodes).to.have.a.lengthOf(1);
      expect(myUser.referredBy).to.be.null;
      await h.patchUser(myUser, myUser, { referredBy: "ABCDEF" }).expect(400);
      expect((await User.get(myUser._id)).referredBy).to.be.null;
    });
    it("can use valid referredBy referral code", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      console.log(myUser._id);
      console.log(myUser.referralCodes);
      expect(myUser.referralCodes).to.have.a.lengthOf(1);
      expect(myUser.referredBy).to.be.null;

      await h
        .patchUser(otherUser, otherUser, {
          referredBy: myUser.referralCodes[0].code,
        })
        .expect(200);
      expect((await User.get(otherUser._id)).referredBy).to.equal(
        myUser.referralCodes[0].code
      );
    });
    it("referred user should atomatically follow the referrer", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      console.log(myUser._id);
      console.log(myUser.referralCodes);
      expect(myUser.referralCodes).to.have.a.lengthOf(1);
      expect(myUser.referredBy).to.be.null;

      await h
        .patchUser(otherUser, otherUser, {
          referredBy: myUser.referralCodes[0].code,
        })
        .expect(200);
      expect((await User.get(otherUser._id)).referredBy).to.equal(
        myUser.referralCodes[0].code
      );
      expect(
        await Follower.MODEL.find({
          user: otherUser._id,
          followedUser: myUser._id,
        })
      ).to.have.a.lengthOf(1);
    });
    it("cannot use my own referral code", async function () {
      const myUser = await h.createUser();
      console.log(myUser._id);
      console.log(myUser.referralCodes);
      expect(myUser.referralCodes).to.have.a.lengthOf(1);
      expect(myUser.referredBy).to.be.null;

      await h
        .patchUser(myUser, myUser, {
          referredBy: myUser.referralCodes[0].code,
        })
        .expect(400);
      expect((await User.get(myUser._id)).referredBy).to.equal(null);
    });
    it("creates a 500 PP Transaction for both users when referring", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      console.log(myUser._id);
      console.log(myUser.referralCodes);
      expect(myUser.referralCodes).to.have.a.lengthOf(1);
      expect(myUser.referredBy).to.be.null;

      await h
        .patchUser(otherUser, otherUser, {
          referredBy: myUser.referralCodes[0].code,
        })
        .expect(200);
      expect((await User.get(otherUser._id)).referredBy).to.equal(
        myUser.referralCodes[0].code
      );
      const myUserTransactions = await Transaction.MODEL.find({
        user: myUser._id,
      });
      const otherUserTransactions = await Transaction.MODEL.find({
        user: otherUser._id,
      });

      expect(myUserTransactions).to.have.a.lengthOf(1);
      expect(otherUserTransactions).to.have.a.lengthOf(1);
      expect(myUserTransactions[0].type).to.be.equal("referredUserCreditMLM");
      console.log(otherUserTransactions);
      expect(otherUserTransactions[0].type).to.be.equal(
        "referredByAUserCredit"
      );
      expect(myUserTransactions[0].amount).to.be.equal(500);
      expect(otherUserTransactions[0].amount).to.be.equal(500);
    });
    describe("Referral Tree", function () {
      it("Referral tree entry is created with correct data when user refers a user", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser();

        const pic = await h.uploadProfilePic(otherUser);
        await h.setProfilePicture(otherUser, pic).expect(200);
        const pic2 = await h.uploadProfilePic(myUser);
        await h.setProfilePicture(myUser, pic2).expect(200);
        await h
          .patchUser(otherUser, otherUser, {
            referredBy: myUser.referralCodes[0].code,
          })
          .expect(200);
        expect((await User.get(otherUser._id)).referredBy).to.equal(
          myUser.referralCodes[0].code
        );
        const myUserReferrals = await ReferralTree.MODEL.find({
          parent: myUser._id,
        });
        const otherUserReferrals = await ReferralTree.MODEL.find({
          _id: otherUser._id,
        });
        expect(myUserReferrals).to.have.a.lengthOf(1);
        expect(otherUserReferrals).to.have.a.lengthOf(1);

        // check if it is the same entry
        expect(myUserReferrals[0]._id.toString()).to.be.equal(
          otherUserReferrals[0]._id.toString()
        );

        expect(myUserReferrals[0].parent.toString()).to.be.equal(
          myUser._id.toString()
        );
        expect(myUserReferrals[0]._id.toString()).to.be.equal(
          otherUser._id.toString()
        );
        // userData
        expect(myUserReferrals[0].userData._id.toString()).to.be.equal(
          otherUser._id.toString()
        );
        console.log(myUserReferrals[0]);
        expect(myUserReferrals[0].userData.username)
          .to.be.an("string")
          .and.to.be.equal(otherUser.username);
        expect(
          myUserReferrals[0].userData.profilePicture.toString()
        ).to.be.equal(pic._id.toString());
      });
      it("Cannot overwrite the referredByAttribute and no referralTree entry is created when the same referralcode is entered multiple times", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser();
        const otherUser2 = await h.createUser();

        console.log(otherUser.referralCodes[0].code);
        console.log(otherUser2.referralCodes[0].code);
        await h
          .patchUser(otherUser, otherUser, {
            referredBy: myUser.referralCodes[0].code,
          })
          .expect(200);
        await h
          .patchUser(otherUser, otherUser, {
            referredBy: myUser.referralCodes[0].code,
          })
          .expect(400);
        await h
          .patchUser(otherUser, otherUser, {
            referredBy: myUser.referralCodes[0].code,
          })
          .expect(400);
        await h
          .patchUser(otherUser, otherUser, {
            referredBy: otherUser2.referralCodes[0].code,
          })
          .expect(400);
        expect((await User.get(otherUser._id)).referredBy).to.equal(
          myUser.referralCodes[0].code
        );
        const myUserReferrals = await ReferralTree.MODEL.find({
          parent: myUser._id,
        });
        const otherUserReferrals = await ReferralTree.MODEL.find({
          _id: otherUser._id,
        });
        expect(myUserReferrals).to.have.a.lengthOf(1);
        expect(otherUserReferrals).to.have.a.lengthOf(1);

        // check if it is the same entry
        expect(myUserReferrals[0]._id.toString()).to.be.equal(
          otherUserReferrals[0]._id.toString()
        );

        expect(myUserReferrals[0].parent.toString()).to.be.equal(
          myUser._id.toString()
        );
        expect(myUserReferrals[0]._id.toString()).to.be.equal(
          otherUser._id.toString()
        );
        expect(myUserReferrals[0].userData._id.toString()).to.be.equal(
          otherUser._id.toString()
        );
        console.log(myUserReferrals[0]);
        expect(myUserReferrals[0].userData.username)
          .to.be.an("string")
          .and.to.be.equal(otherUser.username);
      });
      it("a user can patch a users referredBy code if it is null and he is a partyKing", async function () {
        const myUser = await h.createUser({ isPartyKing: true });
        const otherUser = await h.createUser({ isPartyKing: true });
        const otherUser2 = await h.createUser({ isPartyKing: true });
        const otherUser3 = await h.createUser({ isPartyKing: true });
        await h
          .patchUser(otherUser, myUser, {
            referredBy: otherUser.referralCodes[0].code,
          })
          .expect(200);

        expect((await User.get(myUser._id)).referredBy).to.equal(
          otherUser.referralCodes[0].code
        );
        const myUserReferrals = await ReferralTree.MODEL.find({
          _id: myUser._id,
        });
        const otherUserReferrals = await ReferralTree.MODEL.find({
          parent: otherUser._id,
        });
        expect(myUserReferrals).to.have.a.lengthOf(1);
        expect(otherUserReferrals).to.have.a.lengthOf(1);

        // check if it is the same entry
        expect(myUserReferrals[0]._id.toString()).to.be.equal(
          otherUserReferrals[0]._id.toString()
        );

        expect(myUserReferrals[0]._id.toString()).to.be.equal(
          myUser._id.toString()
        );
        expect(myUserReferrals[0].parent.toString()).to.be.equal(
          otherUser._id.toString()
        );
        expect(myUserReferrals[0].userData._id.toString()).to.be.equal(
          myUser._id.toString()
        );
        console.log(myUserReferrals[0]);
        expect(myUserReferrals[0].userData.username)
          .to.be.an("string")
          .and.to.be.equal(myUser.username);

        console.log((await User.get(myUser._id)).referredBy);
        console.log((await User.get(myUser._id)).referredByEditableUntil);
        await h
          .patchUser(otherUser2, myUser, {
            referredBy: otherUser2.referralCodes[0].code,
          })
          .expect(403);

        // check if user itself can set referralcode
        await h
          .patchUser(myUser, myUser, {
            referredBy: otherUser2.referralCodes[0].code,
          })
          .expect(200);
        expect((await User.get(myUser._id)).referredBy).to.equal(
          otherUser2.referralCodes[0].code
        );
        expect((await User.get(myUser._id)).referredByEditableUntil).to.equal(
          null
        );
        // user cannot change the code again
        await h
          .patchUser(myUser, myUser, {
            referredBy: otherUser3.referralCodes[0].code,
          })
          .expect(400);
        expect((await User.get(myUser._id)).referredBy).to.equal(
          otherUser2.referralCodes[0].code
        );
        expect((await User.get(myUser._id)).referredByEditableUntil).to.equal(
          null
        );
      });
      it("a user cannot patch a users referredBy code if it is null if he isnt a partyKing", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser({ isPartyKing: false });
        await h
          .patchUser(otherUser, myUser, {
            referredBy: otherUser.referralCodes[0].code,
          })
          .expect(400);

        expect((await User.get(myUser._id)).referredBy).to.equal(null);
        const myUserReferrals = await ReferralTree.MODEL.find({
          _id: myUser._id,
        });
        const otherUserReferrals = await ReferralTree.MODEL.find({
          parent: otherUser._id,
        });
        expect(myUserReferrals).to.have.a.lengthOf(0);
        expect(otherUserReferrals).to.have.a.lengthOf(0);
      });
      it("users should not get partypoints when the referralCode is set in a foreign profile", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser({ isPartyKing: true });
        await h
          .patchUser(otherUser, myUser, {
            referredBy: otherUser.referralCodes[0].code,
          })
          .expect(200);

        expect(
          await Transaction.MODEL.find({ user: myUser._id })
        ).to.have.a.lengthOf(0);
        expect(
          await Transaction.MODEL.find({ user: otherUser._id })
        ).to.have.a.lengthOf(0);
      });
      it("user can patch a foreign code for 14 days if he is not a partyKing", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser({ isPartyKing: true });
        const otherUser2 = await h.createUser();
        const otherUser3 = await h.createUser();
        await h
          .patchUser(otherUser, myUser, {
            referredBy: otherUser.referralCodes[0].code,
          })
          .expect(200);
        let myUserDb = await User.MODEL.findById(myUser._id);
        const inTwoWeeks = new Date();
        inTwoWeeks.setTime(inTwoWeeks.getTime() + 14 * 24 * 60 * 60 * 1000);
        expect(myUserDb.referredByEditableUntil.getTime()).to.be.approximately(
          inTwoWeeks.getTime(),
          1000 * 3 // 3s
        );

        expect(myUserDb.referredBy).to.equal(otherUser.referralCodes[0].code);
        // set referredByEditableUntil to now
        const updatedDate = new Date();
        await User.MODEL.updateOne(
          { _id: myUser._id },
          { $set: { referredByEditableUntil: updatedDate } }
        );
        await h
          .patchUser(myUser, myUser, {
            referredBy: otherUser2.referralCodes[0].code,
          })
          .expect(400);
        myUserDb = await User.MODEL.findById(myUser._id);
        expect(myUserDb.referredByEditableUntil.getTime()).to.be.equal(
          updatedDate.getTime()
        );
        expect(myUserDb.referredBy).to.equal(otherUser.referralCodes[0].code);

        await User.MODEL.updateOne(
          { _id: myUser._id },
          {
            $set: {
              referredByEditableUntil: updatedDate.setTime(
                updatedDate.getTime() + 1000 * 60 * 10
              ),
            },
          }
        );

        await h
          .patchUser(myUser, myUser, {
            referredBy: otherUser2.referralCodes[0].code,
          })
          .expect(200);

        myUserDb = await User.MODEL.findById(myUser._id);
        expect(myUserDb.referredByEditableUntil).to.be.equal(null);
        expect(myUserDb.referredBy).to.equal(otherUser2.referralCodes[0].code);
      });

      it("I cannot refer a user which is in the referraltree above me", async function () {
        const myUser = await h.createUser({ isPartyKing: true });
        /**/ const otherUser = await h.createUser({ isPartyKing: true });
        /*  */ const otherUser2 = await h.createUser({ isPartyKing: true });

        function referWithUser(referrer, referred) {
          return h.patchUser(referrer, referred, {
            referredBy: referrer.referralCodes[0].code,
          });
        }
        await referWithUser(myUser, otherUser).expect(200);
        await referWithUser(otherUser, otherUser2).expect(200);

        expect(
          await ReferralTree.MODEL.find({ parent: otherUser2._id })
        ).to.have.a.lengthOf(0);
        await referWithUser(otherUser2, myUser).expect(400);
        expect(
          await ReferralTree.MODEL.find({ parent: otherUser2._id })
        ).to.have.a.lengthOf(0);
      });
      it("I cannot set my referralCode to a code which is from a user under me in the referraltree", async function () {
        const myUser = await h.createUser({ isPartyKing: true });
        /**/ const otherUser = await h.createUser({ isPartyKing: true });
        /*  */ const otherUser2 = await h.createUser({ isPartyKing: true });

        function referWithUser(referrer, referred) {
          return h.patchUser(referrer, referred, {
            referredBy: referrer.referralCodes[0].code,
          });
        }
        await referWithUser(myUser, otherUser).expect(200);
        await referWithUser(otherUser, otherUser2).expect(200);

        expect(
          await ReferralTree.MODEL.find({ parent: myUser._id })
        ).to.have.a.lengthOf(1);
        await h
          .patchUser(myUser, myUser, {
            referredBy: otherUser2.referralCodes[0].code,
          })
          .expect(400);
        expect(
          await ReferralTree.MODEL.find({ parent: myUser._id })
        ).to.have.a.lengthOf(1);
      });
      it("I cannot UPDATE my referralCode to a code which is from a user under me in the referraltree", async function () {
        const myUser = await h.createUser({ isPartyKing: true });
        /**/ const otherUser = await h.createUser({ isPartyKing: true });
        /*  */ const otherUser2 = await h.createUser({ isPartyKing: true });
        /*    */ const otherUser3 = await h.createUser({ isPartyKing: true });

        function referWithUser(referrer, referred) {
          return h.patchUser(referrer, referred, {
            referredBy: referrer.referralCodes[0].code,
          });
        }
        await referWithUser(myUser, otherUser).expect(200);
        await referWithUser(otherUser, otherUser2).expect(200);
        await referWithUser(otherUser2, otherUser3).expect(200);

        expect(
          await ReferralTree.MODEL.find({ parent: otherUser._id })
        ).to.have.a.lengthOf(1);
        await h
          .patchUser(otherUser, otherUser, {
            referredBy: otherUser3.referralCodes[0].code,
          })
          .expect(400);
        expect(
          await ReferralTree.MODEL.find({ parent: otherUser._id })
        ).to.have.a.lengthOf(1);
      });
      it("referraltree route returns status code 200", async function () {
        const myUser = await h.createUser();
        await h.getReferralTree(myUser).expect(200);
      });
      describe("Multi Level Referring", function () {
        it("checking correct amount of referraltree entries for an abitrary referraltree", async function () {
          async function refer(referrer, referred) {
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const myUser = await h.createUser();
          /**/ const otherUser = await h.createUser();
          /*  */ const otherUser2 = await h.createUser();
          /*    */ const otherUser2_1 = await h.createUser();
          /*      */ const otherUser2_1_1 = await h.createUser();
          /*      */ const otherUser2_1_2 = await h.createUser();
          /*    */ const otherUser2_3 = await h.createUser();
          /*    */ const otherUser2_4 = await h.createUser();
          const otherUser3 = await h.createUser();
          /**/ const otherUser3_1 = await h.createUser();
          /*  */ const otherUser3_1_1 = await h.createUser();
          /*  */ const otherUser3_1_2 = await h.createUser();

          await refer(myUser, otherUser);
          await refer(otherUser, otherUser2);
          await refer(otherUser2, otherUser2_1);
          await refer(otherUser2_1, otherUser2_1_1);
          await refer(otherUser2_1, otherUser2_1_2);

          await refer(otherUser2, otherUser2_3);
          await refer(otherUser2, otherUser2_4);

          await refer(otherUser3, otherUser3_1);
          await refer(otherUser3_1, otherUser3_1_1);
          await refer(otherUser3_1, otherUser3_1_2);

          expect(
            await ReferralTree.MODEL.find({ parent: myUser._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser2_1._id })
          ).to.have.a.lengthOf(2);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser2_3._id })
          ).to.have.a.lengthOf(0);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser2_4._id })
          ).to.have.a.lengthOf(0);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1._id })
          ).to.have.a.lengthOf(2);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1_1._id })
          ).to.have.a.lengthOf(0);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1_2._id })
          ).to.have.a.lengthOf(0);
        });
        it("check for correct datastructure when user updates referralCode; check correct return value for getReferralChain function", async function () {
          function refer(referrer, referred) {
            return h.patchUser(referrer, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const differentUser = await h.createUser({
            username: "differentUser",
            isPartyKing: true,
          });
          const otherUser3 = await h.createUser({
            username: "otherUser3",
            isPartyKing: true,
          });
          /**/ const otherUser3_1 = await h.createUser({
            username: "otherUser3_1",
            isPartyKing: true,
          });
          /*  */ const otherUser3_1_1 = await h.createUser({
            username: "otherUser3_1_1",
          });
          /*  */ const otherUser3_1_2 = await h.createUser({
            username: "otherUser3_1_2",
            isPartyKing: true,
          });
          /*     */ const otherUser3_1_2_1 = await h.createUser({
            username: "otherUser3_1_2_1",
          });

          await refer(otherUser3, otherUser3_1).expect(200);
          await refer(otherUser3_1, otherUser3_1_1).expect(200);
          await refer(otherUser3_1, otherUser3_1_2).expect(200);
          await refer(otherUser3_1_2, otherUser3_1_2_1).expect(200);

          // check integrity
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1._id })
          ).to.have.a.lengthOf(2);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1_1._id })
          ).to.have.a.lengthOf(0);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1_2._id })
          ).to.have.a.lengthOf(1);

          const referralChain_otherUser3_1_1 =
            await ReferralTree.getReferralChain(otherUser3_1_1._id);
          const referralChain_otherUser3_1_2 =
            await ReferralTree.getReferralChain(otherUser3_1_2._id);
          const referralChain_otherUser3_1 =
            await ReferralTree.getReferralChain(otherUser3_1._id);
          const referralChain_otherUser3 = await ReferralTree.getReferralChain(
            otherUser3._id
          );

          expect(referralChain_otherUser3_1_1).to.have.a.lengthOf(2);
          expect(referralChain_otherUser3_1_2).to.have.a.lengthOf(2);
          expect(referralChain_otherUser3_1).to.have.a.lengthOf(1);
          expect(referralChain_otherUser3).to.have.a.lengthOf(0);
          console.log(referralChain_otherUser3_1_1);
          expect(referralChain_otherUser3_1_1).to.shallowDeepEqual([
            {
              level: 1,
              _id: otherUser3_1._id,
              parent: otherUser3._id,
              userData: {
                _id: otherUser3_1._id,
                username: "otherUser3_1",
                isPartyKing: true,
                isDeleted: false,
                referringTransactionsPushEnabled: true,
              },
            },
            {
              level: 2,
              _id: otherUser3._id,
              userData: {
                _id: otherUser3._id,
                username: "otherUser3",
                isPartyKing: true,
                isDeleted: false,
                referringTransactionsPushEnabled: true,
              },
              parent: null,
            },
          ]);
          // turn on push notifications
          console.log((await User.get(otherUser3_1_2._id)).settings);
          await User.patch(otherUser3_1_2._id, {
            "settings.notifications.referringTransactions": false,
          });

          // testing with user delettion
          await h.deleteUser(otherUser3_1, otherUser3_1);
          const referralChain_otherUser3_1_2_1 =
            await ReferralTree.getReferralChain(otherUser3_1_2_1._id);
          expect(referralChain_otherUser3_1_2_1).to.have.a.lengthOf(3);
          console.log(referralChain_otherUser3_1_2_1);

          console.log((await User.get(otherUser3_1_2._id)).settings);
          expect(referralChain_otherUser3_1_2_1).to.shallowDeepEqual([
            {
              _id: otherUser3_1_2._id,
              level: 1,
              parent: otherUser3_1._id,
              userData: {
                _id: otherUser3_1_2._id,
                username: "otherUser3_1_2",
                isPartyKing: true,
                isDeleted: false,
                referringTransactionsPushEnabled: false,
              },
            },
            {
              _id: otherUser3_1._id,
              level: 2,
              parent: otherUser3._id,
              userData: {
                _id: otherUser3_1._id,
                // was set to false because user deletion is temporary disabled
                isDeleted: false,
                referringTransactionsPushEnabled: true,
              },
            },
            {
              _id: otherUser3._id,
              level: 3,
              userData: {
                _id: otherUser3._id,
                username: "otherUser3",
                isPartyKing: true,
                isDeleted: false,
                referringTransactionsPushEnabled: true,
              },
              parent: null,
            },
          ]);

          // user changes its referralcode within 14 days:

          await h
            .patchUser(otherUser3_1_2, otherUser3_1_2, {
              referredBy: differentUser.referralCodes[0].code,
            })
            .expect(200);

          // check integrity
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1_1._id })
          ).to.have.a.lengthOf(0);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1_2._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: differentUser._id })
          ).to.have.a.lengthOf(1);
        });
        it("debug getReferralChain function", async function () {
          async function refer(referrer, referred) {
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const otherUser3 = await h.createUser({
            username: "xotherUser3",
            isPartyKing: true,
          });
          /**/ const otherUser3_1 = await h.createUser({
            username: "xotherUser3_1",
          });
          /*  */ const otherUser3_1_1 = await h.createUser({
            username: "xotherUser3_1_1",
          });
          /*  */ const otherUser3_1_2 = await h.createUser({
            username: "xotherUser3_1_2",
          });
          /*     */ const otherUser3_1_2_1 = await h.createUser({
            username: "xotherUser3_1_2_1",
          });

          await refer(otherUser3, otherUser3_1);
          await refer(otherUser3_1, otherUser3_1_1);
          await refer(otherUser3_1, otherUser3_1_2);
          await refer(otherUser3_1_2, otherUser3_1_2_1);

          const referralChain_otherUser3_1_1 =
            await ReferralTree.getReferralChain(otherUser3_1_1._id);
          const referralChain_otherUser3_1_2 =
            await ReferralTree.getReferralChain(otherUser3_1_2._id);
          const referralChain_otherUser3_1 =
            await ReferralTree.getReferralChain(otherUser3_1._id);
          const referralChain_otherUser3 = await ReferralTree.getReferralChain(
            otherUser3._id
          );

          console.log(referralChain_otherUser3_1_1);
          expect(referralChain_otherUser3_1_1).to.have.a.lengthOf(2);
          expect(referralChain_otherUser3_1_2).to.have.a.lengthOf(2);
          expect(referralChain_otherUser3_1).to.have.a.lengthOf(1);
          expect(referralChain_otherUser3).to.have.a.lengthOf(0);
          console.log(referralChain_otherUser3_1_1);
          expect(referralChain_otherUser3_1_1).to.shallowDeepEqual([
            {
              level: 1,
              userData: {
                _id: otherUser3_1._id,
                username: "xotherUser3_1",
                isPartyKing: false,
                isDeleted: false,
                referringTransactionsPushEnabled: true,
              },
            },
            {
              level: 2,
              userData: {
                _id: otherUser3._id,
                username: "xotherUser3",
                isPartyKing: true,
                isDeleted: false,
                referringTransactionsPushEnabled: true,
              },
              parent: null,
            },
          ]);
          // turn on push notifications
          await User.patch(otherUser3_1_2._id, {
            "settings.notifications.referringTransactions": false,
          });

          // testing with user delettion
          await h.deleteUser(otherUser3_1, otherUser3_1);
          const referralChain_otherUser3_1_2_1 =
            await ReferralTree.getReferralChain(otherUser3_1_2_1._id);
          expect(referralChain_otherUser3_1_2_1).to.have.a.lengthOf(3);
          console.log(referralChain_otherUser3_1_2_1);

          expect(referralChain_otherUser3_1_2_1).to.shallowDeepEqual([
            {
              level: 1,
              userData: {
                _id: otherUser3_1_2._id,
                username: "xotherUser3_1_2",
                isPartyKing: false,
                isDeleted: false,
                referringTransactionsPushEnabled: false,
              },
            },
            {
              level: 2,
              userData: {
                _id: otherUser3_1._id,
                // was set to false because user deletion is temporarily disabled
                isDeleted: false,
                referringTransactionsPushEnabled: true,
              },
            },
            {
              level: 3,
              userData: {
                _id: otherUser3._id,
                username: "xotherUser3",
                isPartyKing: true,
                isDeleted: false,
                referringTransactionsPushEnabled: true,
              },
              parent: null,
            },
          ]);
        });
        it("checking correct amount of referraltree entries for an abitrary referraltree when referralCode is updated", async function () {
          async function refer(referrer, referred) {
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const myUser = await h.createUser();
          /**/ const otherUser = await h.createUser();
          /*  */ const otherUser2 = await h.createUser();
          /*    */ const otherUser2_1 = await h.createUser();
          /*      */ const otherUser2_1_1 = await h.createUser();
          /*      */ const otherUser2_1_2 = await h.createUser();
          /*    */ const otherUser2_3 = await h.createUser();
          /*    */ const otherUser2_4 = await h.createUser();
          const otherUser3 = await h.createUser();
          /**/ const otherUser3_1 = await h.createUser();
          /*  */ const otherUser3_1_1 = await h.createUser();
          /*  */ const otherUser3_1_2 = await h.createUser();

          await refer(myUser, otherUser);
          await refer(otherUser, otherUser2);
          await refer(otherUser2, otherUser2_1);
          await refer(otherUser2_1, otherUser2_1_1);
          await refer(otherUser2_1, otherUser2_1_2);

          await refer(otherUser2, otherUser2_3);
          await refer(otherUser2, otherUser2_4);

          await refer(otherUser3, otherUser3_1);
          await refer(otherUser3_1, otherUser3_1_1);
          await refer(otherUser3_1, otherUser3_1_2);

          expect(
            await ReferralTree.MODEL.find({ parent: myUser._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser2_1._id })
          ).to.have.a.lengthOf(2);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser2_3._id })
          ).to.have.a.lengthOf(0);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser2_4._id })
          ).to.have.a.lengthOf(0);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3._id })
          ).to.have.a.lengthOf(1);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1._id })
          ).to.have.a.lengthOf(2);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1_1._id })
          ).to.have.a.lengthOf(0);
          expect(
            await ReferralTree.MODEL.find({ parent: otherUser3_1_2._id })
          ).to.have.a.lengthOf(0);
        });
        it("multi level referring, cannot refer a user if the user is in the referraltree above you", async function () {
          function refer(referrer, referred) {
            return h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const myUser = await h.createUser();
          /**/ const otherUser = await h.createUser();
          /*  */ const otherUser2 = await h.createUser();
          /*    */ const otherUser2_1 = await h.createUser();

          await refer(myUser, otherUser).expect(200);
          await refer(otherUser, otherUser2).expect(200);
          await refer(otherUser2, otherUser2_1).expect(200);

          await refer(otherUser2_1, myUser).expect(400);
        });
        it("multi level referring, if a user cannot be referred (e.g. user is superadmin), referredBy should not be set", async function () {
          function refer2(referrer, referred) {
            return h.patchUser(referrer, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const myUser = await h.createUser({ isPartyKing: true });
          const otherUser = await h.createUser({ isSuperAdmin: true });

          expect((await User.getRaw(otherUser._id)).referredBy).to.be.equal(
            null
          );
          await refer2(myUser, otherUser).expect(400);
          expect((await User.getRaw(otherUser._id)).referredBy).to.be.equal(
            null
          );
        });
        it("referredUserCreditMLM and referredByAUserCredit Transactions are correctly created when a user is referred; Referrer gets no referredUserDebitMLM because he is the root of the referralTree", async function () {
          async function refer(referrer, referred) {
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const myUser = await h.createUser();
          const otherUser = await h.createUser();
          expect(myUser.referralCodes).to.have.a.lengthOf(1);
          expect(myUser.referredBy).to.be.null;

          await refer(myUser, otherUser);
          expect((await User.get(otherUser._id)).referredBy).to.equal(
            myUser.referralCodes[0].code
          );
          console.log(`${myUser._id} referred ${otherUser._id}`);
          const myUserTransactions = await Transaction.MODEL.find({
            user: myUser._id,
          });
          const otherUserTransactions = await Transaction.MODEL.find({
            user: otherUser._id,
          });

          expect(myUserTransactions).to.have.a.lengthOf(1);
          expect(otherUserTransactions).to.have.a.lengthOf(1);
          expect(myUserTransactions[0].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[0].type).to.be.equal(
            "referredByAUserCredit"
          );
          expect(myUserTransactions[0].amount).to.be.equal(500);
          expect(otherUserTransactions[0].amount).to.be.equal(500);
        });
        it("check transactions types and correct amount for complex referraltree when all users are partykings", async function () {
          async function refer(referrer, referred) {
            console.log(`${referrer._id} referred ${referred._id}`);
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const myUser = await h.createUser({ isPartyKing: true });
          const otherUser = await h.createUser({ isPartyKing: true });
          const otherUser2 = await h.createUser({ isPartyKing: true });
          const otherUser3 = await h.createUser({ isPartyKing: true });
          const otherUser4 = await h.createUser({ isPartyKing: true });
          const otherUser5 = await h.createUser({ isPartyKing: true });
          const otherUser6 = await h.createUser({ isPartyKing: true });
          const otherUser7 = await h.createUser({ isPartyKing: true });

          await refer(myUser, otherUser);
          await refer(otherUser, otherUser2);
          await refer(otherUser2, otherUser3);
          await refer(otherUser3, otherUser4);
          await refer(otherUser4, otherUser5);
          await refer(otherUser5, otherUser6);
          await refer(otherUser6, otherUser7);
          expect((await User.get(otherUser._id)).referredBy).to.equal(
            myUser.referralCodes[0].code
          );
          expect((await User.get(otherUser2._id)).referredBy).to.equal(
            otherUser.referralCodes[0].code
          );

          const myUserTransactions = await Transaction.MODEL.find({
            user: myUser._id,
          });
          expect(myUserTransactions).to.have.a.lengthOf(7);
          expect(myUserTransactions[0].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[1].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[2].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[3].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[4].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[5].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[6].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[0].amount).to.be.equal(500);
          expect(myUserTransactions[1].amount).to.be.equal(150);
          expect(myUserTransactions[2].amount).to.be.equal(45);
          expect(myUserTransactions[3].amount).to.be.equal(13.5);
          expect(myUserTransactions[4].amount).to.be.equal(4.05);
          expect(myUserTransactions[5].amount).to.be.equal(1.215);
          expect(myUserTransactions[6].amount).to.be.equal(0.3645);

          const otherUserTransactions = await Transaction.MODEL.find({
            user: otherUser._id,
          });
          expect(otherUserTransactions).to.have.a.lengthOf(13);
          expect(otherUserTransactions[0].type).to.be.equal(
            "referredByAUserCredit"
          );
          expect(otherUserTransactions[1].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[0].amount).to.be.equal(500);
          expect(otherUserTransactions[1].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[2].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[3].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[4].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[5].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[6].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[7].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[8].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[9].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[10].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[11].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[12].type).to.be.equal(
            "referredUserDebitMLM"
          );

          // credit
          expect(otherUserTransactions[1].amount).to.be.equal(500);
          expect(otherUserTransactions[3].amount).to.be.equal(150);
          expect(otherUserTransactions[5].amount).to.be.equal(45);
          expect(otherUserTransactions[7].amount).to.be.equal(13.5);
          expect(otherUserTransactions[9].amount).to.be.equal(4.05);
          expect(otherUserTransactions[11].amount).to.be.equal(1.215);

          // debit
          expect(otherUserTransactions[2].amount).to.be.equal(-150);
          expect(otherUserTransactions[4].amount).to.be.equal(-45);
          expect(otherUserTransactions[6].amount).to.be.equal(-13.5);
          expect(otherUserTransactions[8].amount).to.be.equal(-4.05);
          expect(otherUserTransactions[10].amount).to.be.equal(-1.215);
          expect(otherUserTransactions[12].amount).to.be.equal(-0.3645);
          const otherUser2Transactions = await Transaction.MODEL.find({
            user: otherUser2._id,
          });
        });
        it("check transactions types and correct amount for complex referraltree when all users are not partykings", async function () {
          async function refer(referrer, referred) {
            console.log(`${referrer._id} referred ${referred._id}`);
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const adminUser = await h.createUser({ isSuperAdmin: true });
          console.log(adminUser);
          await h
            .putPartyPointsConfig(adminUser, {
              invites: { friends: 0, partyKing: 6, noPartyKing: 8 },
              createAdditionalParties: { partyKing: 75, noPartyKing: 100 },
              broadcastMessage: 1,
              referral: {
                referredUser: 500 /* default:500, changed *2 */,
                referrer: 500 /* default:500, changed*3 */,
              },
            })
            .expect(200);
          const myUser = await h.createUser({
            isPartyKing: false,
            username: "0",
          });
          const otherUser = await h.createUser({
            isPartyKing: false,
            username: "1",
          });
          const otherUser2 = await h.createUser({
            isPartyKing: false,
            username: "2",
          });
          const otherUser3 = await h.createUser({
            isPartyKing: false,
            username: "3",
          });
          const otherUser4 = await h.createUser({
            isPartyKing: false,
            username: "4",
          });
          const otherUser5 = await h.createUser({
            isPartyKing: false,
            username: "5",
          });
          const otherUser6 = await h.createUser({
            isPartyKing: false,
            username: "6",
          });
          const otherUser7 = await h.createUser({
            isPartyKing: false,
            username: "7",
          });

          await refer(myUser, otherUser);
          await refer(otherUser, otherUser2);
          await refer(otherUser2, otherUser3);
          await refer(otherUser3, otherUser4);
          await refer(otherUser4, otherUser5);
          await refer(otherUser5, otherUser6);
          await refer(otherUser6, otherUser7);
          console.log(await ReferralTree.getReferralChain(otherUser7));
          expect((await User.get(otherUser._id)).referredBy).to.equal(
            myUser.referralCodes[0].code
          );
          expect((await User.get(otherUser2._id)).referredBy).to.equal(
            otherUser.referralCodes[0].code
          );

          const myUserTransactions = await Transaction.MODEL.find({
            user: myUser._id,
          });
          console.log(myUserTransactions);
          expect(myUserTransactions).to.have.a.lengthOf(7);
          expect(myUserTransactions[0].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[1].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[2].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[3].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[4].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[5].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[6].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(myUserTransactions[0].amount).to.be.equal(500);
          expect(myUserTransactions[1].amount).to.be.equal(150);
          expect(myUserTransactions[2].amount).to.be.equal(45);
          expect(myUserTransactions[3].amount).to.be.equal(13.5);
          expect(myUserTransactions[4].amount).to.be.equal(4.05);
          expect(myUserTransactions[5].amount).to.be.equal(1.215);
          expect(myUserTransactions[6].amount).to.be.equal(0.3645);

          const otherUserTransactions = await Transaction.MODEL.find({
            user: otherUser._id,
          });
          expect(otherUserTransactions).to.have.a.lengthOf(13);
          expect(otherUserTransactions[0].type).to.be.equal(
            "referredByAUserCredit"
          );
          expect(otherUserTransactions[1].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[0].amount).to.be.equal(500);
          expect(otherUserTransactions[1].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[2].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[3].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[4].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[5].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[6].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[7].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[8].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[9].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[10].type).to.be.equal(
            "referredUserDebitMLM"
          );
          expect(otherUserTransactions[11].type).to.be.equal(
            "referredUserCreditMLM"
          );
          expect(otherUserTransactions[12].type).to.be.equal(
            "referredUserDebitMLM"
          );

          // credit
          expect(otherUserTransactions[1].amount).to.be.equal(500);
          expect(otherUserTransactions[3].amount).to.be.equal(150);
          expect(otherUserTransactions[5].amount).to.be.equal(45);
          expect(otherUserTransactions[7].amount).to.be.equal(13.5);
          expect(otherUserTransactions[9].amount).to.be.equal(4.05);
          expect(otherUserTransactions[11].amount).to.be.equal(1.215);

          // debit
          expect(otherUserTransactions[2].amount).to.be.equal(
            parseFloat((-150 * 0.9).toFixed(8))
          );
          expect(otherUserTransactions[4].amount).to.be.equal(
            parseFloat((-45 * 0.9).toFixed(8))
          );

          expect(otherUserTransactions[6].amount).to.be.equal(
            parseFloat((-13.5 * 0.9).toFixed(8))
          );

          expect(otherUserTransactions[8].amount).to.be.equal(
            parseFloat((-4.05 * 0.9).toFixed(8))
          );

          expect(otherUserTransactions[10].amount).to.be.equal(
            parseFloat((-1.215 * 0.9).toFixed(8))
          );

          expect(otherUserTransactions[12].amount).to.be.equal(
            parseFloat((-0.3645 * 0.9).toFixed(8))
          );
        });
        const MLM_PP_FOR_LEVELS = [
          500, 150, 45, 13.5, 4.05, 1.215, 0.3645, 0.10935, 0.032805, 0.0098415,
          0.00295245, 0.000885735, 0.0002657205, 0.00007971615, 0.000023914845,
        ];
        const CALC_DEBIT = (level, isPartyKing = false) => {
          return parseFloat(
            (
              -1 *
              MLM_PP_FOR_LEVELS[level /* not -1 */] *
              (isPartyKing ? 1 : 0.9)
            ).toFixed(8)
          );
        };
        const CALC_CREDIT = (level) => {
          return parseFloat(MLM_PP_FOR_LEVELS[level - 1].toFixed(8));
        };
        it("check transactions types and correct amount for complex referraltree when some users are partykings + check partyPoints balance for multiple users in the chain", async function () {
          async function refer(referrer, referred) {
            console.log(`${referrer._id} referred ${referred._id}`);
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }

          const myUser = await h.createUser({ isPartyKing: true });
          const otherUser = await h.createUser({ isPartyKing: true });
          const otherUser2 = await h.createUser({ isPartyKing: false });
          const otherUser3 = await h.createUser({ isPartyKing: false });
          const otherUser4 = await h.createUser({ isPartyKing: true });
          const otherUser5 = await h.createUser({ isPartyKing: false });
          const otherUser6 = await h.createUser({ isPartyKing: false });
          const otherUser7 = await h.createUser({ isPartyKing: true });

          await refer(myUser, otherUser);

          let myUserCreditTransactions = await Transaction.MODEL.find({
            user: myUser._id,
            type: "referredUserCreditMLM",
          });

          expect(myUserCreditTransactions).to.have.a.lengthOf(1);
          expect(myUserCreditTransactions[0].amount).to.be.equal(
            CALC_CREDIT(1)
          );
          expect(myUserCreditTransactions[0].data.level).to.be.equal(1);

          let myUserDebitTransactions = await Transaction.MODEL.find({
            user: myUser._id,
            type: "referredUserDebitMLM",
          });
          // myUser has no debit transaction because he was not referred by another user
          expect(myUserDebitTransactions).to.have.a.lengthOf(0);

          await refer(otherUser, otherUser2);
          await refer(otherUser2, otherUser3);
          await refer(otherUser3, otherUser4);
          await refer(otherUser4, otherUser5);
          await refer(otherUser5, otherUser6);
          await refer(otherUser6, otherUser7);

          myUserCreditTransactions = await Transaction.MODEL.find({
            user: myUser._id,
            type: "referredUserCreditMLM",
          });
          expect(myUserCreditTransactions).to.have.a.lengthOf(7);
          expect(myUserCreditTransactions[0].amount).to.be.equal(
            CALC_CREDIT(1)
          );
          expect(myUserCreditTransactions[0].data.level).to.be.equal(1);
          myUserDebitTransactions = await Transaction.MODEL.find({
            user: myUser._id,
            type: "referredUserDebitMLM",
          });
          // myUser has no debit transaction because he was not referred by another user
          expect(myUserDebitTransactions).to.have.a.lengthOf(0);

          function checkDebitTrx(trx, level, isPartyKing) {
            expect(trx.amount).to.be.equal(CALC_DEBIT(level, isPartyKing));
            expect(trx.data.level).to.be.equal(level);
          }
          // otherUser should have 6 debit transactions because myUser has referred him
          const otherUserDebitTransactions = await Transaction.MODEL.find({
            user: otherUser._id,
            type: "referredUserDebitMLM",
          });
          expect(otherUserDebitTransactions).to.have.a.lengthOf(6);
          checkDebitTrx(otherUserDebitTransactions[0], 1, true);
          checkDebitTrx(otherUserDebitTransactions[1], 2, true);
          checkDebitTrx(otherUserDebitTransactions[2], 3, true);
          checkDebitTrx(otherUserDebitTransactions[3], 4, true);
          checkDebitTrx(otherUserDebitTransactions[4], 5, true);
          checkDebitTrx(otherUserDebitTransactions[5], 6, true);

          // otherUser3 should have 4 debit transactions because otherUser2 has referred him
          const otherUser3DebitTransactions = await Transaction.MODEL.find({
            user: otherUser3._id,
            type: "referredUserDebitMLM",
          });
          expect(otherUser3DebitTransactions).to.have.a.lengthOf(4);
          checkDebitTrx(otherUser3DebitTransactions[0], 1, false);
          checkDebitTrx(otherUser3DebitTransactions[1], 2, false);
          checkDebitTrx(otherUser3DebitTransactions[2], 3, false);
          checkDebitTrx(otherUser3DebitTransactions[3], 4, false);

          function checkCreditTrx(trx, level) {
            expect(trx.amount).to.be.equal(CALC_CREDIT(level));
            expect(trx.data.level).to.be.equal(level);
          }
          // otherUser should have 7 credit transactions
          myUserCreditTransactions = await Transaction.MODEL.find({
            user: myUser._id,
            type: "referredUserCreditMLM",
          });
          expect(myUserCreditTransactions).to.have.a.lengthOf(7);
          checkCreditTrx(myUserCreditTransactions[0], 1);
          checkCreditTrx(myUserCreditTransactions[1], 2);
          checkCreditTrx(myUserCreditTransactions[2], 3);
          checkCreditTrx(myUserCreditTransactions[3], 4);
          checkCreditTrx(myUserCreditTransactions[4], 5);
          checkCreditTrx(myUserCreditTransactions[5], 6);
          checkCreditTrx(myUserCreditTransactions[6], 7);

          // otherUser6 should have 1 credit transactions
          const otherUser6CreditTransactions = await Transaction.MODEL.find({
            user: otherUser6._id,
            type: "referredUserCreditMLM",
          });
          expect(otherUser6CreditTransactions).to.have.a.lengthOf(1);
          checkCreditTrx(otherUser6CreditTransactions[0], 1);

          // otherUser7 should have no credit transactions
          const otherUser7CreditTransactions = await Transaction.MODEL.find({
            user: otherUser7._id,
            type: "referredUserCreditMLM",
          });
          expect(otherUser7CreditTransactions).to.have.a.lengthOf(0);

          const myUserPPBefore = myUser.partyPoints;
          const myUserPPAfter = (await User.getRaw(myUser._id)).partyPoints;
          expect(myUserPPAfter - myUserPPBefore).to.be.approximately(
            CALC_CREDIT(1) +
              CALC_CREDIT(2) +
              CALC_CREDIT(3) +
              CALC_CREDIT(4) +
              CALC_CREDIT(5) +
              CALC_CREDIT(6) +
              CALC_CREDIT(7),
            // No debit because he is at the top of the tree
            0.000000001
          );

          const otherUserPPBefore = otherUser.partyPoints;
          const otherUserPPAfter = (await User.getRaw(otherUser._id))
            .partyPoints;

          expect(otherUserPPAfter - otherUserPPBefore).to.be.approximately(
            500 + // credit for signup
              CALC_CREDIT(1) +
              CALC_CREDIT(2) +
              CALC_CREDIT(3) +
              CALC_CREDIT(4) +
              CALC_CREDIT(5) +
              CALC_CREDIT(6) +
              // debit
              CALC_DEBIT(1, true) +
              CALC_DEBIT(2, true) +
              CALC_DEBIT(3, true) +
              CALC_DEBIT(4, true) +
              CALC_DEBIT(5, true) +
              CALC_DEBIT(6, true),
            0.000000001
          );

          const otherUser2PPBefore = otherUser2.partyPoints;
          const otherUser2PPAfter = (await User.getRaw(otherUser2._id))
            .partyPoints;

          expect(otherUser2PPAfter - otherUser2PPBefore).to.be.approximately(
            500 + // credit for signup
              CALC_CREDIT(1) +
              CALC_CREDIT(2) +
              CALC_CREDIT(3) +
              CALC_CREDIT(4) +
              CALC_CREDIT(5) +
              // debit
              CALC_DEBIT(1, false) +
              CALC_DEBIT(2, false) +
              CALC_DEBIT(3, false) +
              CALC_DEBIT(4, false) +
              CALC_DEBIT(5, false),
            0.000000001
          );
        });
        it("check correct amount for transaction when partyPoints config is updated in complex referraltree when some users are partykings + check partyPoints balance for multiple users in the chain", async function () {
          async function refer(referrer, referred) {
            console.log(`${referrer._id} referred ${referred._id}`);
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const adminUser = await h.createUser({ isSuperAdmin: true });
          console.log(adminUser);
          await h
            .putPartyPointsConfig(adminUser, {
              invites: { friends: 0, partyKing: 6, noPartyKing: 8 },
              createAdditionalParties: { partyKing: 75, noPartyKing: 100 },
              broadcastMessage: 1,
              referral: {
                referredUser: 1000 /* default:500, changed *2 */,
                referrer: 1500 /* default:500, changed*3 */,
              },
            })
            .expect(200);

          const myUser = await h.createUser({ isPartyKing: true });
          const otherUser = await h.createUser({ isPartyKing: true });
          const otherUser2 = await h.createUser({ isPartyKing: false });
          const otherUser3 = await h.createUser({ isPartyKing: false });
          const otherUser4 = await h.createUser({ isPartyKing: true });
          const otherUser5 = await h.createUser({ isPartyKing: false });
          const otherUser6 = await h.createUser({ isPartyKing: false });
          const otherUser7 = await h.createUser({ isPartyKing: true });

          await refer(myUser, otherUser);
          await refer(otherUser, otherUser2);
          await refer(otherUser2, otherUser3);
          await refer(otherUser3, otherUser4);
          await refer(otherUser4, otherUser5);
          await refer(otherUser5, otherUser6);
          await refer(otherUser6, otherUser7);

          const otherUser2PPBefore = otherUser2.partyPoints;
          const otherUser2PPAfter = (await User.getRaw(otherUser2._id))
            .partyPoints;

          expect(otherUser2PPAfter - otherUser2PPBefore).to.be.approximately(
            500 * 2 + // credit for signup
              CALC_CREDIT(1) * 3 +
              CALC_CREDIT(2) * 3 +
              CALC_CREDIT(3) * 3 +
              CALC_CREDIT(4) * 3 +
              CALC_CREDIT(5) * 3 +
              // debit
              CALC_DEBIT(1, false) * 3 +
              CALC_DEBIT(2, false) * 3 +
              CALC_DEBIT(3, false) * 3 +
              CALC_DEBIT(4, false) * 3 +
              CALC_DEBIT(5, false) * 3,
            0.000000001
          );
          // reset config
          await h
            .putPartyPointsConfig(adminUser, {
              invites: { friends: 0, partyKing: 6, noPartyKing: 8 },
              createAdditionalParties: { partyKing: 75, noPartyKing: 100 },
              broadcastMessage: 1,
              referral: {
                referredUser: 500,
                referrer: 500,
              },
            })
            .expect(200);
        });
        it("check correct amount for transactions when partyPoints.referredUser is set to 0, then check partyPoints balance for multiple users in the chain", async function () {
          async function refer(referrer, referred) {
            console.log(`${referrer._id} referred ${referred._id}`);
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const adminUser = await h.createUser({ isSuperAdmin: true });
          console.log(adminUser);
          await h
            .putPartyPointsConfig(adminUser, {
              invites: { friends: 0, partyKing: 6, noPartyKing: 8 },
              createAdditionalParties: { partyKing: 75, noPartyKing: 100 },
              broadcastMessage: 1,
              referral: {
                referredUser: 0 /* default:500, changed *2 */,
                referrer: 500 /* default:500, changed*3 */,
              },
            })
            .expect(200);

          const myUser = await h.createUser({ isPartyKing: true });
          const otherUser = await h.createUser({ isPartyKing: true });
          const otherUser2 = await h.createUser({ isPartyKing: false });
          const otherUser3 = await h.createUser({ isPartyKing: false });
          const otherUser4 = await h.createUser({ isPartyKing: true });
          const otherUser5 = await h.createUser({ isPartyKing: false });
          const otherUser6 = await h.createUser({ isPartyKing: false });
          const otherUser7 = await h.createUser({ isPartyKing: true });

          await refer(myUser, otherUser);
          await refer(otherUser, otherUser2);
          await refer(otherUser2, otherUser3);
          await refer(otherUser3, otherUser4);
          await refer(otherUser4, otherUser5);
          await refer(otherUser5, otherUser6);
          await refer(otherUser6, otherUser7);

          const otherUser2PPBefore = otherUser2.partyPoints;
          const otherUser2PPAfter = (await User.getRaw(otherUser2._id))
            .partyPoints;

          expect(otherUser2PPAfter - otherUser2PPBefore).to.be.approximately(
            500 * 0 + // credit for signup
              CALC_CREDIT(1) +
              CALC_CREDIT(2) +
              CALC_CREDIT(3) +
              CALC_CREDIT(4) +
              CALC_CREDIT(5) +
              // debit
              CALC_DEBIT(1, false) +
              CALC_DEBIT(2, false) +
              CALC_DEBIT(3, false) +
              CALC_DEBIT(4, false) +
              CALC_DEBIT(5, false),
            0.000000001
          );

          // reset config
          await h
            .putPartyPointsConfig(adminUser, {
              invites: { friends: 0, partyKing: 6, noPartyKing: 8 },
              createAdditionalParties: { partyKing: 75, noPartyKing: 100 },
              broadcastMessage: 1,
              referral: {
                referredUser: 500,
                referrer: 500,
              },
            })
            .expect(200);
        });
        it("check correct amount for transactions when partyPoints.referrer is set to 0, then check partyPoints balance for multiple users in the chain", async function () {
          async function refer(referrer, referred) {
            console.log(`${referrer._id} referred ${referred._id}`);
            return await h.patchUser(referred, referred, {
              referredBy: referrer.referralCodes[0].code,
            });
          }
          const adminUser = await h.createUser({ isSuperAdmin: true });
          console.log(adminUser);
          await h
            .putPartyPointsConfig(adminUser, {
              invites: { friends: 0, partyKing: 6, noPartyKing: 8 },
              createAdditionalParties: { partyKing: 75, noPartyKing: 100 },
              broadcastMessage: 1,
              referral: {
                referredUser: 500 /* default:500, changed *2 */,
                referrer: 0 /* default:500, changed*0 */,
              },
            })
            .expect(200);

          const myUser = await h.createUser({ isPartyKing: true });
          const otherUser = await h.createUser({ isPartyKing: true });
          const otherUser2 = await h.createUser({ isPartyKing: false });
          const otherUser3 = await h.createUser({ isPartyKing: false });
          const otherUser4 = await h.createUser({ isPartyKing: true });
          const otherUser5 = await h.createUser({ isPartyKing: false });
          const otherUser6 = await h.createUser({ isPartyKing: false });
          const otherUser7 = await h.createUser({ isPartyKing: true });

          await refer(myUser, otherUser);
          await refer(otherUser, otherUser2);
          await refer(otherUser2, otherUser3);
          await refer(otherUser3, otherUser4);
          await refer(otherUser4, otherUser5);
          await refer(otherUser5, otherUser6);
          await refer(otherUser6, otherUser7);

          const otherUser2PPBefore = otherUser2.partyPoints;
          const otherUser2PPAfter = (await User.getRaw(otherUser2._id))
            .partyPoints;

          expect(otherUser2PPAfter - otherUser2PPBefore).to.be.approximately(
            500 * 1 + // credit for signup
              CALC_CREDIT(1) * 0 +
              CALC_CREDIT(2) * 0 +
              CALC_CREDIT(3) * 0 +
              CALC_CREDIT(4) * 0 +
              CALC_CREDIT(5) * 0 +
              // debit
              CALC_DEBIT(1, false) * 0 +
              CALC_DEBIT(2, false) * 0 +
              CALC_DEBIT(3, false) * 0 +
              CALC_DEBIT(4, false) * 0 +
              CALC_DEBIT(5, false) * 0,
            0.000000001
          );
          // reset config
          await h
            .putPartyPointsConfig(adminUser, {
              invites: { friends: 0, partyKing: 6, noPartyKing: 8 },
              createAdditionalParties: { partyKing: 75, noPartyKing: 100 },
              broadcastMessage: 1,
              referral: {
                referredUser: 500,
                referrer: 500,
              },
            })
            .expect(200);
        });
        it("superadmin cannot be referred", async function () {
          const myUser = await h.createUser();
          const otherUser = await h.createUser();
          const otherUser2 = await h.createUser({ isSuperAdmin: true });

          await refer(myUser, otherUser).expect(200);
          await refer(otherUser, otherUser2).expect(400);

          expect(
            await Transaction.MODEL.find({ user: otherUser2._id })
          ).to.have.a.lengthOf(0);
          expect(
            await Transaction.MODEL.find({ user: otherUser._id })
          ).to.have.a.lengthOf(1);
        });
        it("Referraltree.userData gets updated when user changes username", async function () {
          const myUser = await h.createUser();
          const otherUser = await h.createUser();
          /**/ const otherUser2 = await h.createUser();
          /**/ const otherUser3 = await h.createUser();

          await refer(myUser, otherUser);
          /**/ await refer(otherUser, otherUser2);
          /**/ await refer(otherUser, otherUser3);

          let otherUserReferralTreeEntry = await ReferralTree.MODEL.find({
            _id: otherUser._id,
          });
          for (const entry of otherUserReferralTreeEntry) {
            expect(entry.userData.username).to.be.equal(otherUser.username);
            expect(entry.userData._id.toString()).to.be.equal(
              otherUser._id.toString()
            );
          }
          await h
            .patchUser(otherUser, otherUser, { username: "bobmarley421" })
            .expect(200);
          otherUserReferralTreeEntry = await ReferralTree.MODEL.find({
            _id: otherUser._id,
          });
          expect(otherUserReferralTreeEntry).to.have.a.lengthOf(1);
          for (const entry of otherUserReferralTreeEntry) {
            expect(entry.userData.username).to.be.equal("bobmarley421");
            expect(entry.userData._id.toString()).to.be.equal(
              otherUser._id.toString()
            );
          }
        });
        it("Referraltree.userData gets updated when user changes profilePicture", async function () {
          const myUser = await h.createUser();
          const otherUser = await h.createUser();
          /**/ const otherUser2 = await h.createUser();
          /**/ const otherUser3 = await h.createUser();

          const pic = await h.uploadProfilePic(otherUser);
          await h.setProfilePicture(otherUser, pic).expect(200);

          await refer(myUser, otherUser);
          /**/ await refer(otherUser, otherUser2);
          /**/ await refer(otherUser, otherUser3);

          let otherUserReferralTreeEntry = await ReferralTree.MODEL.find({
            _id: otherUser._id,
          });
          for (const entry of otherUserReferralTreeEntry) {
            expect(entry.userData.profilePicture.toString()).to.be.equal(
              pic._id.toString()
            );
            expect(entry.userData._id.toString()).to.be.equal(
              otherUser._id.toString()
            );
          }
          const pic2 = await h.uploadProfilePic(otherUser);
          await h.setProfilePicture(otherUser, pic2).expect(200);
          otherUserReferralTreeEntry = await ReferralTree.MODEL.find({
            _id: otherUser._id,
          });
          expect(otherUserReferralTreeEntry).to.have.a.lengthOf(1);
          for (const entry of otherUserReferralTreeEntry) {
            expect(entry.userData.profilePicture.toString()).to.be.equal(
              pic2._id.toString()
            );
            expect(entry.userData._id.toString()).to.be.equal(
              otherUser._id.toString()
            );
          }
        });
        it("check referredCount calculation", async function () {
          const myUser = await h.createUser();
          /**/ const otherUser = await h.createUser();
          /*  */ const otherUser2 = await h.createUser();
          /*  */ const otherUser3 = await h.createUser();
          /*  */ const otherUser4 = await h.createUser();

          await refer(myUser, otherUser);
          /**/ await refer(otherUser, otherUser2);
          /**/ await refer(otherUser, otherUser3);
          /**/ await refer(otherUser, otherUser4);
          async function getMemberCount(user) {
            return (await ReferralTree.get(user)).memberCount;
          }
          expect(await getMemberCount(myUser)).to.be.equal(4);
          expect(await getMemberCount(otherUser)).to.be.equal(3);
          expect(await getMemberCount(otherUser2)).to.be.equal(0);
          expect(await getMemberCount(otherUser3)).to.be.equal(0);
          expect(await getMemberCount(otherUser4)).to.be.equal(0);
        });
        it("check referredCount calculation when user changes its referralCode", async function () {
          const differentUser = await h.createUser({
            username: "ydifferentUser",
          });
          const myUser = await h.createUser({ username: "ymyUser" });
          /**/ const otherUser = await h.createUser({ username: "yotherUser" });
          /*  */ const otherUser2 = await h.createUser({
            username: "yotherUser2",
          });
          /*    */ const otherUser2_1 = await h.createUser({
            username: "yotherUser2_1",
          });
          /*  */ const otherUser3 = await h.createUser({
            username: "yotherUser3",
          });
          /*  */ const otherUser4 = await h.createUser({
            username: "yotherUser4",
          });

          await refer(myUser, otherUser);
          /**/ await refer(otherUser, otherUser2);
          /*  */ await refer(otherUser2, otherUser2_1);
          /**/ await refer(otherUser, otherUser3);
          /**/ await refer(otherUser, otherUser4);
          async function getMemberCount(user) {
            return (await ReferralTree.get(user._id)).memberCount;
          }
          expect(await getMemberCount(myUser)).to.be.equal(5);
          expect(await getMemberCount(otherUser)).to.be.equal(4);
          expect(await getMemberCount(otherUser2)).to.be.equal(1);
          expect(await getMemberCount(otherUser2_1)).to.be.equal(0);
          expect(await getMemberCount(otherUser3)).to.be.equal(0);
          expect(await getMemberCount(otherUser4)).to.be.equal(0);

          // dirty fix, sorry
          await User.MODEL.updateOne(
            { _id: otherUser2._id },
            {
              $set: {
                referredByEditableUntil: new Date(new Date().getTime() + 10000),
              },
            }
          );
          // user changes its referralcode to code from differentUser
          await h
            .patchUser(otherUser2, otherUser2, {
              referredBy: differentUser.referralCodes[0].code,
            })
            .expect(200);

          console.log(differentUser._id);
          expect(await getMemberCount(differentUser)).to.be.equal(2);
          expect(await getMemberCount(myUser)).to.be.equal(3);
          expect(await getMemberCount(otherUser)).to.be.equal(2);
          expect(await getMemberCount(otherUser2)).to.be.equal(1);
          expect(await getMemberCount(otherUser2_1)).to.be.equal(0);
          expect(await getMemberCount(otherUser3)).to.be.equal(0);
          expect(await getMemberCount(otherUser4)).to.be.equal(0);
        });
        it("check levelCount calculation", async function () {
          this.timeout(5000);
          const myUser = await h.createUser();
          /**/ const otherUser = await h.createUser();
          /*  */ const otherUser2 = await h.createUser();
          /*  */ const otherUser3 = await h.createUser();
          /*  */ const otherUser4 = await h.createUser();
          /*     */ const otherUser5 = await h.createUser();

          await refer(myUser, otherUser);
          /**/ await refer(otherUser, otherUser2);
          /**/ await refer(otherUser, otherUser3);
          /**/ await refer(otherUser, otherUser4);
          /*    */ await refer(otherUser4, otherUser5);
          async function getLevelCount(user) {
            return (await ReferralTree.get(user)).levelCount;
          }
          await ReferralTree.recalculateLevelCountsAndUpdate();
          expect(await getLevelCount(myUser)).to.be.equal(3);
          expect(await getLevelCount(otherUser)).to.be.equal(2);
          expect(await getLevelCount(otherUser2)).to.be.equal(0);
          expect(await getLevelCount(otherUser3)).to.be.equal(0);
          expect(await getLevelCount(otherUser4)).to.be.equal(1);
          expect(await getLevelCount(otherUser5)).to.be.equal(0);
        });
        it("check levelCount calculation when user changes its referralCode; levelCount should be unchanged", async function () {
          this.timeout(5000);
          const differentUser = await h.createUser({ isPartyKing: true });
          const myUser = await h.createUser({});
          /**/ const otherUser = await h.createUser({ isPartyKing: true });
          /*  */ const otherUser1 = await h.createUser({});
          /*    */ const otherUser1_2 = await h.createUser({});
          /*        */ const otherUser1_2_1 = await h.createUser({});
          /*  */ const otherUser2 = await h.createUser({});
          /*    */ const otherUser2_1 = await h.createUser({});
          /*  */ const otherUser3 = await h.createUser({});
          /*  */ const otherUser4 = await h.createUser({});

          await refer(myUser, otherUser);
          /**/ await refer(otherUser, otherUser1);
          /**/ //await refer(otherUser, otherUser2);
          await h
            .patchUser(otherUser, otherUser2, {
              referredBy: otherUser.referralCodes[0].code,
            })
            .expect(200);
          /**/ await refer(otherUser, otherUser3);
          /**/ await refer(otherUser, otherUser4);
          /*  */ await refer(otherUser1, otherUser1_2);
          /*     */ await refer(otherUser1_2, otherUser1_2_1);

          /*  */ await refer(otherUser2, otherUser2_1);

          async function getLevelCount(user) {
            return (await ReferralTree.get(user)).levelCount;
          }
          await ReferralTree.recalculateLevelCountsAndUpdate();
          expect(await getLevelCount(myUser)).to.be.equal(4);
          expect(await getLevelCount(otherUser)).to.be.equal(3);
          expect(await getLevelCount(otherUser2)).to.be.equal(1);
          expect(await getLevelCount(otherUser2_1)).to.be.equal(0);
          expect(await getLevelCount(otherUser3)).to.be.equal(0);
          expect(await getLevelCount(otherUser4)).to.be.equal(0);

          // differentUser refers otherUser2
          await h
            .patchUser(otherUser2, otherUser2, {
              referredBy: differentUser.referralCodes[0].code,
            })
            .expect(200);

          await ReferralTree.recalculateLevelCountsAndUpdate();

          console.log(differentUser._id);
          expect(await getLevelCount(differentUser)).to.be.equal(2);
          expect(await getLevelCount(myUser)).to.be.equal(4);
          expect(await getLevelCount(otherUser)).to.be.equal(3);
          expect(await getLevelCount(otherUser2)).to.be.equal(1);
          expect(await getLevelCount(otherUser2_1)).to.be.equal(0);
          expect(await getLevelCount(otherUser3)).to.be.equal(0);
          expect(await getLevelCount(otherUser4)).to.be.equal(0);
        });
      });
    });
  });
});

after(async function () {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
