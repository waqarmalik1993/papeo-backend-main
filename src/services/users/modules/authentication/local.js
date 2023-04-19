const PhoneNumber = require("awesome-phonenumber");
const twilio = require("twilio");
const PAPEO_ERRORS =
  require("../../../../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../../../../modules/errors/errors.js").papeoError;
const usersService = require("../../usersService.js");
const validate = require("../../../../modules/validation/validate.js");
const UserSchema =
  require("../../../../modules/validation/users.js").UserSchema;
const emailVerificationService = require("../../../emailVerification/emailVerificationService.js");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioServiceSID = "VA4a4a322cfcfdbb84a09201d2c09fc851";
const client = process.env.TEST ? null : twilio(accountSid, authToken);
const RateLimit = require("../../../rateLimiting/rateLimitingService");
const RateLimitPerDay = require("../../../rateLimiting/rateLimitingPerDayService");
const User = require("../../../users/usersService");

const localAuthentication = async (req) => {
  const data = req.body;
  const userIP = req.header("x-forwarded-for");
  if (data?.verificationCode) {
    validate(UserSchema.localAuthenticationVerification.POST, data);
  } else {
    validate(UserSchema.localAuthentication.POST, data);
  }

  data.phoneNumber = validatePhoneNumber(data.phoneNumber);
  const countryCode = getLanguage(data.countryCode);
  const { channel, verificationCode } = data;

  const user = await usersService.getByOneAttributeRaw(
    "phoneNumber",
    data.phoneNumber
  );
  if (user?.locked) throw papeoError(PAPEO_ERRORS.USER_IS_BLOCKED);

  if (verificationCode) {
    return checkVerificationCode(user, data);
  }
  if (user?.email) {
    await emailVerificationService.createAndSendVerificationCode(
      user,
      user.email
    );
    return {
      channel: "email",
      // TODO anonymize email address
      to: user.email,
    };
  }
  await twilioSendMobileCode(
    data.phoneNumber,
    countryCode,
    channel,
    userIP,
    data.platform
  );
  return {
    channel: channel,
    to: data.phoneNumber,
  };
};

const verifyUserEmailOrPhone = async (req, res) => {
  switch (req.body.type) {
  case "email":
    {
      // TODO Error werfen, wenn bereits verified!!!
      validate(UserSchema.verifyValidation.email, req.body);
      if (
        await User.alreadyInUseByOtherUser(
          "email",
          req.body.email,
          req.user._id
        )
      ) {
        throw papeoError(PAPEO_ERRORS.EMAIL_ALREADY_EXISTS);
      }
      const email = req.body.email;
      const verificationCode = req.body.verificationCode;
      if (verificationCode) {
        await emailVerificationService.validateVerificationCode(
          req.user,
          email,
          verificationCode
        );
        const patchedUser = await usersService.patch(req.user._id, {
          email,
        });
        return patchedUser;
      }
      return await emailVerificationService.createAndSendVerificationCode(
        req.user,
        email
      );
    }
    break;
  case "phoneNumber":
    {
      if (req.user.authPlatforms[0]?.method !== "local") {
        throw papeoError(PAPEO_ERRORS.CANNOT_CHANGE_PHONENUMBER);
      }
      const userIP = req.header("x-forwarded-for");
      validate(UserSchema.verifyValidation.phoneNumber, req.body);
      const phoneNumber = validatePhoneNumber(req.body.phoneNumber);

      if (
        await User.alreadyInUseByOtherUser(
          "phoneNumber",
          phoneNumber,
          req.user._id
        )
      ) {
        throw papeoError(PAPEO_ERRORS.USER_WITH_PHONENUMBER_ALREADY_EXISTS);
      }
      const verificationCode = req.body.verificationCode;
      if (verificationCode) {
        if (!(await twilioVerificationCheck(phoneNumber, verificationCode))) {
          throw papeoError(PAPEO_ERRORS.VERIFICATION_CODE_NOT_VALID);
        }
        const patchedUser = await usersService.patch(req.user._id, {
          phoneNumber,
        });
        return patchedUser;
      }
      await twilioSendMobileCode(
        phoneNumber,
        req.body.countryCode,
        "sms",
        userIP,
        req.body.platform
      );
      return {
        channel: "sms",
      };
    }
    break;
  default:
    throw papeoError(PAPEO_ERRORS.TYPE_DOES_NOT_EXIST);
  }
};

const twilioSendMobileCode = async (
  to,
  countryCode,
  channel,
  userIP,
  platform
) => {
  if (process.env.TEST) return;
  if (
    process.env.TEST_PHONE_NUMBERS &&
    process.env.TEST_PHONE_NUMBERS.split(",").includes(to)
  ) {
    console.log(`No sms sent for ${to} (Test account)`);
    return true;
  }
  if (!userIP) console.error("Error: no user ip found for rate limiting");
  if (
    (await RateLimit.isRateLimited(
      userIP || "default",
      "twilioSmsVerification",
      4
    )) ||
    (await RateLimitPerDay.isRateLimited(
      userIP || "default",
      "twilioSmsVerification",
      15
    ))
  ) {
    throw papeoError(PAPEO_ERRORS.RATE_LIMITED);
  }
  
  const data = {
    locale: countryCode,
    to,
    channel,
  };
  if (platform === "android") data.appHash = process.env.APP_HASH;
  await client.verify.services(twilioServiceSID).verifications.create(data);
};

const twilioVerificationCheck = async (to, verificationCode) => {
  if (process.env.TEST) return true;
  if (
    process.env.TEST_PHONE_NUMBERS &&
    process.env.TEST_PHONE_NUMBERS.split(",").includes(to) &&
    process.env.OVERWRITE_VERIFICATION_CODE === verificationCode
  ) {
    console.log(`Test account ${to} logged in`);
    return true;
  }
  let verification = await client.verify
    .services(twilioServiceSID)
    .verificationChecks.create({ to, code: verificationCode });
  return verification.status === "approved";
};

const validatePhoneNumber = (phoneNumber) => {
  const phoneNumberObject = new PhoneNumber(phoneNumber);

  if (
    !phoneNumberObject.isValid() ||
    !phoneNumberObject.isPossible() ||
    !["DE", "AT", "CH", "XK"].includes(phoneNumberObject.getRegionCode())
  ) {
    console.log(
      `BLOCKED PHONENUMBER: (${phoneNumberObject.getRegionCode()}) ${phoneNumberObject.getNumber()}`
    );
    throw papeoError(PAPEO_ERRORS.PHONENUMBER_NOT_VALID);
  }
  return phoneNumberObject.getNumber();
};

const checkVerificationCode = async (user, data) => {
  const { phoneNumber, verificationCode } = data;
  if (user?.email) {
    const emailIsVerified = (
      await emailVerificationService.validateVerificationCode(
        user,
        user.email,
        verificationCode
      )
    ).verified;
    if (emailIsVerified) {
      const loggedInUser = await usersService.loginWithPhoneNumber(
        user,
        phoneNumber
      );
      return usersService.getLoginInformation(
        loggedInUser,
        data.fcmToken,
        data.platform
      );
    }
    throw papeoError(PAPEO_ERRORS.VERIFICATION_CODE_NOT_VALID);
  }
  const phoneVerified = await twilioVerificationCheck(
    phoneNumber,
    verificationCode
  );

  if (phoneVerified) {
    const loggedInUser = await usersService.loginWithPhoneNumber(
      user,
      phoneNumber
    );
    return usersService.getLoginInformation(
      loggedInUser,
      data.fcmToken,
      data.platform
    );
  }
  throw papeoError(PAPEO_ERRORS.VERIFICATION_CODE_NOT_VALID);
};

const getLanguage = (countryCode) => {
  let listOfSupportedLanguages = [
    "af",
    "ar",
    "ca",
    "zh",
    "zh-cn",
    "zh-hk",
    "hr",
    "cs",
    "da",
    "nl",
    "en",
    "en-gb",
    "fi",
    "fr",
    "de",
    "el",
    "he",
    "hi",
    "hu",
    "id",
    "it",
    "ja",
    "ko",
    "ms",
    "nb",
    "pl",
    "pt-br",
    "pt",
    "ro",
    "ru",
    "es",
    "sv",
    "tl",
    "th",
    "tr",
    "vi",
  ];

  let selectedCountryCodes = "de";
  if (listOfSupportedLanguages.includes(countryCode.toLowerCase())) {
    selectedCountryCodes = countryCode;
  }

  return selectedCountryCodes;
};

exports.localAuthentication = localAuthentication;
exports.twilioSendMobileCode = twilioSendMobileCode;
exports.twilioVerificationCheck = twilioVerificationCheck;
exports.validatePhoneNumber = validatePhoneNumber;
exports.getLanguage = getLanguage;
exports.verifyUserEmailOrPhone = verifyUserEmailOrPhone;
