const AWS = require("aws-sdk");
const sesClient = new AWS.SES({ region: process.env.REGION });

exports.sendEmailDevelopment = async ({ from, to, subject, html }) => {
  const params = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: html,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
    },
    Source: from,
  };
  let result = null;
  try {
    result = await sesClient.sendEmail(params).promise();
  } catch (error) {
    console.log(error);
  }
  return result;
};
