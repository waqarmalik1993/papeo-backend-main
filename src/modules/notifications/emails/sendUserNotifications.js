const mjml = require("mjml");
const authCodeEmail = require("./templates/authCode.js");
const rawTemplate = require("./templates/default.js");
const sendEmailDevelopment = require("./ses.js").sendEmailDevelopment;
const fromAddress = process.env.SEND_MAIL_FROM;

const sendMailGeneration = async (
  template,
  userEmail,
  subject,
  replyEmail,
  emailPrefix
) => {
  const regMail = mjml(template).html;

  let msg = {
    to: userEmail,
    from: fromAddress,
    subject,
    html: regMail,
    Source: `Papeo <${fromAddress}>`,
  };
  if (replyEmail) msg.replyTo = replyEmail;
  if (emailPrefix) msg.Source = `${emailPrefix} <${fromAddress}>`;
  console.time("EMAIL_VERIFICATION_CODE");
  process.env.EMAIL_CLIENT === "development"
    ? console.log(await sendEmailDevelopment(msg))
    : await addToEmailQueueFast(msg);
  console.timeEnd("EMAIL_VERIFICATION_CODE");
};

exports.sendEmailVerificationCode = async (
  receiverUser,
  emailToVerify,
  authCode
) => {
  const subject = "Dein Papeo-Verifizierungscode";
  await sendMailGeneration(
    authCodeEmail(receiverUser, authCode),
    emailToVerify,
    subject
  );
};
exports.sendRawMessage = async (email, subject, body) => {
  await sendMailGeneration(rawTemplate(subject, body), email, subject);
};
