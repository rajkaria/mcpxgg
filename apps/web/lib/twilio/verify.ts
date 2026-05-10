import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID!;

export async function sendVerificationCode(phoneNumber: string) {
  return client.verify.v2.services(serviceSid).verifications.create({
    to: phoneNumber,
    channel: "sms",
  });
}

export async function checkVerificationCode(
  phoneNumber: string,
  code: string
) {
  return client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({
      to: phoneNumber,
      code,
    });
}
