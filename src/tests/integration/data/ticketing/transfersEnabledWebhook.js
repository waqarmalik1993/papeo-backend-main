module.exports = (accountId) => ({
  id: "evt_1LaGzT2H9jJ8fUJF75HVNLFB",
  object: "event",
  account: accountId,
  api_version: "2020-08-27",
  created: 1661337559,
  data: {
    object: {
      id: "transfers",
      object: "capability",
      account: accountId,
      future_requirements: {
        alternatives: [],
        current_deadline: null,
        currently_due: [],
        disabled_reason: null,
        errors: [],
        eventually_due: [],
        past_due: [],
        pending_verification: [],
      },
      requested: true,
      requested_at: 1661337358,
      requirements: {
        alternatives: [],
        current_deadline: null,
        currently_due: [],
        disabled_reason: null,
        errors: [],
        eventually_due: [],
        past_due: [],
        pending_verification: [],
      },
      status: "active",
    },
    previous_attributes: {
      requirements: {
        currently_due: ["tos_acceptance.date", "tos_acceptance.ip"],
        disabled_reason: "requirements.fields_needed",
        eventually_due: ["tos_acceptance.date", "tos_acceptance.ip"],
        past_due: ["tos_acceptance.date", "tos_acceptance.ip"],
      },
      status: "inactive",
    },
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: "req_yLSm1hQoSuxrCu",
    idempotency_key: "6b587500-340b-480a-b4fa-f97fb833fc78",
  },
  type: "capability.updated",
});